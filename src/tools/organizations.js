import { getDb } from "../db.js";
import { cached } from "../cache.js";
import { ok } from "../api.js";
import { QUERY_TIMEOUT_MS } from "../config.js";

export function register(server) {
  server.tool(
    "list_organizations",
    "PASO 1 OBLIGATORIO: Lista todas las organizaciones disponibles con sus comercios activos. " +
    "SIEMPRE ejecuta este tool ANTES de cualquier reporte si el usuario no especificó una organización. " +
    "Devuelve nombre, cantidad de comercios activos y lista de nombres de comercios por organización.",
    {},
    async () => {
      const result = await cached("organizations:list", async () => {
        const database = await getDb();

        const orgs = await database.collection("organizations").aggregate([
          { $match: { is_deleted: { $ne: true } } },
          {
            $lookup: {
              from: "stores",
              let: { orgId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$organization_id", "$$orgId"] },
                    is_deleted: { $ne: true },
                  },
                },
                { $project: { name: 1, is_enabled: 1 } },
              ],
              as: "stores",
            },
          },
          {
            $project: {
              organizationName: "$name",
              totalStores: { $size: "$stores" },
              activeStores: {
                $size: {
                  $filter: {
                    input: "$stores",
                    as: "s",
                    cond: { $eq: ["$$s.is_enabled", true] },
                  },
                },
              },
              storeNames: "$stores.name",
            },
          },
          { $sort: { organizationName: 1 } },
        ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

        return {
          instruccion: "Presenta estas organizaciones al usuario y pregunta cuál quiere consultar. Luego pregunta qué comercio específico dentro de esa organización.",
          total: orgs.length,
          organizations: orgs,
        };
      });

      return ok(result);
    }
  );
}
