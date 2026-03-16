# Wibo Reports MCP Server

MCP Server para Claude Desktop que conecta con la API de reportes de Wibo y MongoDB (read-only) para analytics de comercios.

## Arquitectura

```
Claude Desktop → MCP Server (stdio) → Wibo API (reportes)
                                     → MongoDB (stores, orders, pagos)
```

## Variables de entorno (requeridas)

| Variable | Descripción |
|----------|-------------|
| `WIBO_API_KEY` | API key para Wibo Reports API |
| `MONGODB_URL` | Connection string de MongoDB |
| `MONGODB_DATABASE` | Nombre de la base de datos (default: `staging`) |

Las variables se configuran en `claude_desktop_config.json` y/o `.env`. **Nunca hardcodear credenciales en el código.**

## Tools disponibles (14)

### MongoDB directos (4)
- `search_stores` — buscar comercios por nombre (disambiguation)
- `get_store_config` — config de métodos de pago, POS, delivery
- `get_payment_errors` — errores de pago por método (getnet, transbank, fpay, etc.)
- `get_payment_summary` — resumen de aprobación/rechazo por método de pago

### API Wibo (10)
- `get_commercial_comparison` — comparación de ventas entre períodos
- `get_commercial_risk` — tiendas en riesgo (caídas, inactivas)
- `get_transactions_daily` — transacciones diarias
- `get_transactions_totals` — totales de la plataforma
- `get_low_transactions` — tiendas con bajo volumen
- `get_features_usage` — adopción de features
- `get_payments_rejected` — pagos rechazados
- `get_payments_methods` — estadísticas por método de pago
- `get_system_pos_errors` — errores de POS
- `get_user_experience` — métricas de UX

## Flujo de resolución de comercios

1. El usuario dice un nombre parcial (ej: "Kiosko")
2. `search_stores` busca en MongoDB con regex case-insensitive
3. Si hay 1 resultado → se usa directamente
4. Si hay múltiples → Claude pregunta cuál
5. Si hay 0 → Claude informa que no se encontró
6. Los demás tools reciben `storeName` y resuelven internamente a `organizationId` + `storeId`

## Métodos de pago soportados

getnet, transbank, fpay, fpaycmr, mercadopago, mercadopagopoint, klap, klappos,
niubiz, niubizqr, cash, cash_payment, redelcom, sodexobeneficio, tillbox, table,
amipass, corporate_benefit, payroll, payroll_pwa, wallet, vouchers, beneficiary_payment,
bank_transfer, local_debit, local_credit, edenred, local_sodexo, clip, evopayments

## POS integrations

fudo, mrc, justo, nutriserv, rappi_turbo, popapp, toteat, aloha, resto, ngr, geco, tactech

## Desarrollo

```bash
npm install
node index.js  # requiere las variables de entorno
```

## Colecciones MongoDB usadas

- `stores` — comercios (name, organization_id, settings)
- `organizations` — organizaciones (name, country)
- `orders` — órdenes (payment, payment_details, store_id, created_at)
