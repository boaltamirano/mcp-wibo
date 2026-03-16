# ============================================================
#  Wibo MCP — Desinstalador (Windows PowerShell)
#  irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/uninstall.ps1 | iex
# ============================================================

$INSTALL_DIR = "$env:USERPROFILE\.wibo-mcp"
$CLAUDE_CONFIG = "$env:APPDATA\Claude\claude_desktop_config.json"

Write-Host ""
Write-Host "Desinstalando Wibo MCP..." -ForegroundColor Yellow
Write-Host ""

# Eliminar carpeta
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Recurse -Force $INSTALL_DIR
    Write-Host "[OK] Carpeta $INSTALL_DIR eliminada" -ForegroundColor Green
} else {
    Write-Host "-> Carpeta $INSTALL_DIR no existe" -ForegroundColor Yellow
}

# Remover de Claude Desktop config
if (Test-Path $CLAUDE_CONFIG) {
    try {
        $config = Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json
        if ($config.mcpServers -and $config.mcpServers.'wibo-reports') {
            $servers = @{}
            $config.mcpServers.PSObject.Properties | ForEach-Object {
                if ($_.Name -ne "wibo-reports") {
                    $servers[$_.Name] = $_.Value
                }
            }
            $newConfig = @{ mcpServers = $servers }
            $newConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $CLAUDE_CONFIG -Encoding UTF8
            Write-Host "[OK] Configuracion de Claude Desktop actualizada" -ForegroundColor Green
        } else {
            Write-Host "-> No habia configuracion de wibo-reports" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "-> No se pudo modificar la configuracion de Claude" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Wibo MCP desinstalado. Reinicia Claude Desktop." -ForegroundColor Green
Write-Host ""
