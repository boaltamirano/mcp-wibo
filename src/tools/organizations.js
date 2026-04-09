import { getDb } from "../db.js";
import { QUERY_TIMEOUT_MS } from "../config.js";

export function register(server) {
  server.tool(
    "list_organizations",
    "Muestra las organizaciones disponibles con sus comercios activos. " +
    "Usa este tool cuando el usuario quiere un reporte pero no ha dicho de qué organización o comercio. " +
    "Después de mostrar la lista, pregunta: '¿De cuál organización quieres el reporte?' y espera la respuesta.",
    {},
    async () => {
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
                  is_enabled: true,
                },
              },
              { $project: { _id: 0, name: 1 } },
            ],
            as: "stores",
          },
        },
        { $match: { "stores.0": { $exists: true } } },
        {
          $project: {
            _id: 0,
            organizationName: "$name",
            activeStores: { $size: "$stores" },
          },
        },
        { $sort: { organizationName: 1 } },
      ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

      const lines = orgs.map((o, i) => `${i + 1}. ${o.organizationName} (${o.activeStores} comercios)`);
      const result = lines.join("\n");

      return {
        content: [{
          type: "text",
          text: "ORGANIZACIONES DISPONIBLES:\n" + result,
        }],
      };
    }
  );
}
