# ============================================
# GUIA DE SEGURANÇA - NucleaAI
# ============================================

## 📋 Checklist de Segurança antes do Deploy

### 1. Variáveis de Ambiente (Vercel Dashboard)
- [ ] `MISTRAL_API_KEY` - Chave da API Mistral
- [ ] `MISTRAL_MODEL` - Modelo padrão
- [ ] `FIREBASE_PROJECT_NUMBER` - Número do projeto Firebase
- [ ] `FIREBASE_PROJECT_ID` - ID do projeto Firebase
- [ ] `FIREBASE_APP_ID` - App ID do Firebase
- [ ] `DISABLE_APP_CHECK` - false em produção
- [ ] `RATE_LIMIT_MAX_REQUESTS` - Limite de requisições
- [ ] `RATE_LIMIT_WINDOW_MS` - Janela de tempo (ms)
- [ ] `ALLOWED_ORIGINS` - Origens permitidas
- [ ] `ENCRYPTION_KEY` - Chave de criptografia (32 bytes)

### 2. Configuração Firebase
- [ ] App Check habilitado
- [ ] reCAPTCHA v3 configurado
- [ ] Firestore Rules configuradas
- [ ] Auth Methods habilitados (Google, Email/Senha)

### 3. Segurança do Código
- [ ] Nenhuma API key hardcoded no código
- [ ] Todos os inputs sanitizados
- [ ] Rate limiting implementado
- [ ] Headers de segurança configurados
- [ ] HTTPS forçado
- [ ] CSP configurado

### 4. Deploy
- [ ] Rodar `./scripts/security-check.sh`
- [ ] Verificar `npm audit`
- [ ] Testar em produção
- [ ] Monitorar logs

---

## 🔧 Configuração no Vercel Dashboard

### Environment Variables

Acesse: Settings → Environment Variables

```
MISTRAL_API_KEY=sua_chave_aqui
MISTRAL_MODEL=open-mixtral-8x7b
FIREBASE_PROJECT_NUMBER=809997459519
FIREBASE_PROJECT_ID=nucleaai-30555
FIREBASE_APP_ID=1:809997459519:web:392698d2eccfe3380e988a
DISABLE_APP_CHECK=false
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
ALLOWED_ORIGINS=https://nucleaai.com,https://www.nucleaai.com
ENCRYPTION_KEY=sua_chave_32_bytes_aqui
```

### Headers de Segurança (vercel.json)

O arquivo `vercel.json` já contém:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: configurado
- Cache-Control: no-store, no-cache

### HTTPS Redirect (vercel.json)

O redirect HTTP → HTTPS está configurado no `vercel.json`.

---

## 🛡️ Medidas de Segurança Implementadas

### 1. Esconder API Keys
- Chaves movidas para variáveis de ambiente
- Arquivo `.env.example` como referência
- `.gitignore` atualizado

### 2. Limpar Secrets do Git
- `.gitignore` com padrões para `.env*`
- Verificação automática no script `security-check.sh`

### 3. Rate Limiting
- Implementado no backend (`api/mistral.js`)
- Limite configurável via variável de ambiente
- Proteção contra DDoS e brute force

### 4. Bot Protection
- User-agent blocking
- Validação de origin/referer
- Firebase App Check

### 5. Validação de Inputs
- Sanitização de strings
- Validação de modelos permitidos
- Prevenção de mass assignment

### 6. Criptografia
- Módulo `api/crypto.js` para criptografar dados sensíveis
- Hash de senhas com PBKDF2
- Geração de tokens seguros

### 7. Headers de Segurança
- CSP (Content Security Policy)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

### 8. HTTPS Forçado
- Redirect HTTP → HTTPS via `vercel.json`
- HSTS com max-age de 1 ano

### 9. Trim de Respostas
- Respostas da API limpas de metadados desnecessários
- Apenas dados essenciais retornados

### 10. Validação Server-side
- App Check do Firebase
- Validação de token JWT
- Cache de chaves JWKS

---

## 🚨 O que NÃO fazer

1. **NUNCA** commite chaves de API no Git
2. **NUNCA** exponha erros detalhados em produção
3. **NUNCA** desabilite App Check em produção
4. **NUNCA** use HTTP em produção
5. **NUNCA** confie em dados do cliente sem validar

---

## 📞 Contato para Issues de Segurança

Se encontrar uma vulnerabilidade, por favor reporte diretamente:
- Email: [seu-email@dominio.com]
- Não abra issues públicas para vulnerabilidades

---

## 🔄 Atualizações de Segurança

- Execute `./scripts/security-check.sh` antes de cada deploy
- Execute `npm audit` regularmente
- Mantenha as dependências atualizadas
- Monitore os logs da Vercel
