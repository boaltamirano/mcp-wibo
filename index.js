// ============================================================
//  MCP Server — Wibo Reports API + MongoDB
//  v5.0 — Optimizado para producción (2.5M+ docs)
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MongoClient } from "mongodb";

// ─── Config ──────────────────────────────────────────────────
const API_BASE_URL = "https://wibo-api-reports-qa.wibodev.com/api/v1/reports";
const API_KEY = process.env.WIBO_API_KEY;
const MONGODB_URL = process.env.MONGODB_URL;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "staging";

// ─── Límites de seguridad ────────────────────────────────────
const QUERY_TIMEOUT_MS = 30_000;   // 30s máximo por query
const MAX_FIND_LIMIT = 200;        // máx docs en find
const DEFAULT_FIND_LIMIT = 50;
const MAX_AGGREGATE_LIMIT = 100;   // máx docs en aggregate
const MAX_SEARCH_LIMIT = 500;      // máx en search_stores
const FORBIDDEN_STAGES = ["$out", "$merge", "$collStats", "$indexStats", "$planCacheStats"];

// ─── MongoDB singleton ──────────────────────────────────────
let mongoClient = null;
let db = null;

async function getDb() {
  if (db) return db;
  mongoClient = new MongoClient(MONGODB_URL, {
    readPreference: "secondaryPreferred",
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });
  await mongoClient.connect();
  db = mongoClient.db(MONGODB_DATABASE);
  return db;
}

async function closeDb() {
  if (mongoClient) {
    await mongoClient.close().catch(() => {});
    mongoClient = null;
    db = null;
  }
}

process.on("SIGINT", closeDb);
process.on("SIGTERM", closeDb);

// ─── Resolver store por nombre ───────────────────────────────
async function resolveStore(storeName) {
  const database = await getDb();
  const regex = new RegExp(storeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const stores = await database
    .collection("stores")
    .find({ name: regex, is_deleted: { $ne: true } })
    .project({ _id: 1, name: 1, organization_id: 1, is_enabled: 1 })
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .limit(20)
    .toArray();

  if (stores.length === 0) {
    return { found: false, message: `No se encontró ningún comercio con "${storeName}". Usa search_stores para ver opciones.` };
  }
  if (stores.length === 1) {
    return { found: true, store: stores[0] };
  }
  const list = stores.map((s) => `- ${s.name} (${s.is_enabled ? "activo" : "inactivo"})`).join("\n");
  return {
    found: false,
    ambiguous: true,
    message: `Se encontraron ${stores.length} comercios:\n${list}\nPor favor indica el nombre exacto del comercio.`,
    stores,
  };
}

async function resolveOrThrow(storeName) {
  const result = await resolveStore(storeName);
  if (!result.found) throw new Error(result.message);
  return {
    organizationId: result.store.organization_id,
    storeId: result.store._id,
  };
}

// ─── Helper fetch API Wibo ───────────────────────────────────
async function wiboFetch(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Wibo API ${res.status}: ${JSON.stringify(err.message || err)}`);
  }
  return res.json();
}

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

// ─── Parámetros comunes ──────────────────────────────────────
const storeNameParam = z.string().describe(
  "Nombre del comercio. Ej: 'Kiosko Chacay Centro', 'Pollo Bravo'. Si no estás seguro del nombre exacto, usa search_stores primero."
);

const commonParams = {
  storeName: storeNameParam,
  period: z.enum(["day", "week", "month", "6months", "year"]).optional()
    .describe("Período predefinido: day, week, month, 6months, year. Default: month"),
  startDate: z.string().optional()
    .describe("Fecha inicio YYYY-MM-DD. Tiene prioridad sobre period"),
  endDate: z.string().optional()
    .describe("Fecha fin YYYY-MM-DD. Tiene prioridad sobre period"),
};

// ─── Servidor ────────────────────────────────────────────────
const server = new McpServer({ name: "wibo-reports", version: "5.0.0" });

// ════════════════════════════════════════════════════════════
//  TOOL: list_collections
// ════════════════════════════════════════════════════════════
server.tool(
  "list_collections",
  "Lista todas las colecciones disponibles en MongoDB con su conteo estimado de documentos. " +
  "Úsala PRIMERO para saber qué datos hay disponibles antes de hacer consultas.",
  {},
  async () => {
    const database = await getDb();
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    const names = collections.map((c) => c.name).sort();

    // Conteo estimado en paralelo (O(1) por colección, usa metadata)
    const counts = await Promise.all(
      names.map(async (name) => {
        const count = await database.collection(name).estimatedDocumentCount();
        return { name, estimatedDocuments: count };
      })
    );

    return ok({ total: counts.length, collections: counts });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: query_mongodb — consulta genérica de lectura
// ════════════════════════════════════════════════════════════
server.tool(
  "query_mongodb",
  "Ejecuta consultas de SOLO LECTURA en cualquier colección de MongoDB. " +
  "Soporta find, count, distinct y aggregate. Todas las queries tienen timeout de 30s. " +
  "IMPORTANTE para colecciones grandes (orders tiene 2.5M+ docs): " +
  "- Para contar sin filtro usa operation=count con filter vacío (usa estimado internamente). " +
  "- Siempre filtra por campos indexados (store_id, organization_id, created_at, status). " +
  "- En aggregates, pon $match PRIMERO para usar índices. " +
  "Colecciones principales: stores, orders, organizations, users, products, payments, coupons, wallets, sites.",
  {
    collection: z.string().describe(
      "Nombre de la colección: stores, orders, organizations, users, products, payments, sites, wallets, coupons, etc."
    ),
    operation: z.enum(["find", "count", "distinct", "aggregate"]).describe(
      "find = buscar documentos, count = contar, distinct = valores únicos, aggregate = pipeline de agregación"
    ),
    filter: z.string().optional().describe(
      'Filtro JSON. Ej: {"is_enabled": true}, {"store_id": "abc", "created_at": {"$gte": "2024-01-01"}}. Default: {}'
    ),
    projection: z.string().optional().describe(
      'Campos a devolver (solo find). JSON. Ej: {"name": 1, "status": 1, "_id": 0}'
    ),
    sort: z.string().optional().describe(
      'Ordenamiento (solo find). JSON. Ej: {"created_at": -1}. IMPORTANTE: ordenar por campos indexados.'
    ),
    limit: z.number().optional().describe(
      `Máximo de documentos (solo find). Default: ${DEFAULT_FIND_LIMIT}, máximo: ${MAX_FIND_LIMIT}`
    ),
    distinctField: z.string().optional().describe(
      "Campo para valores únicos (solo distinct). Ej: 'status', 'payment_details.payment_method.id'"
    ),
    pipeline: z.string().optional().describe(
      'Pipeline JSON (solo aggregate). SIEMPRE inicia con $match para filtrar. Ej: [{"$match": {"store_id": "x"}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]'
    ),
  },
  async ({ collection, operation, filter, projection, sort, limit, distinctField, pipeline }) => {
    const database = await getDb();
    const col = database.collection(collection);
    const parsedFilter = filter ? JSON.parse(filter) : {};
    const isEmptyFilter = Object.keys(parsedFilter).length === 0;

    switch (operation) {
      case "find": {
        const maxLimit = Math.min(limit || DEFAULT_FIND_LIMIT, MAX_FIND_LIMIT);
        const parsedProjection = projection ? JSON.parse(projection) : undefined;
        const parsedSort = sort ? JSON.parse(sort) : undefined;
        let cursor = col.find(parsedFilter).maxTimeMS(QUERY_TIMEOUT_MS);
        if (parsedProjection) cursor = cursor.project(parsedProjection);
        if (parsedSort) cursor = cursor.sort(parsedSort);
        cursor = cursor.limit(maxLimit);
        const docs = await cursor.toArray();
        return ok({ collection, operation, count: docs.length, limit: maxLimit, results: docs });
      }

      case "count": {
        // Para conteos sin filtro usar estimatedDocumentCount (O(1), no escanea)
        const count = isEmptyFilter
          ? await col.estimatedDocumentCount()
          : await col.countDocuments(parsedFilter, { maxTimeMS: QUERY_TIMEOUT_MS });
        return ok({
          collection,
          operation,
          filter: parsedFilter,
          count,
          note: isEmptyFilter ? "Conteo estimado (instantáneo)" : "Conteo exacto",
        });
      }

      case "distinct": {
        if (!distinctField) throw new Error("distinctField es requerido para operation=distinct");
        const values = await col.distinct(distinctField, parsedFilter, { maxTimeMS: QUERY_TIMEOUT_MS });
        return ok({ collection, operation, field: distinctField, count: values.length, values });
      }

      case "aggregate": {
        if (!pipeline) throw new Error("pipeline es requerido para operation=aggregate");
        const parsedPipeline = JSON.parse(pipeline);

        // Validar stages prohibidos
        for (const stage of parsedPipeline) {
          const stageKey = Object.keys(stage)[0];
          if (FORBIDDEN_STAGES.includes(stageKey)) {
            throw new Error(`Stage ${stageKey} no permitido (solo lectura).`);
          }
        }

        // Agregar $limit si no hay uno
        const hasLimit = parsedPipeline.some((s) => "$limit" in s);
        if (!hasLimit) parsedPipeline.push({ $limit: MAX_AGGREGATE_LIMIT });

        const results = await col.aggregate(parsedPipeline, {
          maxTimeMS: QUERY_TIMEOUT_MS,
          allowDiskUse: false,
        }).toArray();

        return ok({ collection, operation, count: results.length, results });
      }
    }
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: get_collection_schema — estructura de una colección
// ════════════════════════════════════════════════════════════
server.tool(
  "get_collection_schema",
  "Muestra la estructura (campos) de un documento de una colección. " +
  "Úsala para entender qué campos tiene una colección antes de hacer queries. " +
  "Devuelve los campos del primer documento encontrado como referencia.",
  {
    collection: z.string().describe("Nombre de la colección a inspeccionar"),
    sampleFilter: z.string().optional().describe('Filtro opcional para elegir un documento representativo. JSON. Default: {}'),
  },
  async ({ collection, sampleFilter }) => {
    const database = await getDb();
    const filter = sampleFilter ? JSON.parse(sampleFilter) : {};
    const doc = await database.collection(collection).findOne(filter, { maxTimeMS: QUERY_TIMEOUT_MS });

    if (!doc) return ok({ collection, message: "No se encontró ningún documento con ese filtro." });

    // Extraer estructura recursiva (hasta 3 niveles)
    function getSchema(obj, depth = 0) {
      if (depth > 3 || obj === null || obj === undefined) return typeof obj;
      if (Array.isArray(obj)) {
        return obj.length > 0 ? [`${getSchema(obj[0], depth + 1)}`] : ["empty array"];
      }
      if (typeof obj === "object" && !(obj instanceof Date)) {
        const schema = {};
        for (const [key, val] of Object.entries(obj)) {
          schema[key] = getSchema(val, depth + 1);
        }
        return schema;
      }
      return typeof obj;
    }

    return ok({ collection, fields: Object.keys(doc), schema: getSchema(doc) });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: search_stores
// ════════════════════════════════════════════════════════════
server.tool(
  "search_stores",
  "Busca comercios por nombre. Úsala SIEMPRE antes de consultar datos si no conoces el nombre exacto. " +
  "Devuelve lista de comercios con su nombre, organización y estado. " +
  "Para listar TODOS los comercios, usa query '*'.",
  {
    query: z.string().describe("Texto a buscar en el nombre del comercio. Ej: 'Kiosko', 'Pollo'. Usa '*' para listar todos."),
    limit: z.number().optional().describe(`Máximo de resultados. Default: 100, máximo: ${MAX_SEARCH_LIMIT}`),
  },
  async ({ query, limit = 100 }) => {
    const database = await getDb();
    const isAll = query === "*" || query === "" || query === "todos" || query === "all";
    const match = { is_deleted: { $ne: true } };
    if (!isAll) {
      match.name = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    const maxLimit = Math.min(limit, MAX_SEARCH_LIMIT);

    // Contar total (stores es colección pequeña, countDocuments es OK)
    const totalCount = await database.collection("stores").countDocuments(match, { maxTimeMS: QUERY_TIMEOUT_MS });

    const stores = await database.collection("stores").aggregate([
      { $match: match },
      {
        $lookup: {
          from: "organizations",
          localField: "organization_id",
          foreignField: "_id",
          as: "org",
        },
      },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          storeId: "$_id",
          storeName: "$name",
          organizationId: "$organization_id",
          orgName: { $ifNull: ["$org.name", "Sin organización"] },
          isEnabled: "$is_enabled",
        },
      },
      { $limit: maxLimit },
    ], { maxTimeMS: QUERY_TIMEOUT_MS }).toArray();

    if (stores.length === 0) {
      return ok({ message: `No se encontraron comercios con "${query}".`, total: 0, results: [] });
    }
    return ok({
      message: `Se encontraron ${totalCount} comercio(s)${totalCount > maxLimit ? ` (mostrando ${maxLimit})` : ""}.`,
      total: totalCount,
      showing: stores.length,
      results: stores,
    });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: get_store_config
// ════════════════════════════════════════════════════════════
server.tool(
  "get_store_config",
  "Muestra la configuración de un comercio: métodos de pago habilitados, integraciones POS activas, " +
  "métodos de entrega y configuración general.",
  {
    storeName: storeNameParam,
  },
  async ({ storeName }) => {
    const database = await getDb();
    const result = await resolveStore(storeName);
    if (!result.found) return ok(result);

    const store = await database.collection("stores").findOne(
      { _id: result.store._id },
      { projection: { name: 1, settings: 1, information: 1 }, maxTimeMS: QUERY_TIMEOUT_MS }
    );

    if (!store || !store.settings) {
      return ok({ message: "Comercio encontrado pero sin configuración de settings." });
    }

    const s = store.settings;

    const enabledPayments = [];
    const webpaySettings = s.payment_methods?.webpay?.settings || {};
    for (const [method, config] of Object.entries(webpaySettings)) {
      if (config.is_enabled) enabledPayments.push(method);
    }
    if (s.payment_methods?.wallet?.is_enabled) enabledPayments.push("wallet");
    if (s.payment_methods?.cards?.is_enabled) {
      for (const [method, config] of Object.entries(s.payment_methods.cards.settings || {})) {
        if (config.is_enabled) enabledPayments.push(`cards:${method}`);
      }
    }
    if (s.payment_methods?.benefits?.is_enabled) {
      for (const [method, config] of Object.entries(s.payment_methods.benefits.settings || {})) {
        if (config.is_enabled) enabledPayments.push(`benefits:${method}`);
      }
    }

    const activePOS = [];
    for (const [pos, enabled] of Object.entries(s.pos_settings || {})) {
      if (pos !== "additional_settings" && enabled) activePOS.push(pos);
    }

    const enabledDelivery = [];
    for (const [method, config] of Object.entries(s.delivery_methods || {})) {
      if (config.is_enabled) enabledDelivery.push(method);
    }

    return ok({
      storeName: store.name,
      paymentMethods: enabledPayments.length > 0 ? enabledPayments : ["Ninguno habilitado"],
      posIntegrations: activePOS.length > 0 ? activePOS : ["Ninguno activo"],
      deliveryMethods: enabledDelivery.length > 0 ? enabledDelivery : ["Ninguno habilitado"],
      features: {
        tips: s.tips || false,
        coupons: s.coupons || false,
        autoaccept: s.autoaccept || false,
        isCatalog: s.is_catalog || false,
        showStock: s.show_stock || false,
        closed: s.closed || false,
      },
    });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: get_payment_errors
// ════════════════════════════════════════════════════════════
server.tool(
  "get_payment_errors",
  "Analiza errores de pago de cualquier método (getnet, transbank, fpay, mercadopago, klap, niubiz, etc). " +
  "Agrupa errores por código y mensaje, muestra frecuencia y porcentaje.",
  {
    storeName: storeNameParam,
    paymentMethod: z.string().optional().describe(
      "Método de pago a filtrar: getnet, transbank, fpay, mercadopago, klap, niubiz, cash, etc. Omitir = todos."
    ),
    months: z.number().optional().describe("Meses hacia atrás a consultar. Default: 3"),
  },
  async ({ storeName, paymentMethod, months = 3 }) => {
    const { storeId } = await resolveOrThrow(storeName);
    const database = await getDb();

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const match = {
      store_id: storeId,
      created_at: { $gte: since.toISOString() },
    };
    if (paymentMethod) {
      match["payment_details.payment_method.id"] = paymentMethod;
    }

    const totalOrders = await database.collection("orders").countDocuments(match, { maxTimeMS: QUERY_TIMEOUT_MS });

    const errorAgg = await database.collection("orders").aggregate([
      { $match: { ...match, "payment.request.data.response.responseCode": { $exists: true, $ne: 0 } } },
      {
        $group: {
          _id: {
            responseCode: "$payment.request.data.response.responseCode",
            responseMessage: "$payment.request.data.response.responseMessage",
            paymentMethod: "$payment_details.payment_method.id",
          },
          count: { $sum: 1 },
          lastOccurrence: { $max: "$created_at" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

    const noResponseCount = await database.collection("orders").countDocuments({
      ...match,
      "payment.request.data.response": { $exists: false },
      "payment_details.payment_method.id": { $exists: true },
    }, { maxTimeMS: QUERY_TIMEOUT_MS });

    const errors = errorAgg.map((e) => ({
      paymentMethod: e._id.paymentMethod || "desconocido",
      responseCode: e._id.responseCode,
      responseMessage: e._id.responseMessage || "Sin mensaje",
      count: e.count,
      percentage: totalOrders > 0 ? `${((e.count / totalOrders) * 100).toFixed(1)}%` : "N/A",
      lastOccurrence: e.lastOccurrence,
    }));

    return ok({
      storeName,
      period: `Últimos ${months} meses`,
      totalOrders,
      totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
      ordersWithoutPaymentResponse: noResponseCount,
      errorsByType: errors,
    });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: get_payment_summary
// ════════════════════════════════════════════════════════════
server.tool(
  "get_payment_summary",
  "Resumen de pagos por método: total de órdenes, aprobadas, rechazadas y tasa de éxito por cada método de pago.",
  {
    storeName: storeNameParam,
    months: z.number().optional().describe("Meses hacia atrás. Default: 3"),
  },
  async ({ storeName, months = 3 }) => {
    const { storeId } = await resolveOrThrow(storeName);
    const database = await getDb();

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const summary = await database.collection("orders").aggregate([
      {
        $match: {
          store_id: storeId,
          created_at: { $gte: since.toISOString() },
          "payment_details.payment_method.id": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$payment_details.payment_method.id",
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$payment.request.data.response.responseCode", 0] }, 1, 0] },
          },
          totalAmount: { $sum: { $ifNull: ["$payment_details.amounts.total", 0] } },
        },
      },
      { $sort: { total: -1 } },
    ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

    const results = summary.map((s) => ({
      paymentMethod: s._id,
      totalOrders: s.total,
      approved: s.approved,
      rejected: s.total - s.approved,
      approvalRate: s.total > 0 ? `${((s.approved / s.total) * 100).toFixed(1)}%` : "N/A",
      totalAmount: s.totalAmount,
    }));

    return ok({
      storeName,
      period: `Últimos ${months} meses`,
      paymentMethods: results,
      totals: {
        orders: results.reduce((sum, r) => sum + r.totalOrders, 0),
        approved: results.reduce((sum, r) => sum + r.approved, 0),
        rejected: results.reduce((sum, r) => sum + r.rejected, 0),
      },
    });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOLS de API Wibo
// ════════════════════════════════════════════════════════════

async function callWiboWithStore(path, storeName, extraParams = {}) {
  const { organizationId, storeId } = await resolveOrThrow(storeName);
  const data = await wiboFetch(path, { organizationId, storeId, ...extraParams });
  return ok(data);
}

server.tool("get_commercial_comparison",
  "Compara métricas de ventas entre el período actual y el anterior. Para: desempeño, ventas, crecimiento, ranking.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/commercial/comparison", storeName, { period, startDate, endDate })
);

server.tool("get_commercial_risk",
  "Detecta tiendas en riesgo: caída de ventas y tiendas sin actividad. Para: alertas, riesgos, tiendas inactivas.",
  { ...commonParams,
    dropThreshold: z.number().optional().describe("% mínimo de caída para alertar. Default: 60"),
    zeroDays: z.number().optional().describe("Días sin ventas para considerar inactiva. Default: 3"),
  },
  async ({ storeName, period, startDate, endDate, dropThreshold, zeroDays }) =>
    callWiboWithStore("/commercial/risk", storeName, { period, startDate, endDate, dropThreshold, zeroDays })
);

server.tool("get_transactions_daily",
  "Transacciones diarias por tienda con métricas y promedios. Para: actividad diaria, ventas diarias.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/transactions/daily", storeName, { period, startDate, endDate })
);

server.tool("get_transactions_totals",
  "Totales agregados de toda la plataforma. Para: resumen global, KPIs totales.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/transactions/totals", storeName, { period, startDate, endDate })
);

server.tool("get_low_transactions",
  "Tiendas con transacciones semanales bajo umbral mínimo. Para: bajo rendimiento, alertas.",
  { ...commonParams,
    threshold: z.number().optional().describe("Umbral mínimo semanal. Default: 140"),
  },
  async ({ storeName, period, startDate, endDate, threshold }) =>
    callWiboWithStore("/transactions/low-transactions", storeName, { period, startDate, endDate, threshold })
);

server.tool("get_features_usage",
  "Adopción de funcionalidades: cupones, wallet, beneficiarios, promociones.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/features/usage", storeName, { period, startDate, endDate })
);

server.tool("get_payments_rejected",
  "Transacciones rechazadas: desglose por motivo y método de pago.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/payments/rejected", storeName, { period, startDate, endDate })
);

server.tool("get_payments_methods",
  "Estadísticas por método de pago: aprobación, rechazo, errores técnicos.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/payments/methods", storeName, { period, startDate, endDate })
);

server.tool("get_system_pos_errors",
  "Errores del sistema POS agrupados por sistema y tipo. Para: fallas de fudo, mrc, justo, nutriserv.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/system/pos-errors", storeName, { period, startDate, endDate })
);

server.tool("get_user_experience",
  "Métricas de UX en el flujo de compra. Para: abandono, reintentos, completitud.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/user-experience", storeName, { period, startDate, endDate })
);

// ─── Iniciar ────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Wibo Reports MCP v5.0 — 17 tools (10 API + 7 MongoDB) — Optimizado para producción");
