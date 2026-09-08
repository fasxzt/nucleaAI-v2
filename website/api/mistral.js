const crypto = require('crypto');

const PROJECT_NUMBER = process.env.FIREBASE_PROJECT_NUMBER || '809997459519';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nucleaai-30555';
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || '1:809997459519:web:392698d2eccfe3380e988a';
const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const MAX_BODY_CHARS = 4_500_000;

let jwksCache = null;
let jwksCacheExpiresAt = 0;

let respCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

let concurrency = 0;
let queue = [];

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function cacheKey(model, content) {
  return model + '|' + crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function getCached(m) {
  var cached = respCache.get(m);
  return cached && cached.exp > Date.now() ? cached.value : undefined;
}

function setCached(m, value) {
  if (respCache.size >= MAX_CACHE_ENTRIES) {
    var oldestKey = null, oldestExp = Infinity;
    respCache.forEach(function(v, k) { if (v.exp < oldestExp) { oldestExp = v.exp; oldestKey = k; } });
    if (oldestKey) respCache.delete(oldestKey);
  }
  respCache.set(m, { value: value, exp: Date.now() + CACHE_TTL_MS });
}

function wrapTask(fn) {
  return new Promise(function(resolve, reject) {
    queue.push({ fn: fn, resolve: resolve, reject: reject });
    pumpQueue();
  });
}

function pumpQueue() {
  if (concurrency >= 1 || queue.length === 0) return;
  concurrency++;
  var task = queue.shift();
  task.fn().then(task.resolve, task.reject).finally(function() {
    concurrency--;
    pumpQueue();
  });
}

function json(res, status, body) {
  return res.status(status).json(body);
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function parseJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Token App Check invalido');
  return {
    header: JSON.parse(decodeBase64Url(parts[0])),
    payload: JSON.parse(decodeBase64Url(parts[1])),
    signingInput: parts[0] + '.' + parts[1],
    signature: parts[2]
  };
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now < jwksCacheExpiresAt) return jwksCache;

  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error('Falha ao carregar chaves App Check');

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;

  jwksCache = await response.json();
  jwksCacheExpiresAt = now + Math.min(maxAgeMs, 6 * 60 * 60 * 1000);
  return jwksCache;
}

async function verifyAppCheckToken(token) {
  const parsed = parseJwt(token);
  if (parsed.header.alg !== 'RS256' || !parsed.header.kid) {
    throw new Error('Token App Check sem assinatura valida');
  }

  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find(function(key) { return key.kid === parsed.header.kid; });
  if (!jwk) throw new Error('Chave App Check desconhecida');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(parsed.signingInput);
  verifier.end();

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signature = Buffer.from(parsed.signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!verifier.verify(publicKey, signature)) {
    throw new Error('Assinatura App Check invalida');
  }

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(parsed.payload.aud) ? parsed.payload.aud : [parsed.payload.aud];
  const validAudience = aud.includes('projects/' + PROJECT_NUMBER) || aud.includes('projects/' + PROJECT_ID);
  const validIssuer = parsed.payload.iss === 'https://firebaseappcheck.googleapis.com/' + PROJECT_NUMBER;
  const validSubject = !FIREBASE_APP_ID || parsed.payload.sub === FIREBASE_APP_ID;

  if (!validAudience) throw new Error('Audiencia App Check invalida');
  if (!validIssuer) throw new Error('Emissor App Check invalido');
  if (!validSubject) throw new Error('App ID App Check invalido');
  if (!parsed.payload.exp || parsed.payload.exp < now - 30) throw new Error('Token App Check expirado');
  if (!parsed.payload.iat || parsed.payload.iat > now + 30) throw new Error('Token App Check emitido no futuro');

  return parsed.payload;
}

function allowedModel(model) {
  const allowed = (process.env.MISTRAL_ALLOWED_MODELS || [
    'open-mixtral-8x7b',
    'mistral-small-latest',
    'mistral-large-latest',
    'pixtral-12b-latest',
    'pixtral-large-latest'
  ].join(',')).split(',').map(function(item) { return item.trim(); }).filter(Boolean);

  return allowed.includes(model);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Metodo nao permitido' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'MISTRAL_API_KEY nao configurada na Vercel' });
  }

  if (process.env.DISABLE_APP_CHECK !== 'true') {
    const appCheckToken = req.headers['x-firebase-appcheck'];
    if (!appCheckToken) {
      return json(res, 401, { error: 'Token App Check ausente' });
    }

    try {
      await verifyAppCheckToken(appCheckToken);
    } catch (e) {
      return json(res, 401, { error: 'Token App Check invalido' });
    }
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      body = JSON.parse(body || '{}');
    }

    const model = body.model || process.env.MISTRAL_MODEL || 'open-mixtral-8x7b';
    const content = body.content || body.prompt || '';

    if (!allowedModel(model)) {
      return json(res, 400, { error: 'Modelo nao permitido' });
    }

    if (!content) {
      return json(res, 400, { error: 'Mensagem vazia' });
    }

    if (JSON.stringify(content).length > MAX_BODY_CHARS) {
      return json(res, 413, { error: 'Mensagem ou imagem muito grande' });
    }

    const ckey = cacheKey(model, content);
    const cached = getCached(ckey);
    if (cached !== undefined) {
      return json(res, 200, { resposta: cached, cache: true });
    }

    const result = await wrapTask(async function() {
      return await callMistral(apiKey, model, content);
    });

    if (result && result.resposta) setCached(ckey, result.resposta);
    return json(res, 200, result);
  } catch (e) {
    return json(res, e.status || 500, { error: e.message || 'Erro interno' });
  }
};

async function callMistral(apiKey, model, content) {
  const MAX_RETRIES = 4;
  const BACKOFF_MS = [1000, 2500, 6000, 12000];
  const DEADLINE_MS = 50000;

  const started = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const elapsed = Date.now() - started;
      const wait = Math.min(BACKOFF_MS[attempt - 1], Math.max(200, DEADLINE_MS - elapsed));
      if (wait <= 0) break;
      await sleep(wait);
    }

    let mistralRes;
    try {
      mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1000,
          messages: [{ role: 'user', content: content }]
        })
      });
    } catch (netErr) {
      const elapsed = Date.now() - started;
      const canRetry = attempt < MAX_RETRIES && elapsed < DEADLINE_MS;
      if (!canRetry) throw { message: 'Erro de rede na Mistral: ' + netErr.message };
      continue;
    }

    const data = await mistralRes.json().catch(function() { return {}; });
    const responseError = data.message || data.error || 'Erro na Mistral';

    if (mistralRes.ok) {
      const answer = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
      if (answer) return { resposta: answer };
      throw { message: 'Resposta vazia da Mistral' };
    }

    if (mistralRes.status === 429) {
      const retryAfter = Number(mistralRes.headers.get('retry-after')) || 0;
      const elapsed = Date.now() - started;
      const canRetry = attempt < MAX_RETRIES && elapsed < DEADLINE_MS;
      if (!canRetry) {
        throw {
          status: 429,
          message: 'A chave Mistral atingiu o limite de requisicoes por minuto (plano free ~1/min). Aguarde um momento e tente de novo. ' + responseError
        };
      }
      if (retryAfter > 0 && retryAfter <= 30) await sleep(retryAfter * 1000);
      continue;
    }

    throw { status: mistralRes.status, message: responseError };
  }

  throw { status: 429, message: 'Limite de requisicoes da Mistral excedido. Tente novamente em instantes.' };
}
