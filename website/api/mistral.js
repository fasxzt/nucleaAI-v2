const crypto = require('crypto');
const { validateModel, validateMessageContent, sanitizeString, preventMassAssignment } = require('./validation');
const { maskSensitiveData } = require('./crypto');

// ============================================
// CONFIGURAÇÕES DE SEGURANÇA
// ============================================
const PROJECT_NUMBER = process.env.FIREBASE_PROJECT_NUMBER || '809997459519';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nucleaai-30555';
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || '1:809997459519:web:392698d2eccfe3380e988a';
const JWKS_URL = 'https://firebaseappcheck.googleapis.com/v1/jwks';
const MAX_BODY_CHARS = 4_500_000;

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;

// Whitelist de origens permitidas
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

let jwksCache = null;
let jwksCacheExpiresAt = 0;

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================
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

// ============================================
// RATE LIMITING
// ============================================
function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Limpar rate limit a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// ============================================
// HEADERS DE SEGURANÇA
// ============================================
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

// ============================================
// VALIDAÇÃO DE ENTRADA (ANTI MASS ASSIGNMENT)
// ============================================
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  // Remove caracteres perigosos
  let sanitized = input
    .replace(/[<>]/g, '') // Remove tags HTML
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data URIs
    .trim();

  // Limita tamanho
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }

  return sanitized;
}

function validateModel(model) {
  const allowed = (process.env.MISTRAL_ALLOWED_MODELS || [
    'open-mixtral-8x7b',
    'mistral-small-latest',
    'mistral-large-latest',
    'pixtral-12b-latest',
    'pixtral-large-latest'
  ].join(',')).split(',').map(item => item.trim()).filter(Boolean);

  return allowed.includes(model);
}

// ============================================
// APP CHECK
// ============================================
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
  const jwk = (jwks.keys || []).find(key => key.kid === parsed.header.kid);
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

// ============================================
// VALIDAÇÃO DE ORIGEM (CORS)
// ============================================
function validateOrigin(req) {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true; // Permitir se não houver origem (ex: ferramentas de API)
  
  if (ALLOWED_ORIGINS.length === 0) return true; // Se não houver whitelist, permitir
  
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

// ============================================
// TRIM DE RESPOSTAS (REMOVER DADOS DESNECESSÁRIOS)
// ============================================
function trimResponse(data) {
  // Remove metadados sensíveis da resposta
  const trimmed = { ...data };
  
  // Remove campos que não devem ser expostos
  delete trimmed.id;
  delete trimmed.object;
  delete trimmed.created;
  delete trimmed.model;
  delete trimmed.usage;
  
  // Mantém apenas o conteúdo necessário
  return {
    resposta: trimmed.resposta || ''
  };
}

// ============================================
// HANDLER PRINCIPAL
// ============================================
module.exports = async function handler(req, res) {
  // Aplicar headers de segurança em todas as respostas
  setSecurityHeaders(res);

  // Validar método
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Metodo nao permitido' });
  }

  // Rate limiting
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return json(res, 429, { 
      error: 'Muitas requisicoes. Tente novamente mais tarde.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    });
  }

  // Validar origem (CORS)
  if (!validateOrigin(req)) {
    return json(res, 403, { error: 'Origem nao permitida' });
  }

  // Verificar API key
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'Servico temporariamente indisponivel' }); // Mensagem genérica
  }

  // Verificar App Check
  if (process.env.DISABLE_APP_CHECK !== 'true') {
    const appCheckToken = req.headers['x-firebase-appcheck'];
    if (!appCheckToken) {
      return json(res, 401, { error: 'Autenticacao necessaria' });
    }

    try {
      await verifyAppCheckToken(appCheckToken);
    } catch (e) {
      return json(res, 401, { error: 'Autenticacao invalida' }); // Mensagem genérica
    }
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      body = JSON.parse(body || '{}');
    }

    // Validação anti mass assignment - apenas campos permitidos
    const allowedFields = ['model', 'content', 'prompt'];
    const sanitizedBody = preventMassAssignment(body, allowedFields);

    const model = sanitizedBody.model || process.env.MISTRAL_MODEL || 'open-mixtral-8x7b';
    const content = sanitizedBody.content || sanitizedBody.prompt || '';

    // Validar modelo
    if (!validateModel(model)) {
      return json(res, 400, { error: 'Parametros invalidos' }); // Mensagem genérica
    }

    // Validar conteúdo
    if (!validateMessageContent(content)) {
      return json(res, 400, { error: 'Parametros invalidos' }); // Mensagem genérica
    }

    if (JSON.stringify(content).length > MAX_BODY_CHARS) {
      return json(res, 413, { error: 'Tamanho maximo excedido' }); // Mensagem genérica
    }

    // Sanitizar conteúdo se for string
    if (typeof content === 'string') {
      content = sanitizeString(content);
    }

    // Chamar API da Mistral
    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
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

    const data = await mistralRes.json().catch(() => ({}));

    if (!mistralRes.ok) {
      return json(res, mistralRes.status, {
        error: 'Erro ao processar solicitacao' // Mensagem genérica
      });
    }

    const answer = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    // Trim da resposta para remover dados desnecessários
    return json(res, 200, trimResponse({ resposta: answer }));
  } catch (e) {
    return json(res, 500, { error: 'Erro interno do servidor' }); // Mensagem genérica
  }
};
