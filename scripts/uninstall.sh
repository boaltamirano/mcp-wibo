#!/bin/bash
# ============================================================
#  Wibo MCP — Desinstalador (macOS / Linux)
#  curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/uninstall.sh | bash
# ============================================================

INSTALL_DIR="$HOME/.wibo-mcp"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

OS="$(uname -s)"
case "$OS" in
  Darwin) CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
  Linux)  CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json" ;;
  *)      CLAUDE_CONFIG="" ;;
esac

echo ""
echo "Desinstalando Wibo MCP..."
echo ""

# Eliminar carpeta
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo -e "${GREEN}✓${NC} Carpeta $INSTALL_DIR eliminada"
else
  echo -e "${YELLOW}→${NC} Carpeta $INSTALL_DIR no existe"
fi

# Remover de Claude Desktop config
if [ -n "$CLAUDE_CONFIG" ] && [ -f "$CLAUDE_CONFIG" ]; then
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
    if (config.mcpServers && config.mcpServers['wibo-reports']) {
      delete config.mcpServers['wibo-reports'];
      fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
      console.log('✓ Configuracion de Claude Desktop actualizada');
    } else {
      console.log('→ No habia configuracion de wibo-reports');
    }
  " 2>/dev/null || echo -e "${YELLOW}→${NC} No se pudo modificar la configuracion de Claude"
fi

echo ""
echo -e "${GREEN}✅ Wibo MCP desinstalado.${NC} Reinicia Claude Desktop."
echo ""
