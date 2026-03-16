import { cache } from "../cache.js";
import { ok } from "../api.js";

export function register(server) {
  server.tool(
    "cache_stats",
    "Muestra estadísticas del cache en memoria: entradas activas y tamaño total.",
    {},
    async () => ok(cache.stats())
  );
}
