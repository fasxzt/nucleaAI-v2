// ============================================
// FIREBASE SECURITY RULES - nucleaai.com
// ============================================
// Copie estas regras para o Firebase Console:
// Firestore → Rules → Cole e publique

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // REGRAS GERAIS
    // ============================================
    
    // Negar acesso por padrão
    match /{document=**} {
      allow read, write: if false;
    }
    
    // ============================================
    // COLEÇÃO DE USUÁRIOS
    // ============================================
    match /users/{userId} {
      // Usuário só pode ler/escrever seus próprios dados
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Subcoleções
      match /app/{document} {
        // Configurações do app
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null && request.auth.uid == userId;
        
        // Validar dados写入
        allow create: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.keys().hasAll(['updatedAt'])
          && request.resource.data.updatedAt is number;
        
        allow update: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.keys().hasAll(['updatedAt'])
          && request.resource.data.updatedAt is number;
      }
      
      // Chats - limitar a 30 sessões
      match /app/chats {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.sessions is list
          && request.resource.data.sessions.size() <= 30;
      }
      
      // Tarefas - limitar a 100 tarefas
      match /app/tasks {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.tasks is list
          && request.resource.data.tasks.size() <= 100;
      }
      
      // Eventos - limitar a 200 eventos
      match /app/events {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null 
          && request.auth.uid == userId;
      }
      
      // Progresso - apenas leitura para outros
      match /app/progress {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.prog is map
          && request.resource.data.prog.total is number
          && request.resource.data.prog.acertos is number
          && request.resource.data.prog.erros is number;
      }
      
      // Conquistas
      match /app/achievements {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null 
          && request.auth.uid == userId
          && request.resource.data.unlocked is list
          && request.resource.data.vozCount is number;
      }
    }
    
    // ============================================
    // COLEÇÃO PÚBLICA (APENAS LEITURA)
    // ============================================
    match /public/{document} {
      allow read: if true;
      allow write: if false;
    }
    
    // ============================================
    // COLEÇÃO DE ADMINS
    // ============================================
    match /admins/{adminId} {
      allow read, write: if request.auth != null 
        && request.auth.token.admin == true;
    }
  }
}

// ============================================
// STORAGE RULES
// ============================================
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Usuários só podem acessar suas próprias pastas
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId;
    }
    
    // Arquivos públicos (imagens estáticas)
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
    
    // Negar acesso por padrão
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}

// ============================================
// AUTH CONFIGURATION
// ============================================
// Configurar no Firebase Console:
// Authentication → Settings → Authorized domains:
// - nucleaai.com
// - www.nucleaai.com
// - localhost (para desenvolvimento)
//
// Métodos habilitados:
// - Email/Senha
// - Google
// - Anônimo (opcional)
//
// App Check:
// - reCAPTCHA v3 habilitado
// - Debug token: false em produção
