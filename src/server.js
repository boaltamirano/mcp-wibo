import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerAdmin } from "./tools/admin.js";
import { register as registerStores } from "./tools/stores.js";
import { register as registerPayments } from "./tools/payments.js";
import { register as registerApiCommercial } from "./tools/api-commercial.js";
import { register as registerApiTransactions } from "./tools/api-transactions.js";
import { register as registerApiPayments } from "./tools/api-payments.js";
import { register as registerApiFeatures } from "./tools/api-features.js";
import { register as registerCacheStats } from "./tools/cache-stats.js";
import { register as registerReportGuide } from "./tools/report-guide.js";
import { register as registerOrganizations } from "./tools/organizations.js";

const server = new McpServer({ name: "wibo-reports", version: "8.0.0" });

registerReportGuide(server);
registerOrganizations(server);
registerAdmin(server);
registerStores(server);
registerPayments(server);
registerApiCommercial(server);
registerApiTransactions(server);
registerApiPayments(server);
registerApiFeatures(server);
registerCacheStats(server);

export { server };
