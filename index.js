// ============================================================
//  MCP Server — Wibo Reports API + MongoDB
//  v4.0 — Consultas dinámicas a MongoDB + API Wibo
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

// ─── MongoDB singleton ──────────────────────────────────────
let mongoClient = null;
let db = null;

async function getDb() {
  if (db) return db;
  mongoClient = new MongoClient(MONGODB_URL, {
    readPreference: "secondaryPreferred",
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

// Resolver y validar — retorna { organizationId, storeId } o lanza error
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
const server = new McpServer({ name: "wibo-reports", version: "4.0.0" });

// Stages de escritura prohibidos en aggregate
const FORBIDDEN_STAGES = ["$out", "$merge"];

// ════════════════════════════════════════════════════════════
//  TOOL: list_collections — listar colecciones disponibles
// ════════════════════════════════════════════════════════════
server.tool(
  "list_collections",
  "Lista todas las colecciones disponibles en MongoDB con su conteo de documentos. " +
  "Úsala PRIMERO para saber qué datos hay disponibles antes de hacer consultas.",
  {},
  async () => {
    const database = await getDb();
    const collections = await database.listCollections().toArray();
    const results = [];
    for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await database.collection(col.name).estimatedDocumentCount();
      results.push({ name: col.name, documents: count });
    }
    return ok({ total: results.length, collections: results });
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: query_mongodb — consulta genérica de lectura
// ════════════════════════════════════════════════════════════
server.tool(
  "query_mongodb",
  "Ejecuta consultas de SOLO LECTURA en cualquier colección de MongoDB. " +
  "Soporta find, count, distinct y aggregate. " +
  "Úsala para cualquier consulta de datos: total de comercios, usuarios, órdenes, filtros complejos, agrupaciones, etc. " +
  "Colecciones principales: stores, orders, organizations, users, products, payments, coupons, wallets, sites, etc. " +
  "Usa list_collections para ver todas las disponibles.",
  {
    collection: z.string().describe(
      "Nombre de la colección: stores, orders, organizations, users, products, payments, sites, wallets, coupons, etc."
    ),
    operation: z.enum(["find", "count", "distinct", "aggregate"]).describe(
      "find = buscar documentos, count = contar, distinct = valores únicos de un campo, aggregate = pipeline de agregación"
    ),
    filter: z.string().optional().describe(
      'Filtro JSON. Ej: {"is_enabled": true}, {"status": 800}, {"created_at": {"$gte": "2024-01-01"}}. Default: {}'
    ),
    projection: z.string().optional().describe(
      'Campos a devolver (solo find). JSON. Ej: {"name": 1, "status": 1, "_id": 0}'
    ),
    sort: z.string().optional().describe(
      'Ordenamiento (solo find). JSON. Ej: {"created_at": -1} para más recientes primero'
    ),
    limit: z.number().optional().describe(
      "Máximo de documentos (solo find). Default: 50, máximo: 200"
    ),
    distinctField: z.string().optional().describe(
      "Campo para obtener valores únicos (solo operation=distinct). Ej: 'status', 'payment_details.payment_method.id'"
    ),
    pipeline: z.string().optional().describe(
      'Pipeline de agregación JSON (solo operation=aggregate). Ej: [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]'
    ),
  },
  async ({ collection, operation, filter, projection, sort, limit, distinctField, pipeline }) => {
    const database = await getDb();
    const col = database.collection(collection);

    const parsedFilter = filter ? JSON.parse(filter) : {};
    const maxLimit = Math.min(limit || 50, 200);

    switch (operation) {
      case "find": {
        const parsedProjection = projection ? JSON.parse(projection) : undefined;
        const parsedSort = sort ? JSON.parse(sort) : undefined;
        let cursor = col.find(parsedFilter);
        if (parsedProjection) cursor = cursor.project(parsedProjection);
        if (parsedSort) cursor = cursor.sort(parsedSort);
        cursor = cursor.limit(maxLimit);
        const docs = await cursor.toArray();
        return ok({ collection, operation, count: docs.length, limit: maxLimit, results: docs });
      }

      case "count": {
        const count = await col.countDocuments(parsedFilter);
        return ok({ collection, operation, filter: parsedFilter, count });
      }

      case "distinct": {
        if (!distinctField) throw new Error("distinctField es requerido para operation=distinct");
        const values = await col.distinct(distinctField, parsedFilter);
        return ok({ collection, operation, field: distinctField, count: values.length, values });
      }

      case "aggregate": {
        if (!pipeline) throw new Error("pipeline es requerido para operation=aggregate");
        const parsedPipeline = JSON.parse(pipeline);
        // Validar que no hay stages de escritura
        for (const stage of parsedPipeline) {
          const stageKey = Object.keys(stage)[0];
          if (FORBIDDEN_STAGES.includes(stageKey)) {
            throw new Error(`Stage ${stageKey} no está permitido. Solo lectura.`);
          }
        }
        // Agregar $limit al final si no hay uno
        const hasLimit = parsedPipeline.some((s) => "$limit" in s);
        if (!hasLimit) parsedPipeline.push({ $limit: maxLimit });
        const results = await col.aggregate(parsedPipeline).toArray();
        return ok({ collection, operation, count: results.length, results });
      }
    }
  }
);

// ════════════════════════════════════════════════════════════
//  TOOL: search_stores — buscar comercios por nombre
// ════════════════════════════════════════════════════════════
server.tool(
  "search_stores",
  "Busca comercios por nombre. Úsala SIEMPRE antes de consultar datos si no conoces el nombre exacto. " +
  "Devuelve lista de comercios con su nombre, organización y estado. " +
  "Si el usuario dice un nombre parcial o ambiguo (ej: 'Kiosko'), esta herramienta muestra las opciones. " +
  "Para listar TODOS los comercios, usa query vacío o '*'.",
  {
    query: z.string().describe("Texto a buscar en el nombre del comercio. Ej: 'Kiosko', 'Pollo'. Usa '*' para listar todos."),
    limit: z.number().optional().describe("Máximo de resultados. Default: 100"),
  },
  async ({ query, limit = 100 }) => {
    const database = await getDb();
    const isAll = query === "*" || query === "" || query === "todos" || query === "all";
    const match = { is_deleted: { $ne: true } };
    if (!isAll) {
      match.name = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    const maxLimit = Math.min(limit, 500);

    // Contar total antes del limit
    const totalCount = await database.collection("stores").countDocuments(match);

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
    ]).toArray();

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
//  TOOL: get_store_config — configuración de un comercio
// ════════════════════════════════════════════════════════════
server.tool(
  "get_store_config",
  "Muestra la configuración de un comercio: métodos de pago habilitados, integraciones POS activas, " +
  "métodos de entrega y configuración general. " +
  "Úsala para: qué métodos de pago tiene, qué POS usa, si tiene delivery, si acepta cupones.",
  {
    storeName: storeNameParam,
  },
  async ({ storeName }) => {
    const database = await getDb();
    const result = await resolveStore(storeName);
    if (!result.found) return ok(result);

    const store = await database.collection("stores").findOne(
      { _id: result.store._id },
      { projection: { name: 1, settings: 1, information: 1 } }
    );

    if (!store || !store.settings) {
      return ok({ message: "Comercio encontrado pero sin configuración de settings." });
    }

    const s = store.settings;

    // Métodos de pago habilitados
    const enabledPayments = [];
    const webpaySettings = s.payment_methods?.webpay?.settings || {};
    for (const [method, config] of Object.entries(webpaySettings)) {
      if (config.is_enabled) enabledPayments.push(method);
    }
    if (s.payment_methods?.wallet?.is_enabled) enabledPayments.push("wallet");
    if (s.payment_methods?.cards?.is_enabled) {
      const cardSettings = s.payment_methods.cards.settings || {};
      for (const [method, config] of Object.entries(cardSettings)) {
        if (config.is_enabled) enabledPayments.push(`cards:${method}`);
      }
    }
    if (s.payment_methods?.benefits?.is_enabled) {
      const benefitSettings = s.payment_methods.benefits.settings || {};
      for (const [method, config] of Object.entries(benefitSettings)) {
        if (config.is_enabled) enabledPayments.push(`benefits:${method}`);
      }
    }

    // POS activos
    const activePOS = [];
    for (const [pos, enabled] of Object.entries(s.pos_settings || {})) {
      if (pos === "additional_settings") continue;
      if (enabled) activePOS.push(pos);
    }

    // Delivery methods
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
//  TOOL: get_payment_errors — errores de pago (cualquier método)
// ════════════════════════════════════════════════════════════
server.tool(
  "get_payment_errors",
  "Analiza errores de pago de cualquier método (getnet, transbank, fpay, mercadopago, klap, niubiz, etc). " +
  "Agrupa errores por código y mensaje, muestra frecuencia y porcentaje. " +
  "Úsala para: errores de Getnet, fallos de Transbank, rechazos de pago, diagnóstico de problemas de cobro, " +
  "errores más comunes, tasa de error por método de pago.",
  {
    storeName: storeNameParam,
    paymentMethod: z.string().optional().describe(
      "Método de pago a filtrar: getnet, transbank, fpay, mercadopago, klap, niubiz, cash, etc. " +
      "Si se omite, muestra errores de TODOS los métodos."
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

    // Total de órdenes con este filtro
    const totalOrders = await database.collection("orders").countDocuments(match);

    // Agregar errores (responseCode != 0 y != null)
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
    ]).toArray();

    // Órdenes sin respuesta de pago (posible error)
    const noResponseCount = await database.collection("orders").countDocuments({
      ...match,
      "payment.request.data.response": { $exists: false },
      "payment_details.payment_method.id": { $exists: true },
    });

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
//  TOOL: get_payment_summary — resumen de pagos por método
// ════════════════════════════════════════════════════════════
server.tool(
  "get_payment_summary",
  "Resumen de pagos por método: total de órdenes, aprobadas, rechazadas y tasa de éxito por cada método de pago. " +
  "Úsala para: comparar métodos de pago, ver cuál funciona mejor, tasa de aprobación, " +
  "resumen general de pagos, diagnóstico de rendimiento de cobros.",
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
            $sum: {
              $cond: [{ $eq: ["$payment.request.data.response.responseCode", 0] }, 1, 0],
            },
          },
          totalAmount: { $sum: { $ifNull: ["$payment_details.amounts.total", 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray();

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
//  TOOLS existentes de API Wibo (ahora con storeName)
// ════════════════════════════════════════════════════════════

async function callWiboWithStore(path, storeName, extraParams = {}) {
  const { organizationId, storeId } = await resolveOrThrow(storeName);
  const data = await wiboFetch(path, { organizationId, storeId, ...extraParams });
  return ok(data);
}

// 1. Comparación comercial
server.tool(
  "get_commercial_comparison",
  "Compara métricas de ventas de cada tienda entre el período actual y el anterior. " +
  "Úsala para: desempeño, ventas, crecimiento, comparativas, variación, si mejoraron o empeoraron, " +
  "ranking de tiendas, evolución entre períodos, quién subió o bajó. " +
  "Devuelve totalTransactions, successfulTransactions, totalSales y variación % con direction up/down.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/commercial/comparison", storeName, { period, startDate, endDate })
);

// 2. Riesgo comercial
server.tool(
  "get_commercial_risk",
  "Detecta tiendas en riesgo: caída fuerte de ventas vs período anterior y tiendas sin actividad reciente. " +
  "Úsala para: alertas, riesgos, caídas de ventas, tiendas inactivas, sin transacciones, días sin vender.",
  {
    ...commonParams,
    dropThreshold: z.number().optional().describe("% mínimo de caída para alertar. Default: 60"),
    zeroDays: z.number().optional().describe("Días consecutivos sin ventas para considerar inactiva. Default: 3"),
  },
  async ({ storeName, period, startDate, endDate, dropThreshold, zeroDays }) =>
    callWiboWithStore("/commercial/risk", storeName, { period, startDate, endDate, dropThreshold, zeroDays })
);

// 3. Transacciones diarias
server.tool(
  "get_transactions_daily",
  "Transacciones diarias por tienda con métricas detalladas y promedios. " +
  "Úsala para: actividad diaria, detalle por tienda por fecha, ventas diarias, ticket promedio diario.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/transactions/daily", storeName, { period, startDate, endDate })
);

// 4. Totales de transacciones
server.tool(
  "get_transactions_totals",
  "Totales agregados a nivel de toda la plataforma Wibo. " +
  "Úsala para: resumen global, KPIs totales, total de ventas, datos consolidados de la organización.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/transactions/totals", storeName, { period, startDate, endDate })
);

// 5. Bajo volumen de transacciones
server.tool(
  "get_low_transactions",
  "Lista tiendas con transacciones semanales por debajo de un umbral mínimo. " +
  "Úsala para: tiendas con bajo rendimiento, poca actividad, alertas de bajo tráfico.",
  {
    ...commonParams,
    threshold: z.number().optional().describe("Umbral mínimo de transacciones semanales. Default: 140"),
  },
  async ({ storeName, period, startDate, endDate, threshold }) =>
    callWiboWithStore("/transactions/low-transactions", storeName, { period, startDate, endDate, threshold })
);

// 6. Uso de features
server.tool(
  "get_features_usage",
  "Tasa de adopción y uso de funcionalidades: cupones, wallet/loyalty, beneficiarios, promociones. " +
  "Úsala para: uso de features, adopción de cupones, cuántos usan loyalty, adopción de producto.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/features/usage", storeName, { period, startDate, endDate })
);

// 7. Pagos rechazados
server.tool(
  "get_payments_rejected",
  "Análisis de transacciones rechazadas: desglose por motivo de rechazo y método de pago. " +
  "Úsala para: pagos fallidos, motivos de rechazo, tasa de rechazo, rechazos financieros vs técnicos.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/payments/rejected", storeName, { period, startDate, endDate })
);

// 8. Métodos de pago
server.tool(
  "get_payments_methods",
  "Estadísticas por método de pago: tasa de aprobación, rechazo y errores técnicos por medio. " +
  "Úsala para: medios de pago, efectivo vs tarjeta vs QR, tasa de éxito por forma de pago.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/payments/methods", storeName, { period, startDate, endDate })
);

// 9. Errores de POS
server.tool(
  "get_system_pos_errors",
  "Desglose de errores del sistema POS agrupados por sistema y tipo de error. " +
  "Úsala para: errores de POS, fallas del sistema, qué POS falla más (fudo, mrc, justo, nutriserv, rappi_turbo).",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/system/pos-errors", storeName, { period, startDate, endDate })
);

// 10. Experiencia de usuario
server.tool(
  "get_user_experience",
  "Métricas de experiencia de usuario en el flujo de compra. " +
  "Úsala para: UX, tasa de abandono, tiempo promedio de compra, reintentos de pago, % de abandono.",
  { ...commonParams },
  async ({ storeName, period, startDate, endDate }) =>
    callWiboWithStore("/user-experience", storeName, { period, startDate, endDate })
);

// ─── Iniciar ────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Wibo Reports MCP v4.0 — 16 tools activos (10 API + 6 MongoDB)");
