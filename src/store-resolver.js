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

export async function resolveOrgOrThrow(orgName) {
  const cacheKey = `resolve:org:${orgName.toLowerCase().trim()}`;
  return cached(cacheKey, async () => {
    const database = await getDb();
    const regex = new RegExp(orgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const orgs = await database
      .collection("organizations")
      .find({ name: regex, is_deleted: { $ne: true } })
      .project({ _id: 1, name: 1 })
      .maxTimeMS(QUERY_TIMEOUT_MS)
      .limit(10)
      .toArray();

    if (orgs.length === 0) {
      throw new Error(
        `No se encontró ninguna organización con "${orgName}". ` +
        `Usa list_organizations para ver las disponibles y pregúntale al usuario cuál quiere.`
      );
    }
    if (orgs.length > 1) {
      const list = orgs.map((o) => `- ${o.name}`).join("\n");
      throw new Error(
        `Se encontraron ${orgs.length} organizaciones similares:\n${list}\n` +
        `Pregunta al usuario cuál es la correcta.`
      );
    }

    return { organizationId: orgs[0]._id, organizationName: orgs[0].name };
  });
}