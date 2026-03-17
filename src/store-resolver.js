import { getDb } from "./db.js";
import { cached } from "./cache.js";
import { QUERY_TIMEOUT_MS } from "./config.js";

export async function resolveStore(storeName) {
  const cacheKey = `resolve:${storeName.toLowerCase().trim()}`;
  return cached(cacheKey, async () => {
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
      return { found: false, message: `No se encontró ningún comercio con "${storeName}". Pregunta al usuario el nombre exacto del comercio.` };
    }
    if (stores.length === 1) {
      return { found: true, store: stores[0] };
    }
    const list = stores.map((s) => `- ${s.name} (${s.is_enabled ? "activo" : "inactivo"})`).join("\n");
    return {
      found: false,
      ambiguous: true,
      message: `Se encontraron ${stores.length} comercios:\n${list}\nPregunta al usuario cuál es el comercio exacto.`,
    };
  });
}

export async function resolveOrThrow(storeName) {
  const result = await resolveStore(storeName);
  if (!result.found) throw new Error(result.message);
  return {
    organizationId: result.store.organization_id,
    storeId: result.store._id,
  };
}
