#!/bin/bash

# ============================================
# SCRIPT DE DEPLOY SEGURO - NucleaAI
# ============================================

set -e

echo "🚀 Iniciando deploy seguro..."

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar segurança
echo ""
echo "1️⃣  Verificando segurança..."
if [ -f "./scripts/security-check.sh" ]; then
    ./scripts/security-check.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Verificação de segurança falhou!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Script de verificação não encontrado, pulando...${NC}"
fi

# 2. Verificar .gitignore
echo ""
echo "2️⃣  Verificando .gitignore..."
if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✓${NC} .env está no .gitignore"
else
    echo -e "${RED}✗${NC} .env NÃO está no .gitignore!"
    exit 1
fi

# 3. Verificar se há .env no repositório
echo ""
echo "3️⃣  Verificando se há .env no repositório..."
if [ -f ".env" ]; then
    echo -e "${RED}✗${NC} Arquivo .env encontrado!"
    echo "Remova-o antes de fazer commit:"
    echo "  git rm --cached .env"
    exit 1
else
    echo -e "${GREEN}✓${NC} Nenhum arquivo .env encontrado"
fi

# 4. Verificar se há secrets hardcoded
echo ""
echo "4️⃣  Verificando secrets hardcoded..."
SECRETS_FOUND=0
for file in api/mistral.js config.js index.js; do
    if [ -f "$file" ]; then
        if grep -E "(AIzaSy|sk-|pk-|token=)" "$file" > /dev/null 2>&1; then
            echo -e "${RED}✗${NC} Possível secret hardcoded em $file"
            SECRETS_FOUND=1
        fi
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Nenhum secret hardcoded encontrado"
fi

# 5. Verificar dependências
echo ""
echo "5️⃣  Verificando dependências..."
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} package.json existe"
    
    # Verificar se há dependências
    if grep -q '"dependencies"' package.json; then
        echo -e "${YELLOW}⚠️  Dependências encontradas. Execute 'npm audit' para verificar vulnerabilidades.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  package.json não encontrado (ok para projeto estático)${NC}"
fi

# 6. Verificar arquivos de segurança
echo ""
echo "6️⃣  Verificando arquivos de segurança..."
SECURITY_FILES=(
    "vercel.json"
    "SECURITY.md"
    "firebase-rules.js"
    "api/middleware.js"
    "api/crypto.js"
    "api/validation.js"
)

for file in "${SECURITY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file existe"
    else
        echo -e "${YELLOW}⚠️  $file não encontrado${NC}"
    fi
done

# 7. Preparar para commit
echo ""
echo "7️⃣  Preparando para commit..."
echo "Arquivos modificados:"
git status --short

echo ""
echo "==========================================="
echo -e "${GREEN}✅ Verificação de deploy concluída!${NC}"
echo "==========================================="
echo ""
echo "Próximos passos:"
echo "1. Revise as mudanças: git diff"
echo "2. Adicione arquivos: git add ."
echo "3. Commit: git commit -m 'feat: implementar segurança'"
echo "4. Push: git push origin main"
echo ""
echo "O Vercel fará deploy automaticamente após o push."
