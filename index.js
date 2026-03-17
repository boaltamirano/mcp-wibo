import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Wibo Reports MCP v8.0 — 21 tools (10 API org-level + 8 MongoDB + 2 guías + 1 util) — Cache 6h");
