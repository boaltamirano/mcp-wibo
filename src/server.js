import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerAdmin } from "./tools/admin.js";
import { register as registerStores } from "./tools/stores.js";
import { register as registerPayments } from "./tools/payments.js";
import { register as registerApiCommercial } from "./tools/api-commercial.js";
import { register as registerApiTransactions } from "./tools/api-transactions.js";
import { register as registerApiPayments } from "./tools/api-payments.js";
import { register as registerApiFeatures } from "./tools/api-features.js";
import { register as registerCacheStats } from "./tools/cache-stats.js";

const server = new McpServer({ name: "wibo-reports", version: "6.0.0" });

registerAdmin(server);
registerStores(server);
registerPayments(server);
registerApiCommercial(server);
registerApiTransactions(server);
registerApiPayments(server);
registerApiFeatures(server);
registerCacheStats(server);

export { server };
