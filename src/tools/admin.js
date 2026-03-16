import { z } from "zod";
import { getDb } from "../db.js";
import { requireAdmin } from "../auth.js";
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
    "Lista todas las colecciones disponibles en MongoDB con su conteo estimado de documentos. " +
    "Requiere admin_key para acceder.",
    {
      admin_key: z.string().describe("Clave de administrador requerida para acceder a este tool."),
    },
    async ({ admin_key }) => {
      requireAdmin(admin_key);
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
    "Ejecuta consultas de SOLO LECTURA en cualquier colección de MongoDB. " +
    "Soporta find, count, distinct y aggregate. Requiere admin_key para acceder. " +
    "IMPORTANTE para colecciones grandes (orders tiene 2.5M+ docs): " +
    "- Para contar sin filtro usa operation=count con filter vacío (usa estimado internamente). " +
    "- Siempre filtra por campos indexados (store_id, organization_id, created_at, status). " +
    "- En aggregates, pon $match PRIMERO para usar índices.",
    {
      admin_key: z.string().describe("Clave de administrador requerida para acceder a este tool."),
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
    async ({ admin_key, collection, operation, filter, projection, sort, limit, distinctField, pipeline }) => {
      requireAdmin(admin_key);
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
    "Requiere admin_key para acceder. " +
    "Devuelve los campos del primer documento encontrado como referencia.",
    {
      admin_key: z.string().describe("Clave de administrador requerida para acceder a este tool."),
      collection: z.string().describe("Nombre de la colección a inspeccionar"),
      sampleFilter: z.string().optional().describe('Filtro opcional para elegir un documento representativo. JSON. Default: {}'),
    },
    async ({ admin_key, collection, sampleFilter }) => {
      requireAdmin(admin_key);
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
