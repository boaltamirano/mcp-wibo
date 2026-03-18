import { z } from "zod";
import { getDb } from "../db.js";
import { cached } from "../cache.js";
import { ok } from "../api.js";
import {
  QUERY_TIMEOUT_MS, MAX_FIND_LIMIT, DEFAULT_FIND_LIMIT,
  MAX_AGGREGATE_LIMIT, FORBIDDEN_STAGES,
} from "../config.js";

export function register(server) {
  // ── list_collections ──────────────────────────────────────
  server.tool(
    "list_collections",
    "Lista todas las colecciones disponibles en MongoDB con su conteo estimado de documentos.",
    {},
    async () => {
      const database = await getDb();
      const collections = await database.listCollections({}, { nameOnly: true }).toArray();
      const names = collections.map((c) => c.name).sort();

      const counts = await Promise.all(
        names.map(async (name) => {
          const count = await database.collection(name).estimatedDocumentCount();
          return { name, estimatedDocuments: count };
        })
      );

      return ok({ total: counts.length, collections: counts });
    }
  );

  // ── query_mongodb ─────────────────────────────────────────
  server.tool(
    "query_mongodb",
    "Consultas de solo lectura en MongoDB (find, count, distinct, aggregate). " +
    "Para datos de ventas, transacciones o pagos usa los tools de reporte (get_commercial_*, get_transactions_*, etc.) en su lugar. " +
    "Las colecciones orders, payments, stores y organizations necesitan filtro por store_id, organization_id o _id. " +
    "Si no tienes estos IDs, pregunta al usuario de qué organización o comercio necesita la información.",
    {
      collection: z.string().describe(
        "Nombre de la colección: stores, orders, organizations, users, products, payments, sites, wallets, coupons, etc."
      ),
      operation: z.enum(["find", "count", "distinct", "aggregate"]).describe(
        "find = buscar documentos, count = contar, distinct = valores únicos, aggregate = pipeline de agregación"
      ),
      filter: z.string().optional().describe(
        'Filtro JSON. Ej: {"is_enabled": true}. Default: {}'
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
        'Pipeline JSON (solo aggregate). SIEMPRE inicia con $match para filtrar.'
      ),
    },
    async ({ collection, operation, filter, projection, sort, limit, distinctField, pipeline }) => {
      const database = await getDb();
      const col = database.collection(collection);
      const parsedFilter = filter ? JSON.parse(filter) : {};
      const isEmptyFilter = Object.keys(parsedFilter).length === 0;

      // Bloquear colecciones sensibles sin filtro de store_id/organization_id
      const RESTRICTED_COLLECTIONS = ["orders", "payments", "stores", "organizations"];
      if (RESTRICTED_COLLECTIONS.includes(collection)) {
        const hasStoreId = "store_id" in parsedFilter;
        const hasOrgId = "organization_id" in parsedFilter;
        const hasId = "_id" in parsedFilter;
        const pipelineStr = pipeline || "";
        const pipelineHasScope = /"store_id"/.test(pipelineStr) || /"organization_id"/.test(pipelineStr) || /"_id"/.test(pipelineStr);
        const hasScope = hasStoreId || hasOrgId || hasId || pipelineHasScope;
        if (!hasScope && operation !== "count") {
          throw new Error(
            `Para consultar "${collection}", necesitas especificar a qué comercio u organización te refieres. ` +
            `Pregunta al usuario: "¿De qué organización o comercio necesitas esta información?" ` +
            `Luego usa el filtro store_id, organization_id o _id.`
          );
        }
      }

      // Bloquear operadores de modificación en filtros
      const filterStr = JSON.stringify(parsedFilter);
      const WRITE_OPS = ["$set", "$unset", "$inc", "$push", "$pull", "$rename", "$addToSet", "$pop", "$mul", "$min", "$max", "$currentDate"];
      for (const op of WRITE_OPS) {
        if (filterStr.includes(`"${op}"`)) {
          throw new Error(`Operador ${op} no permitido. Solo lectura.`);
        }
      }

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
          if (isEmptyFilter) {
            const count = await cached(`count:${collection}`, () => col.estimatedDocumentCount());
            return ok({ collection, operation, filter: {}, count, note: "Conteo estimado (cache 6h)" });
          }
          const count = await col.countDocuments(parsedFilter, { maxTimeMS: QUERY_TIMEOUT_MS });
          return ok({ collection, operation, filter: parsedFilter, count, note: "Conteo exacto" });
        }

        case "distinct": {
          if (!distinctField) throw new Error("distinctField es requerido para operation=distinct");
          const values = await col.distinct(distinctField, parsedFilter, { maxTimeMS: QUERY_TIMEOUT_MS });
          return ok({ collection, operation, field: distinctField, count: values.length, values });
        }

        case "aggregate": {
          if (!pipeline) throw new Error("pipeline es requerido para operation=aggregate");
          const parsedPipeline = JSON.parse(pipeline);

          for (const stage of parsedPipeline) {
            const stageKey = Object.keys(stage)[0];
            if (FORBIDDEN_STAGES.includes(stageKey)) {
              throw new Error(`Stage ${stageKey} no permitido (solo lectura).`);
            }
          }

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

  // ── get_collection_schema ─────────────────────────────────
  server.tool(
    "get_collection_schema",
    "Muestra la estructura (campos) de un documento de una colección. " +
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
}
