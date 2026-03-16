# Wibo MCP

Conecta Claude Desktop con los datos de Wibo para consultar comercios, ventas, pagos y errores usando lenguaje natural.

## Instalacion rapida (sin clonar)

### macOS / Linux

Abre **Terminal** y pega:

```bash
curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.sh | bash
```

### Windows

Abre **PowerShell** y pega:

```powershell
irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.ps1 | iex
```

### Con credenciales pre-configuradas

Si tu admin te paso las credenciales en un solo comando, copia y pega directamente:

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.sh | \
  WIBO_API_KEY="tu_api_key" MONGODB_URL="tu_mongodb_url" MONGODB_DATABASE="staging" bash
```

**Windows:**
```powershell
$env:WIBO_API_KEY="tu_api_key"; $env:MONGODB_URL="tu_mongodb_url"; $env:MONGODB_DATABASE="staging"; irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/install.ps1 | iex
```

## Requisitos

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Claude Desktop** instalado

## Despues de instalar

1. Abre (o reinicia) Claude Desktop
2. El icono de herramientas confirma que el MCP esta activo
3. Preguntale lo que necesites

## Que puedes preguntar

| Quieres saber... | Pregunta ejemplo |
|-------------------|-----------------|
| Buscar comercios | "Que comercios hay disponibles?" |
| Ventas | "Como le fue a Pollo Bravo este mes?" |
| Riesgos | "Que tiendas tienen alertas criticas?" |
| Errores de pago | "Errores de Getnet en los ultimos 3 meses" |
| Configuracion | "Que metodos de pago tiene Pollo Bravo?" |
| Comparativas | "Compara las ventas de esta semana vs la anterior" |

## Desinstalar

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/uninstall.sh | bash
```

**Windows:**
```powershell
irm https://raw.githubusercontent.com/boaltamirano/mcp-wibo/main/scripts/uninstall.ps1 | iex
```

## Herramientas disponibles (14)

| Herramienta | Fuente | Descripcion |
|-------------|--------|-------------|
| search_stores | MongoDB | Buscar comercios por nombre |
| get_store_config | MongoDB | Configuracion del comercio |
| get_payment_errors | MongoDB | Errores de pago por metodo |
| get_payment_summary | MongoDB | Resumen aprobacion/rechazo |
| get_commercial_comparison | API | Comparacion de ventas |
| get_commercial_risk | API | Tiendas en riesgo |
| get_transactions_daily | API | Transacciones diarias |
| get_transactions_totals | API | Totales plataforma |
| get_low_transactions | API | Tiendas bajo volumen |
| get_features_usage | API | Adopcion de features |
| get_payments_rejected | API | Pagos rechazados |
| get_payments_methods | API | Stats por metodo |
| get_system_pos_errors | API | Errores de POS |
| get_user_experience | API | Metricas de UX |
