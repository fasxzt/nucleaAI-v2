# ============================================
# GUIA RÁPIDO - Deploy Seguro no Vercel
# ============================================

## 1. Preparar o Repositório

```bash
# 1.1 Copiar .env.example para .env.local (local)
cp .env.example .env.local

# 1.2 Preencher .env.local com suas chaves (NÃO COMMITAR)
# Editar .env.local com suas chaves reais

# 1.3 Rodar verificação de segurança
chmod +x scripts/security-check.sh
./scripts/security-check.sh
```

## 2. Configurar no Vercel Dashboard

### 2.1 Importar Projeto
1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe do GitHub/GitLab/Bitbucket
3. Selecione a pasta `website`

### 2.2 Configurar Variáveis de Ambiente
1. Vá em **Settings → Environment Variables**
2. Adicione cada variável:

| Variável | Valor | Ambiente |
|----------|-------|----------|
| `MISTRAL_API_KEY` | `sua_chave_mistral` | Production |
| `MISTRAL_MODEL` | `open-mixtral-8x7b` | Production |
| `FIREBASE_PROJECT_NUMBER` | `809997459519` | Production |
| `FIREBASE_PROJECT_ID` | `nucleaai-30555` | Production |
| `FIREBASE_APP_ID` | `1:809997459519:web:392698d2eccfe3380e988a` | Production |
| `DISABLE_APP_CHECK` | `false` | Production |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Production |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Production |
| `ALLOWED_ORIGINS` | `https://nucleaai.com,https://www.nucleaai.com` | Production |
| `ENCRYPTION_KEY` | `chave_32_bytes_aleatoria` | Production |

### 2.3 Configurar Domínio
1. Vá em **Settings → Domains**
2. Adicione `nucleaai.com`
3. Adicione `www.nucleaai.com`
4. Configure DNS conforme instruções

### 2.4 Verificar Headers de Segurança
1. Vá em **Settings → Headers**
2. Verifique se `vercel.json` está aplicado
3. Teste com [securityheaders.com](https://securityheaders.com)

## 3. Configurar Firebase

### 3.1 App Check
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Vá em **App Check → Settings**
3. Registre seu domínio
4. Configure reCAPTCHA v3
5. **NÃO** habilite debug tokens em produção

### 3.2 Firestore Rules
1. Vá em **Firestore → Rules**
2. Cole as regras de `firebase-rules.js`
3. Publique

### 3.3 Authentication
1. Vá em **Authentication → Settings**
2. Adicione domínios autorizados:
   - `nucleaai.com`
   - `www.nucleaai.com`
3. Habilite métodos:
   - Email/Senha
   - Google

## 4. Deploy

```bash
# 4.1 Commit das mudanças
git add .
git commit -m "feat: implementar segurança completa"

# 4.2 Push para o repositório
git push origin main

# 4.3 O Vercel fará deploy automaticamente
```

## 5. Verificar Deploy

### 5.1 Testar Headers de Segurança
Acesse [securityheaders.com](https://securityheaders.com) e insira:
```
https://nucleaai.com
```

### 5.2 Testar HTTPS
Acesse [whynothttps.com](https://whynothttps.com) e insira:
```
https://nucleaai.com
```

### 5.3 Testar API
```bash
# Testar rate limiting
for i in {1..15}; do
  curl -X POST https://nucleaai.com/api/mistral \
    -H "Content-Type: application/json" \
    -d '{"model":"open-mixtral-8x7b","content":"test"}'
done
```

### 5.4 Verificar Logs
1. Vá em **Vercel Dashboard → Logs**
2. Monitore erros e performance
3. Configure alertas

## 6. Monitoramento Contínuo

### 6.1 Vercel Analytics
- Habilite Web Analytics
- Monitore performance

### 6.2 Firebase Monitoring
- Acesse Firebase Console → Monitoring
- Configure alertas

### 6.3 UptimeRobot
- Configure monitoramento 24/7
- Alertas via email/Telegram

## 7. Checklist Final

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Domínio configurado e SSL ativo
- [ ] Firebase App Check habilitado
- [ ] Firestore Rules publicadas
- [ ] Authentication configurada
- [ ] Headers de segurança verificados
- [ ] HTTPS forçado
- [ ] Rate limiting funcionando
- [ ] Logs monitorados

---

## 🚨 Emergência

Se encontrar uma vulnerabilidade:
1. **NÃO** abra issue pública
2. Entre em contato: [seu-email@dominio.com]
3. Documente o problema
4. Aguarde resposta antes de divulgar
