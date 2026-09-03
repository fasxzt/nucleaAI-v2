// ============================================
// MÓDULO DE CRIPTOGRAFIA - nucleaai.com
// ============================================

const crypto = require('crypto');

// Configurações de criptografia
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Chave de criptografia (deve ser configurada via variável de ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');

// Função para criptografar dados
function encrypt(text) {
  if (!text) return '';
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combinar IV + Tag + Dados criptografados
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    return '';
  }
}

// Função para descriptografar dados
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return '';
  }
}

// Função para gerar hash seguro (para senhas)
function hashPassword(password, salt) {
  if (!password) return '';
  
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  
  return salt + ':' + hash.toString('hex');
}

// Função para verificar senha
function verifyPassword(password, hashedPassword) {
  if (!password || !hashedPassword) return false;
  
  const parts = hashedPassword.split(':');
  if (parts.length !== 2) return false;
  
  const salt = parts[0];
  const hash = parts[1];
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
  return verifyHash.toString('hex') === hash;
}

// Função para gerar token seguro
function generateToken(length) {
  length = length || 32;
  return crypto.randomBytes(length).toString('hex');
}

// Função para validar token
function validateToken(token, expectedLength) {
  if (!token) return false;
  
  expectedLength = expectedLength || 32;
  const hexRegex = /^[0-9a-f]+$/;
  
  return hexRegex.test(token) && token.length === expectedLength * 2;
}

// Função para criptografar dados sensíveis antes de salvar no Firestore
function encryptSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'email'];
  const encrypted = { ...data };
  
  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  }
  
  return encrypted;
}

// Função para descriptografar dados sensíveis após ler do Firestore
function decryptSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'email'];
  const decrypted = { ...data };
  
  for (const field of sensitiveFields) {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  }
  
  return decrypted;
}

// Função para mascarar dados sensíveis (para logs)
function maskSensitiveData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'email'];
  const masked = { ...data };
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      const value = String(masked[field]);
      if (value.length > 4) {
        masked[field] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
      } else {
        masked[field] = '***';
      }
    }
  }
  
  return masked;
}

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateToken,
  validateToken,
  encryptSensitiveData,
  decryptSensitiveData,
  maskSensitiveData
};
