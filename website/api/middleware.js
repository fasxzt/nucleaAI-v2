// ============================================
// MIDDLEWARE DE SEGURANÇA - nucleaai.com
// ============================================

const crypto = require('crypto');

// Pool de senhas para rate limiting
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 100;
const MAX_REQUESTS_PER_IP = 20;

// User agents bloqueados
const BLOCKED_USER_AGENTS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java/i,
  /go-http/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i
];

// IPs bloqueados
const BLOCKED_IPS = new Set();

// Função para verificar rate limiting
function checkRateLimit(ip) {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    ipRequestCounts.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }

  record.count++;
  return true;
}

// Função para detectar bots
function isBot(userAgent) {
  if (!userAgent) return true;
  return BLOCKED_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

// Função para validar token de sessão
function validateSessionToken(token) {
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    
    // Verificar expiração
    if (payload.exp && payload.exp < now) return false;
    
    // Verificar emissor
    if (payload.iss !== 'nucleaai') return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

// Função para sanitizar headers
function sanitizeHeaders(headers) {
  const sanitized = {};
  const allowedHeaders = [
    'content-type',
    'authorization',
    'x-firebase-appcheck',
    'x-csrf-token',
    'x-requested-with'
  ];

  for (const [key, value] of Object.entries(headers)) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Função para gerar nonce para CSP
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Middleware principal
function securityMiddleware(req, res, next) {
  // 1. Verificar IP bloqueado
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (BLOCKED_IPS.has(clientIp)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  // 2. Rate limiting
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Muitas requisições',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }

  // 3. Detectar bots
  const userAgent = req.headers['user-agent'];
  if (isBot(userAgent)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  // 4. Validar Origin/Referer
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.includes('nucleaai.com')) {
    return res.status(403).json({ error: 'Origem não permitida' });
  }

  // 5. Sanitizar headers
  req.sanitizedHeaders = sanitizeHeaders(req.headers);

  // 6. Adicionar nonce para CSP
  res.locals.nonce = generateNonce();

  // 7. Headers de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
}

// Middleware para rotas de API
function apiSecurityMiddleware(req, res, next) {
  // Verificar Content-Type para requisições POST
  if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type não suportado' });
  }

  // Verificar tamanho do body
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 1024 * 1024) { // 1MB
    return res.status(413).json({ error: 'Payload muito grande' });
  }

  // Validar token CSRF para mutações
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    const sessionToken = req.headers['x-session-token'];
    
    if (!csrfToken || !sessionToken) {
      return res.status(401).json({ error: 'Token de segurança ausente' });
    }
  }

  next();
}

module.exports = {
  securityMiddleware,
  apiSecurityMiddleware,
  checkRateLimit,
  isBot,
  validateSessionToken,
  generateNonce
};
