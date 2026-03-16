# Wibo Reports MCP Server

MCP Server para Claude Desktop que conecta con la API de reportes de Wibo y MongoDB (read-only) para analytics de comercios.

## Arquitectura

```
Claude Desktop → MCP Server (stdio) → Wibo API (reportes)
                                     → MongoDB read-only (todas las colecciones)
```

## Variables de entorno (requeridas)

| Variable | Descripcion |
|----------|-------------|
| `WIBO_API_KEY` | API key para Wibo Reports API |
| `MONGODB_URL` | Connection string de MongoDB |
| `MONGODB_DATABASE` | Nombre de la base de datos (default: `staging`) |

**Nunca hardcodear credenciales en el codigo.**

## Setup para produccion

### 1. Crear usuario read-only en MongoDB

```javascript
// Ejecutar en mongosh conectado como admin a la DB de produccion
db.createUser({
  user: "mcp_readonly",
  pwd: "GENERAR_PASSWORD_SEGURO",
  roles: [{ role: "read", db: "NOMBRE_DB_PRODUCCION" }]
})
```

### 2. Usar el connection string del usuario read-only

```
MONGODB_URL=mongodb+srv://mcp_readonly:PASSWORD@cluster/...
MONGODB_DATABASE=NOMBRE_DB_PRODUCCION
```

### 3. Protecciones incluidas en el codigo

| Proteccion | Detalle |
|------------|---------|
| Timeout | 30s maximo por query (`maxTimeMS`) |
| Limite find | Max 200 documentos por consulta |
| Limite aggregate | Max 100 resultados |
| Sin escritura | Stages `$out`, `$merge` bloqueados |
| Sin disk spill | `allowDiskUse: false` en aggregates |
| Pool limitado | Max 5 conexiones simultaneas |
| Read preference | `secondaryPreferred` (no impacta primary) |
| Conteos eficientes | `estimatedDocumentCount` para conteos sin filtro (O(1)) |

## Tools disponibles (17)

### Genericos MongoDB (3)
- `list_collections` — listar todas las colecciones con conteo estimado
- `query_mongodb` — find, count, distinct, aggregate sobre cualquier coleccion
- `get_collection_schema` — ver estructura/campos de una coleccion

### Especializados MongoDB (4)
- `search_stores` — buscar comercios por nombre (disambiguation)
- `get_store_config` — config de metodos de pago, POS, delivery
- `get_payment_errors` — errores de pago por metodo
- `get_payment_summary` — resumen de aprobacion/rechazo por metodo

### API Wibo (10)
- `get_commercial_comparison`, `get_commercial_risk`, `get_transactions_daily`
- `get_transactions_totals`, `get_low_transactions`, `get_features_usage`
- `get_payments_rejected`, `get_payments_methods`, `get_system_pos_errors`
- `get_user_experience`

## Buenas practicas para queries en colecciones grandes

La coleccion `orders` tiene 2.5M+ documentos. Para queries eficientes:

- **Siempre filtrar** por campos indexados: `store_id`, `organization_id`, `created_at`, `status`
- **En aggregates**, poner `$match` como primera etapa
- **Para conteos totales** sin filtro, usar `count` (usa `estimatedDocumentCount` internamente)
- **Evitar** sorts sobre campos no indexados en colecciones grandes

## Desarrollo

```bash
npm install
MONGODB_URL="..." MONGODB_DATABASE="..." WIBO_API_KEY="..." node index.js
```
