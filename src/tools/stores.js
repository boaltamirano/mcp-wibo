import { z } from "zod";
import { getDb } from "../db.js";
import { cached } from "../cache.js";
import { resolveStore } from "../store-resolver.js";
import { storeNameParam, ok } from "../api.js";
import { QUERY_TIMEOUT_MS, MAX_SEARCH_LIMIT } from "../config.js";

export function register(server) {
  // ── search_stores ─────────────────────────────────────────
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
      const maxLimit = Math.min(limit, MAX_SEARCH_LIMIT);
      const cacheKey = `stores:${query.toLowerCase().trim()}:${maxLimit}`;

      const result = await cached(cacheKey, async () => {
        const database = await getDb();
        const isAll = query === "*" || query === "" || query === "todos" || query === "all";
        const match = { is_deleted: { $ne: true } };
        if (!isAll) {
          match.name = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        }

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
          return { message: `No se encontraron comercios con "${query}".`, total: 0, results: [] };
        }
        return {
          message: `Se encontraron ${totalCount} comercio(s)${totalCount > maxLimit ? ` (mostrando ${maxLimit})` : ""}.`,
          total: totalCount,
          showing: stores.length,
          results: stores,
        };
      });

      return ok(result);
    }
  );

  // ── get_store_config ──────────────────────────────────────
  server.tool(
    "get_store_config",
    "Muestra la configuración de un comercio: métodos de pago habilitados, integraciones POS activas, " +
    "métodos de entrega y configuración general.",
    {
      storeName: storeNameParam,
    },
    async ({ storeName }) => {
      const result = await resolveStore(storeName);
      if (!result.found) return ok(result);

      const configResult = await cached(`config:${result.store._id}`, async () => {
        const database = await getDb();
        const store = await database.collection("stores").findOne(
          { _id: result.store._id },
          { projection: { name: 1, settings: 1, information: 1 }, maxTimeMS: QUERY_TIMEOUT_MS }
        );

        if (!store || !store.settings) {
          return { message: "Comercio encontrado pero sin configuración de settings." };
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

        return {
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
        };
      });

      return ok(configResult);
    }
  );
}
