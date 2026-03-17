# Wibo Reports MCP Server

MCP Server para Claude Desktop que conecta con la API de reportes de Wibo y MongoDB (read-only) para analytics de comercios.

## Arquitectura

```
Claude Desktop → MCP Server (stdio) → Wibo API (reportes)
                                     → MongoDB read-only (todas las colecciones)
                                     → Cache en memoria (TTL 6h)
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
| Cache | 6 horas para consultas frecuentes (stores, configs, conteos) |
| Write ops bloqueados | Operadores de modificacion ($set, $unset, $inc, etc.) rechazados |
| Rango fechas | Maximo 6 meses en reportes API (183 dias) |
| Reportes via API | Los 10 tools de API son la unica via para reportes, no query_mongodb |

## Cache en memoria

Consultas frecuentes se cachean por 6 horas para reducir carga en MongoDB.

### Operaciones cacheadas

| Operacion | Cache key | TTL |
|-----------|-----------|-----|
| Resolución de store por nombre | `resolve:{nombre}` | 6h |
| Búsqueda de stores | `stores:{query}:{limit}` | 6h |
| Configuración de store | `config:{storeId}` | 6h |
| Lista de organizaciones | `organizations:list` | 6h |
| Conteo sin filtro (query_mongodb) | `count:{coleccion}` | 6h |

### Operaciones NO cacheadas

- 10 tools de API Wibo (datos time-series)
- `get_payment_errors` y `get_payment_summary` (datos recientes)
- `query_mongodb` find/aggregate/distinct (consultas arbitrarias)
- `list_collections` y `get_collection_schema` (tools admin)

### Tool `cache_stats`

Muestra entradas activas y tamaño del cache.

## Flujo para reportes

Todo reporte necesita 1 organización + 1 comercio:

1. Si el usuario no dice de qué organización o comercio → usa `available_reports` (incluye lista de organizaciones) y pregunta cuál
2. Con la organización elegida → usa `search_stores` y pregunta qué comercio
3. Con comercio confirmado → ejecuta el tool de reporte

Si el usuario ya dice un comercio específico (ej: "ventas de Pollo Bravo"), ve directo al paso 3.

## Tools disponibles (19)

### Guia de reportes + organizaciones (1)
- `available_reports` — guia de reportes, lista de organizaciones activas **[cacheado 6h]**, flujo y ejemplos

### MongoDB (7)
- `list_collections` — listar todas las colecciones con conteo estimado
- `query_mongodb` — find, count, distinct, aggregate sobre cualquier coleccion (solo lectura, NO para reportes)
- `get_collection_schema` — ver estructura/campos de una coleccion
- `search_stores` — buscar comercios por nombre (disambiguation) **[cacheado]**
- `get_store_config` — config de metodos de pago, POS, delivery **[cacheado]**
- `get_payment_errors` — errores de pago por metodo
- `get_payment_summary` — resumen de aprobacion/rechazo por metodo

### API Wibo — Reportes (10) — rango maximo 6 meses
- `get_commercial_comparison`, `get_commercial_risk`, `get_transactions_daily`
- `get_transactions_totals`, `get_low_transactions`, `get_features_usage`
- `get_payments_rejected`, `get_payments_methods`, `get_system_pos_errors`
- `get_user_experience`

### Utilidad (1)
- `cache_stats` — estadisticas del cache en memoria

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
