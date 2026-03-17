import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./src/server.js";

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Wibo Reports MCP v7.0 — 20 tools (10 API + 8 MongoDB + 1 guía + 1 util) — Cache 6h");
