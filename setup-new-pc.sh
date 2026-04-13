#!/bin/bash
# ============================================
# Grand Line + Pipeline — Setup en PC nuevo
# ============================================
# Ejecuta: bash setup-new-pc.sh
# Requisitos: macOS con Homebrew, o Linux/WSL
# ============================================

set -e
echo ""
echo "=========================================="
echo "  GRAND LINE — Setup en PC nuevo"
echo "=========================================="
echo ""

# ─── 1. Verificar/instalar dependencias ─────
echo "[1/7] Verificando dependencias..."

# Node.js
if ! command -v node &> /dev/null; then
    echo "  Node.js no encontrado. Instalando..."
    if command -v brew &> /dev/null; then
        brew install node
    else
        echo "  ERROR: Instala Node.js manualmente desde https://nodejs.org (v18+)"
        echo "  Luego vuelve a ejecutar este script."
        exit 1
    fi
fi
echo "  Node.js: $(node -v)"

# Python
if ! command -v python3 &> /dev/null; then
    echo "  Python3 no encontrado. Instalando..."
    if command -v brew &> /dev/null; then
        brew install python@3.11
    else
        echo "  ERROR: Instala Python 3.9+ desde https://python.org"
        exit 1
    fi
fi
echo "  Python: $(python3 --version)"

# GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "  GitHub CLI no encontrado. Instalando..."
    if command -v brew &> /dev/null; then
        brew install gh
    elif command -v winget &> /dev/null; then
        winget install GitHub.cli
    else
        echo "  ERROR: Instala gh desde https://cli.github.com"
        exit 1
    fi
fi
echo "  GitHub CLI: $(gh --version | head -1)"

# ─── 2. Autenticar GitHub ───────────────────
echo ""
echo "[2/7] Verificando autenticacion de GitHub..."
if ! gh auth status &> /dev/null; then
    echo "  No autenticado. Abriendo login..."
    gh auth login --web --git-protocol https
    gh auth setup-git
else
    echo "  Ya autenticado: $(gh auth status 2>&1 | grep 'account' | head -1)"
fi

# ─── 3. Clonar repos ────────────────────────
WORKSPACE="$HOME/Grand-Line-Workspace"
echo ""
echo "[3/7] Clonando repos en $WORKSPACE ..."
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# Grand Line
if [ ! -d "Grandline-antigravity" ]; then
    echo "  Clonando Grand Line..."
    gh repo clone Tabo-ecom/Grandline-antigravity
else
    echo "  Grand Line ya existe, actualizando..."
    cd Grandline-antigravity && git pull && cd ..
fi

# Pipeline
if [ ! -d "shopify-product-pipeline" ]; then
    echo "  Clonando Pipeline..."
    gh repo clone Tabo-ecom/shopify-product-pipeline
else
    echo "  Pipeline ya existe, actualizando..."
    cd shopify-product-pipeline && git pull && cd ..
fi

# ─── 4. Instalar dependencias ────────────────
echo ""
echo "[4/7] Instalando dependencias de Grand Line..."
cd "$WORKSPACE/Grandline-antigravity/grand-line-v8"
npm install --legacy-peer-deps 2>&1 | tail -3

echo ""
echo "[5/7] Instalando dependencias del Pipeline..."
cd "$WORKSPACE/shopify-product-pipeline"
pip3 install -r requirements.txt 2>&1 | tail -3

# ─── 5. Verificar archivos de entorno ────────
echo ""
echo "[6/7] Verificando archivos de entorno..."

GL_ENV="$WORKSPACE/Grandline-antigravity/grand-line-v8/.env.local"
PL_ENV="$WORKSPACE/shopify-product-pipeline/.env"

if [ ! -f "$GL_ENV" ]; then
    echo ""
    echo "  ⚠️  FALTA: $GL_ENV"
    echo "  Copia .env.local desde tu Mac principal."
    echo "  Puedes usar AirDrop, USB o:"
    echo "    scp usuario@mac-principal:\"~/Grand Line with antigravitu/grand-line-v8/.env.local\" \"$GL_ENV\""
    echo ""
    MISSING_ENV=1
else
    echo "  ✅ Grand Line .env.local encontrado"
fi

if [ ! -f "$PL_ENV" ]; then
    echo ""
    echo "  ⚠️  FALTA: $PL_ENV"
    echo "  Copia .env desde tu Mac principal."
    echo "  Puedes usar AirDrop, USB o:"
    echo "    scp usuario@mac-principal:\"~/Documents/SECOND BRAIN/shopify-product-pipeline/.env\" \"$PL_ENV\""
    echo ""
    MISSING_ENV=1
else
    echo "  ✅ Pipeline .env encontrado"
fi

# ─── 6. Instalar CLIs de deploy (opcional) ───
echo ""
echo "[7/7] Instalando CLIs de deploy..."

# Vercel
if ! command -v vercel &> /dev/null; then
    echo "  Instalando Vercel CLI..."
    npm i -g vercel 2>&1 | tail -1
fi
echo "  Vercel CLI: $(vercel --version 2>/dev/null || echo 'instalado')"

# Railway
if ! command -v railway &> /dev/null; then
    echo "  Instalando Railway CLI..."
    npm i -g @railway/cli 2>&1 | tail -1
fi
echo "  Railway CLI: $(railway --version 2>/dev/null || echo 'instalado')"

# ─── Resumen ─────────────────────────────────
echo ""
echo "=========================================="
echo "  SETUP COMPLETADO"
echo "=========================================="
echo ""
echo "  Workspace: $WORKSPACE"
echo ""
echo "  Grand Line:  $WORKSPACE/Grandline-antigravity/grand-line-v8/"
echo "    Dev:       cd grand-line-v8 && npm run dev"
echo "    Deploy:    npx vercel --prod --yes"
echo ""
echo "  Pipeline:    $WORKSPACE/shopify-product-pipeline/"
echo "    Dev:       python3 -m uvicorn api.app:app --port 8000"
echo "    Deploy:    railway up"
echo ""

if [ "$MISSING_ENV" = "1" ]; then
    echo "  ⚠️  IMPORTANTE: Copia los archivos .env antes de ejecutar."
    echo "  Sin ellos, la app no conecta a Firebase, Stripe, ni OpenAI."
    echo ""
fi

echo "  Para sincronizar cambios entre PCs:"
echo "    git pull    (bajar cambios del otro PC)"
echo "    git add -A && git commit -m 'mensaje' && git push"
echo ""
