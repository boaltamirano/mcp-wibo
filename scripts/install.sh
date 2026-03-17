#!/bin/bash
# ============================================================
#  Wibo MCP — Instalador (macOS / Linux)
#
#  Uso sin clonar:
#    curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.sh | bash
#
#  Con credenciales pre-configuradas:
#    curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.sh | \
#      WIBO_API_KEY="sk_xxx" MONGODB_URL="mongodb+srv://..." MONGODB_DATABASE="staging" bash
# ============================================================

set -e

REPO="boaltamirano/mcp-wibo"
BRANCH="main"
RAW_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"
INSTALL_DIR="$HOME/.wibo-mcp"

# ─── Detectar OS y ruta de Claude Desktop ─────────────────────
OS="$(uname -s)"
case "$OS" in
  Darwin)
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
    ;;
  Linux)
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
    ;;
  *)
    echo "OS no soportado: $OS. Usa install.ps1 para Windows."
    exit 1
    ;;
esac
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# ─── Colores ──────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Wibo MCP — Instalador v6.0         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── 1. Verificar Node.js ────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js no esta instalado.${NC}"
  echo ""
  if [ "$OS" = "Darwin" ]; then
    echo "  Instalalo con:  brew install node"
  else
    echo "  Instalalo con:  sudo apt install nodejs npm"
  fi
  echo "  O descarga en:  https://nodejs.org"
  echo ""
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Se requiere Node.js 18+. Tienes: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# ─── 2. Pedir credenciales (si no vienen por env) ────────────
if [ -z "$WIBO_API_KEY" ]; then
  echo ""
  echo -e "${BOLD}Credenciales${NC} (pidelas a tu admin si no las tienes):"
  echo ""
  read -rp "  WIBO_API_KEY: " WIBO_API_KEY
fi

if [ -z "$MONGODB_URL" ]; then
  read -rp "  MONGODB_URL: " MONGODB_URL
fi

if [ -z "$MONGODB_DATABASE" ]; then
  read -rp "  MONGODB_DATABASE [staging]: " MONGODB_DATABASE
  MONGODB_DATABASE="${MONGODB_DATABASE:-staging}"
fi

if [ -z "$WIBO_API_KEY" ] || [ -z "$MONGODB_URL" ]; then
  echo -e "${RED}✗ WIBO_API_KEY y MONGODB_URL son obligatorios.${NC}"
  exit 1
fi

# ─── 3. Descargar archivos desde GitHub ───────────────────────
echo ""
echo -e "${YELLOW}→${NC} Descargando desde GitHub..."

mkdir -p "$INSTALL_DIR/src/tools"

curl -fsSL "$RAW_URL/index.js" -o "$INSTALL_DIR/index.js"
curl -fsSL "$RAW_URL/package.json" -o "$INSTALL_DIR/package.json"

for f in config.js cache.js db.js store-resolver.js api.js server.js org-list.js; do
  curl -fsSL "$RAW_URL/src/$f" -o "$INSTALL_DIR/src/$f"
done

for f in admin.js stores.js payments.js api-commercial.js api-transactions.js api-payments.js api-features.js cache-stats.js report-guide.js; do
  curl -fsSL "$RAW_URL/src/tools/$f" -o "$INSTALL_DIR/src/tools/$f"
done

echo -e "${GREEN}✓${NC} Archivos descargados en $INSTALL_DIR"

# ─── 4. Guardar credenciales localmente ───────────────────────
cat > "$INSTALL_DIR/.env" << ENVEOF
MONGODB_URL=$MONGODB_URL
MONGODB_DATABASE=$MONGODB_DATABASE
WIBO_API_KEY=$WIBO_API_KEY
ENVEOF
chmod 600 "$INSTALL_DIR/.env"

echo -e "${GREEN}✓${NC} Credenciales guardadas (solo lectura para ti)"

# ─── 5. Instalar dependencias ────────────────────────────────
echo -e "${YELLOW}→${NC} Instalando dependencias..."
cd "$INSTALL_DIR"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓${NC} Dependencias instaladas"

# ─── 6. Configurar Claude Desktop ────────────────────────────
echo -e "${YELLOW}→${NC} Configurando Claude Desktop..."

mkdir -p "$CLAUDE_CONFIG_DIR"

# Usar node para hacer merge seguro del JSON (env vars via process.env)
WIBO_API_KEY="$WIBO_API_KEY" \
MONGODB_URL="$MONGODB_URL" \
MONGODB_DATABASE="$MONGODB_DATABASE" \
MCP_INSTALL_DIR="$INSTALL_DIR" \
node -e "
  const fs = require('fs');
  const configPath = process.argv[1];
  let config = {};
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers['wibo-reports'] = {
    command: 'node',
    args: [process.env.MCP_INSTALL_DIR + '/index.js'],
    env: {
      WIBO_API_KEY: process.env.WIBO_API_KEY,
      MONGODB_URL: process.env.MONGODB_URL,
      MONGODB_DATABASE: process.env.MONGODB_DATABASE
    }
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
" "$CLAUDE_CONFIG"
echo -e "${GREEN}✓${NC} Claude Desktop configurado"

# ─── 7. Listo ────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        ✅ Instalacion completa            ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Ahora:"
echo "  1. Abre Claude Desktop"
echo "  2. Si ya estaba abierto, reinicialo"
if [ "$OS" = "Darwin" ]; then
  echo "     (Cmd+Q y volver a abrir)"
fi
echo "  3. Preguntale algo como:"
echo ""
echo "     \"Que comercios hay disponibles?\""
echo "     \"Muestrame los errores de pago de Pollo Bravo\""
echo ""
echo "  Desinstalar:"
echo "    curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/uninstall.sh | bash"
echo ""
