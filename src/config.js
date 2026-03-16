// ─── Config y constantes ─────────────────────────────────────

export const API_BASE_URL = process.env.WIBO_API_URL || "https://wibo-api-reports.wibodev.com/api/v1/reports";
export const API_KEY = process.env.WIBO_API_KEY;
export const MONGODB_URL = process.env.MONGODB_URL;
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE || "staging";
export const ADMIN_KEY = process.env.ADMIN_KEY || "";

// ─── Límites de seguridad ────────────────────────────────────
export const QUERY_TIMEOUT_MS = 30_000;
export const MAX_FIND_LIMIT = 200;
export const DEFAULT_FIND_LIMIT = 50;
export const MAX_AGGREGATE_LIMIT = 100;
export const MAX_SEARCH_LIMIT = 500;
export const FORBIDDEN_STAGES = ["$out", "$merge", "$collStats", "$indexStats", "$planCacheStats"];

// ─── Cache ───────────────────────────────────────────────────
export const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas en ms
