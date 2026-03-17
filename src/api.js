import { z } from "zod";
import { API_BASE_URL, API_KEY } from "./config.js";
import { resolveOrThrow, resolveOrgOrThrow } from "./store-resolver.js";

export const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

// ─── Params nivel COMERCIO (para tools que operan sobre 1 tienda específica) ──
export const storeNameParam = z.string().min(1).describe(
  "Nombre del comercio (OBLIGATORIO). Ej: 'Kiosko Chacay Centro', 'Pollo Bravo'. " +
  "Si el usuario no dijo qué comercio, PREGÚNTALE antes de ejecutar este tool."
);

// ─── Params nivel ORGANIZACIÓN (para todos los tools de reporte) ──────────────
export const orgNameParam = z.string().min(1).describe(
  "Nombre de la organización (OBLIGATORIO). Ej: 'Sodexo Energía', 'Aeropuerto Pudahuel'. " +
  "Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE antes de ejecutar."
);

const MAX_RANGE_DAYS = 183; // ~6 meses

export const commonParams = {
  storeName: storeNameParam,
  period: z.enum(["day", "week", "month", "6months"]).optional()
    .describe("Período predefinido: day, week, month, 6months. Default: month"),
  startDate: z.string().optional()
    .describe("Fecha inicio YYYY-MM-DD. Tiene prioridad sobre period. Rango máximo: 6 meses"),
  endDate: z.string().optional()
    .describe("Fecha fin YYYY-MM-DD. Tiene prioridad sobre period. Rango máximo: 6 meses"),
};

export const orgParams = {
  orgName: orgNameParam,
  period: z.enum(["day", "week", "month", "6months"]).optional()
    .describe("Período predefinido: day, week, month, 6months. Default: month"),
  startDate: z.string().optional()
    .describe("Fecha inicio YYYY-MM-DD. Tiene prioridad sobre period. Rango máximo: 6 meses"),
  endDate: z.string().optional()
    .describe("Fecha fin YYYY-MM-DD. Tiene prioridad sobre period. Rango máximo: 6 meses"),
};

// ─── Validación de rango de fechas ────────────────────────────────────────────
function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) {
    throw new Error("startDate debe ser anterior a endDate.");
  }
  if (diffDays > MAX_RANGE_DAYS) {
    throw new Error(
      `Rango máximo permitido: 6 meses (${MAX_RANGE_DAYS} días). ` +
      `Rango solicitado: ${Math.round(diffDays)} días. ` +
      "Ejemplo válido: startDate='2026-01-01', endDate='2026-06-30'."
    );
  }
}

// ─── Fetch base ───────────────────────────────────────────────────────────────
export async function wiboFetch(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  const fullUrl = url.toString();
  console.error(`[wibo] ${path} → ${fullUrl}`);
  const res = await fetch(fullUrl, {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Wibo API ${res.status} (${fullUrl}): ${JSON.stringify(err.message || err)}`);
  }
  return res.json();
}

// ─── Llamada por COMERCIO específico (get_payment_errors, get_payment_summary, get_store_config) ──
export async function callWiboWithStore(path, storeName, extraParams = {}) {
  validateDateRange(extraParams.startDate, extraParams.endDate);
  const { organizationId, storeId } = await resolveOrThrow(storeName);
  const data = await wiboFetch(path, { organizationId, storeId, ...extraParams });
  return ok(data);
}

// ─── Llamada por ORGANIZACIÓN (todos los tools de reporte del dashboard) ──────
export async function callWiboWithOrg(path, orgName, extraParams = {}) {
  validateDateRange(extraParams.startDate, extraParams.endDate);
  const { organizationId } = await resolveOrgOrThrow(orgName);
  const data = await wiboFetch(path, { organizationId, ...extraParams });
  return ok(data);
}