#!/bin/bash

# ============================================
# SCRIPT DE VERIFICAÇÃO DE SEGURANÇA
# NucleaAI - Executar antes de cada deploy
# ============================================

echo "🔍 Iniciando verificação de segurança..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
ERRORS=0
WARNINGS=0

# Função para verificar se arquivo existe
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2 - ARQUIVO NÃO ENCONTRADO"
        ((ERRORS++))
    fi
}

# Função para verificar se variável está configurada
check_env() {
    if [ -n "${!1}" ]; then
        echo -e "${GREEN}✓${NC} $2 configurada"
    else
        echo -e "${YELLOW}⚠${NC} $2 não configurada (ok para desenvolvimento)"
        ((WARNINGS++))
    fi
}

# Função para verificar se há secrets hardcoded
check_secrets() {
    local file=$1
    local patterns=("API_KEY" "SECRET" "PASSWORD" "TOKEN")
    
    for pattern in "${patterns[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            # Verificar se é placeholder
            if grep -q "SUA_CHAVE_AQUI\|your_key_here\|placeholder" "$file" 2>/dev/null; then
                echo -e "${YELLOW}⚠${NC} Placeholder encontrado em $file"
                ((WARNINGS++))
            else
                echo -e "${RED}✗${NC} Possível secret hardcoded em $file"
                ((ERRORS++))
            fi
        fi
    done
}

echo "📁 Verificando arquivos de configuração..."
check_file ".gitignore" ".gitignore existe"
check_file ".env.example" ".env.example existe"
check_file "vercel.json" "vercel.json existe"
check_file "package.json" "package.json existe"
echo ""

echo "🔒 Verificando segurança do código-fonte..."
check_secrets "api/mistral.js"
check_secrets "config.js"
check_secrets "index.js"
echo ""

echo "🛡️ Verificando headers de segurança no vercel.json..."
if grep -q "X-Content-Type-Options" "vercel.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} X-Content-Type-Options configurado"
else
    echo -e "${RED}✗${NC} X-Content-Type-Options não encontrado"
    ((ERRORS++))
fi

if grep -q "X-Frame-Options" "vercel.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} X-Frame-Options configurado"
else
    echo -e "${RED}✗${NC} X-Frame-Options não encontrado"
    ((ERRORS++))
fi

if grep -q "Strict-Transport-Security" "vercel.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} HSTS configurado"
else
    echo -e "${RED}✗${NC} HSTS não encontrado"
    ((ERRORS++))
fi

if grep -q "Content-Security-Policy" "vercel.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} CSP configurado"
else
    echo -e "${YELLOW}⚠${NC} CSP não encontrado (recomendado)"
    ((WARNINGS++))
fi
echo ""

echo "🔄 Verificando HTTPS redirect..."
if grep -q "https://" "vercel.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Redirect HTTPS configurado"
else
    echo -e "${YELLOW}⚠${NC} Redirect HTTPS não encontrado"
    ((WARNINGS++))
fi
echo ""

echo "📊 Verificando rate limiting..."
if grep -q "rateLimitMap\|RATE_LIMIT" "api/mistral.js" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Rate limiting implementado"
else
    echo -e "${RED}✗${NC} Rate limiting não encontrado"
    ((ERRORS++))
fi
echo ""

echo "🧹 Verificando sanitização de inputs..."
if grep -q "sanitizeString\|sanitize" "api/validation.js" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Sanitização implementada"
else
    echo -e "${RED}✗${NC} Sanitização não encontrada"
    ((ERRORS++))
fi
echo ""

echo "🔐 Verificando criptografia..."
if grep -q "encrypt\|decrypt" "api/crypto.js" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Módulo de criptografia existe"
else
    echo -e "${RED}✗${NC} Módulo de criptografia não encontrado"
    ((ERRORS++))
fi
echo ""

echo "📝 Verificando .gitignore..."
if grep -q "\.env" ".gitignore" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} .env no .gitignore"
else
    echo -e "${RED}✗${NC} .env não está no .gitignore"
    ((ERRORS++))
fi

if grep -q "\.key\|\.pem" ".gitignore" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Chaves privadas no .gitignore"
else
    echo -e "${YELLOW}⚠${NC} Chaves privadas não estão no .gitignore"
    ((WARNINGS++))
fi
echo ""

# Resumo
echo "==========================================="
echo "📊 RESUMO DA VERIFICAÇÃO"
echo "==========================================="
echo -e "${RED}Erros: $ERRORS${NC}"
echo -e "${YELLOW}Avisos: $WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Verificação de segurança passou!${NC}"
    exit 0
else
    echo -e "${RED}❌ Verificação de segurança falhou!${NC}"
    echo "Corrija os erros antes de fazer deploy."
    exit 1
fi
