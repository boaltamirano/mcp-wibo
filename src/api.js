import { z } from "zod";
import { API_BASE_URL, API_KEY } from "./config.js";
import { resolveOrThrow } from "./store-resolver.js";

export const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

export const storeNameParam = z.string().min(1).describe(
  "Nombre del comercio (OBLIGATORIO). Ej: 'Kiosko Chacay Centro', 'Pollo Bravo'. " +
  "Si el usuario no dijo qué comercio u organización, PREGÚNTALE antes de ejecutar este tool."
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

export async function callWiboWithStore(path, storeName, extraParams = {}) {
  const { startDate, endDate } = extraParams;
  if (startDate && endDate) {
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
  const { organizationId, storeId } = await resolveOrThrow(storeName);
  const data = await wiboFetch(path, { organizationId, storeId, ...extraParams });
  return ok(data);
}
