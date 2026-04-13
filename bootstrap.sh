#!/bin/bash
# ============================================
# BOOTSTRAP — Ejecuta esto en el PC nuevo:
#   /bin/bash -c "$(curl -fsSL https://gist.githubusercontent.com/Tabo-ecom/GIST_ID/raw/bootstrap.sh)"
#   o simplemente: bash bootstrap.sh
# ============================================
set -e

echo ""
echo "  🏴‍☠️ GRAND LINE — Bootstrap"
echo ""

# 1. Instalar Homebrew si no existe (macOS)
if [[ "$OSTYPE" == "darwin"* ]] && ! command -v brew &> /dev/null; then
    echo "Instalando Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
fi

# 2. Instalar GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "Instalando GitHub CLI..."
    brew install gh 2>/dev/null || sudo apt install gh -y 2>/dev/null || { echo "Instala gh manualmente: https://cli.github.com"; exit 1; }
fi

# 3. Autenticar
if ! gh auth status &> /dev/null; then
    echo "Autenticando con GitHub..."
    gh auth login --web --git-protocol https
    gh auth setup-git
fi

# 4. Descargar y ejecutar el setup completo
echo "Descargando setup script..."
TMPSCRIPT=$(mktemp)
gh api repos/Tabo-ecom/Grandline-antigravity/contents/setup-new-pc.sh --jq '.content' | base64 -d > "$TMPSCRIPT"
bash "$TMPSCRIPT"
rm -f "$TMPSCRIPT"
