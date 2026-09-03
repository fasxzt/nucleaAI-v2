// ============================================================
//  config.js — Configurações da API Mistral
//  IMPORTANTE: Esta arquivo NÃO deve conter chaves reais
//  Configure as variáveis de ambiente no painel da Vercel
// ============================================================

const CONFIG = {
  // Chave da API Mistral - configure via variável de ambiente MISTRAL_API_KEY
  MISTRAL_API_KEY: typeof process !== 'undefined' && process.env ? process.env.MISTRAL_API_KEY : '',

  // Modelo padrão - configure via variável de ambiente MISTRAL_MODEL
  MISTRAL_MODEL: typeof process !== 'undefined' && process.env ? process.env.MISTRAL_MODEL : 'open-mixtral-8x7b',

  // Firebase App Check (reCAPTCHA v3)
  FIREBASE_APP_CHECK_SITE_KEY: '6LeyABktAAAAAG9ytSc1jHJ2wC1UVkbBAWO7Jj4L',

  // Use somente em localhost/desenvolvimento. Deixe false em producao.
  FIREBASE_APP_CHECK_DEBUG_TOKEN: false,

  // Configurações de segurança
  SECURITY: {
    RATE_LIMIT_MAX: 10,
    RATE_LIMIT_WINDOW_MS: 60000,
    MAX_BODY_CHARS: 4500000,
    ALLOWED_ORIGINS: ['https://nucleaai.com', 'https://www.nucleaai.com'],
  }
};
