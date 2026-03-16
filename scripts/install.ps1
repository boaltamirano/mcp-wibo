# ============================================================
#  Wibo MCP — Instalador (Windows PowerShell)
#
#  Uso sin clonar:
#    irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.ps1 | iex
#
#  Con credenciales pre-configuradas:
#    $env:WIBO_API_KEY="sk_xxx"; $env:MONGODB_URL="mongodb+srv://..."; $env:MONGODB_DATABASE="staging"; irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.ps1 | iex
# ============================================================

$ErrorActionPreference = "Stop"

$REPO = "boaltamirano/mcp-wibo"
$BRANCH = "main"
$RAW_URL = "https://raw.githubusercontent.com/$REPO/$BRANCH"
$INSTALL_DIR = "$env:USERPROFILE\.wibo-mcp"
$CLAUDE_CONFIG_DIR = "$env:APPDATA\Claude"
$CLAUDE_CONFIG = "$CLAUDE_CONFIG_DIR\claude_desktop_config.json"

Write-Host ""
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host "|       Wibo MCP - Instalador v6.0 (Windows)   |" -ForegroundColor Cyan
Write-Host "+==============================================+" -ForegroundColor Cyan
Write-Host ""

# --- 1. Verificar Node.js ---
try {
    $nodeVersion = (node -v) -replace 'v', ''
    $major = [int]($nodeVersion.Split('.')[0])
    if ($major -lt 18) {
        Write-Host "X Se requiere Node.js 18+. Tienes: v$nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Node.js v$nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "X Node.js no esta instalado." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Descargalo en: https://nodejs.org"
    Write-Host ""
    exit 1
}

# --- 2. Pedir credenciales ---
if (-not $env:WIBO_API_KEY) {
    Write-Host ""
    Write-Host "Credenciales (pidelas a tu admin si no las tienes):" -ForegroundColor Yellow
    Write-Host ""
    $env:WIBO_API_KEY = Read-Host "  WIBO_API_KEY"
}

if (-not $env:MONGODB_URL) {
    $env:MONGODB_URL = Read-Host "  MONGODB_URL"
}

if (-not $env:MONGODB_DATABASE) {
    $input = Read-Host "  MONGODB_DATABASE [staging]"
    $env:MONGODB_DATABASE = if ($input) { $input } else { "staging" }
}

if (-not $env:WIBO_API_KEY -or -not $env:MONGODB_URL) {
    Write-Host "X WIBO_API_KEY y MONGODB_URL son obligatorios." -ForegroundColor Red
    exit 1
}

# --- 3. Descargar archivos ---
Write-Host ""
Write-Host "-> Descargando desde GitHub..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$INSTALL_DIR\src\tools" | Out-Null

Invoke-WebRequest -Uri "$RAW_URL/index.js" -OutFile "$INSTALL_DIR\index.js" -UseBasicParsing
Invoke-WebRequest -Uri "$RAW_URL/package.json" -OutFile "$INSTALL_DIR\package.json" -UseBasicParsing

$srcFiles = @("config.js", "cache.js", "db.js", "auth.js", "store-resolver.js", "api.js", "server.js")
foreach ($f in $srcFiles) {
    Invoke-WebRequest -Uri "$RAW_URL/src/$f" -OutFile "$INSTALL_DIR\src\$f" -UseBasicParsing
}

$toolFiles = @("admin.js", "stores.js", "payments.js", "api-commercial.js", "api-transactions.js", "api-payments.js", "api-features.js", "cache-stats.js")
foreach ($f in $toolFiles) {
    Invoke-WebRequest -Uri "$RAW_URL/src/tools/$f" -OutFile "$INSTALL_DIR\src\tools\$f" -UseBasicParsing
}

Write-Host "[OK] Archivos descargados en $INSTALL_DIR" -ForegroundColor Green

# --- 4. Guardar credenciales ---
@"
MONGODB_URL=$($env:MONGODB_URL)
MONGODB_DATABASE=$($env:MONGODB_DATABASE)
WIBO_API_KEY=$($env:WIBO_API_KEY)
"@ | Out-File -FilePath "$INSTALL_DIR\.env" -Encoding UTF8

Write-Host "[OK] Credenciales guardadas" -ForegroundColor Green

# --- 5. Instalar dependencias ---
Write-Host "-> Instalando dependencias..." -ForegroundColor Yellow

Push-Location $INSTALL_DIR
npm install --silent 2>&1 | Select-Object -Last 1
Pop-Location

Write-Host "[OK] Dependencias instaladas" -ForegroundColor Green

# --- 6. Configurar Claude Desktop ---
Write-Host "-> Configurando Claude Desktop..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $CLAUDE_CONFIG_DIR | Out-Null

$indexPath = "$INSTALL_DIR\index.js" -replace '\\', '/'

$mcpEntry = @{
    command = "node"
    args = @($indexPath)
    env = @{
        WIBO_API_KEY = $env:WIBO_API_KEY
        MONGODB_URL = $env:MONGODB_URL
        MONGODB_DATABASE = $env:MONGODB_DATABASE
    }
}

$config = @{ mcpServers = @{} }
if (Test-Path $CLAUDE_CONFIG) {
    try {
        $config = Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json
        if (-not $config.mcpServers) {
            $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{} -Force
        }
    } catch {
        $config = @{ mcpServers = @{} }
    }
}

# Convertir a hashtable si es PSCustomObject
if ($config -is [PSCustomObject]) {
    $servers = @{}
    if ($config.mcpServers) {
        $config.mcpServers.PSObject.Properties | ForEach-Object {
            $servers[$_.Name] = $_.Value
        }
    }
    $servers["wibo-reports"] = $mcpEntry
    $newConfig = @{ mcpServers = $servers }
} else {
    $config.mcpServers["wibo-reports"] = $mcpEntry
    $newConfig = $config
}

$newConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $CLAUDE_CONFIG -Encoding UTF8

Write-Host "[OK] Claude Desktop configurado" -ForegroundColor Green

# --- 7. Listo ---
Write-Host ""
Write-Host "+==============================================+" -ForegroundColor Green
Write-Host "|        Instalacion completa                  |" -ForegroundColor Green
Write-Host "+==============================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  Ahora:"
Write-Host "  1. Abre Claude Desktop"
Write-Host "  2. Si ya estaba abierto, reinicialo"
Write-Host "  3. Preguntale algo como:"
Write-Host ""
Write-Host '     "Que comercios hay disponibles?"'
Write-Host '     "Muestrame los errores de pago de Pollo Bravo"'
Write-Host ""
Write-Host "  Desinstalar:"
Write-Host "    irm https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/uninstall.ps1 | iex"
Write-Host ""

# Limpiar variables de entorno de la sesion
$env:WIBO_API_KEY = $null
$env:MONGODB_URL = $null
$env:MONGODB_DATABASE = $null
