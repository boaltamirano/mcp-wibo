import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Wibo Reports MCP v6.0 — 18 tools (10 API + 7 MongoDB + 1 util) — Cache 6h + admin_key");
