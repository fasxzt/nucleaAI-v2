// ============================================
// MÓDULO DE VALIDAÇÃO DE ENTRADA - nucleaai.com
// ============================================

// Função para sanitizar strings
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/[<>]/g, '') // Remove tags HTML
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data URIs
    .replace(/vbscript:/gi, '') // Remove vbscript
    .replace(/expression\(/gi, '') // Remove expressions
    .trim();
}

// Função para validar email
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
}

// Função para validar senha
function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  
  // Mínimo 8 caracteres
  if (password.length < 8) return false;
  
  // Máximo 128 caracteres
  if (password.length > 128) return false;
  
  return true;
}

// Função para validar nome de usuário
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  
  // 3-30 caracteres, apenas letras, números, underscores e hífens
  const re = /^[a-zA-Z0-9_-]{3,30}$/;
  return re.test(username);
}

// Função para validar modelo de IA
function validateModel(model) {
  const allowedModels = [
    'open-mixtral-8x7b',
    'mistral-small-latest',
    'mistral-large-latest',
    'pixtral-12b-latest',
    'pixtral-large-latest'
  ];
  
  return allowedModels.includes(model);
}

// Função para validar conteúdo de mensagem
function validateMessageContent(content) {
  if (!content) return false;
  
  // Se for string, verificar tamanho
  if (typeof content === 'string') {
    return content.length > 0 && content.length <= 10000;
  }
  
  // Se for array (para imagens), validar estrutura
  if (Array.isArray(content)) {
    return content.every(item => {
      if (item.type === 'text') {
        return item.text && item.text.length <= 10000;
      }
      if (item.type === 'image_url') {
        return item.image_url && item.image_url.dataUrl;
      }
      return false;
    });
  }
  
  return false;
}

// Função para validar dados de tarefa
function validateTask(task) {
  if (!task || typeof task !== 'object') return false;
  
  const requiredFields = ['title'];
  const optionalFields = ['description', 'color', 'completed', 'dueDate'];
  
  // Verificar campos obrigatórios
  for (const field of requiredFields) {
    if (!task[field] || typeof task[field] !== 'string') return false;
  }
  
  // Validar título
  if (task.title.length > 100) return false;
  
  // Validar descrição se existir
  if (task.description && task.description.length > 500) return false;
  
  // Validar cor se existir
  if (task.color && !/^#[0-9A-Fa-f]{6}$/.test(task.color)) return false;
  
  // Validar data se existir
  if (task.dueDate && isNaN(Date.parse(task.dueDate))) return false;
  
  return true;
}

// Função para validar evento
function validateEvent(event) {
  if (!event || typeof event !== 'object') return false;
  
  const requiredFields = ['title', 'date'];
  
  for (const field of requiredFields) {
    if (!event[field]) return false;
  }
  
  // Validar título
  if (typeof event.title !== 'string' || event.title.length > 100) return false;
  
  // Validar data
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return false;
  
  // Validar hora se existir
  if (event.time && !/^\d{2}:\d{2}$/.test(event.time)) return false;
  
  return true;
}

// Função para validar configurações de IA
function validateAIConfig(config) {
  if (!config || typeof config !== 'object') return false;
  
  const allowedToms = ['didatico', 'formal', 'casual', 'tecnico'];
  const allowedIdioms = ['pt-BR', 'en-US', 'es-ES'];
  
  if (config.nome && typeof config.nome !== 'string') return false;
  if (config.nome && config.nome.length > 50) return false;
  
  if (config.tom && !allowedToms.includes(config.tom)) return false;
  if (config.idioma && !allowedIdioms.includes(config.idioma)) return false;
  
  if (config.extra && typeof config.extra !== 'string') return false;
  if (config.extra && config.extra.length > 200) return false;
  
  return true;
}

// Função para validar dados de entrada genérica
function validateInput(data, schema) {
  if (!data || !schema || typeof schema !== 'object') return false;
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Verificar se é obrigatório
    if (rules.required && (value === undefined || value === null || value === '')) {
      return false;
    }
    
    // Verificar tipo
    if (rules.type && typeof value !== rules.type) {
      return false;
    }
    
    // Verificar tamanho mínimo
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      return false;
    }
    
    // Verificar tamanho máximo
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      return false;
    }
    
    // Verificar padrão regex
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return false;
    }
    
    // Verificar valores permitidos
    if (rules.allowed && !rules.allowed.includes(value)) {
      return false;
    }
  }
  
  return true;
}

// Função para sanitizar objeto completo
function sanitizeObject(obj, allowedFields) {
  if (!obj || typeof obj !== 'object') return {};
  
  const sanitized = {};
  
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] === 'string') {
        sanitized[field] = sanitizeString(obj[field]);
      } else {
        sanitized[field] = obj[field];
      }
    }
  }
  
  return sanitized;
}

// Função para prevenir mass assignment
function preventMassAssignment(data, allowedFields) {
  if (!data || typeof data !== 'object') return {};
  
  const sanitized = {};
  
  for (const field of allowedFields) {
    if (data.hasOwnProperty(field)) {
      sanitized[field] = data[field];
    }
  }
  
  return sanitized;
}

module.exports = {
  sanitizeString,
  validateEmail,
  validatePassword,
  validateUsername,
  validateModel,
  validateMessageContent,
  validateTask,
  validateEvent,
  validateAIConfig,
  validateInput,
  sanitizeObject,
  preventMassAssignment
};
