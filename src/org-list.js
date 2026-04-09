import { getDb } from "./db.js";
import { QUERY_TIMEOUT_MS } from "./config.js";

export async function getOrganizationList() {
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

  return orgs.map((o, i) => `${i + 1}. ${o.organizationName} (${o.activeStores} comercios)`).join("\n");
}
