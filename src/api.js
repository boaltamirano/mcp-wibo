import { z } from "zod";
import { API_BASE_URL, API_KEY } from "./config.js";
import { resolveOrThrow } from "./store-resolver.js";

export const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

export const storeNameParam = z.string().describe(
  "Nombre del comercio, organización o sitio. Ej: 'Kiosko Chacay Centro', 'Pollo Bravo'. Si no estás seguro del nombre exacto, usa search_stores primero."
);

export const commonParams = {
  storeName: storeNameParam,
  period: z.enum(["day", "week", "month", "6months", "year"]).optional()
    .describe("Período predefinido: day, week, month, 6months, year. Default: month"),
  startDate: z.string().optional()
    .describe("Fecha inicio YYYY-MM-DD. Tiene prioridad sobre period"),
  endDate: z.string().optional()
    .describe("Fecha fin YYYY-MM-DD. Tiene prioridad sobre period"),
};

export async function wiboFetch(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Wibo API ${res.status}: ${JSON.stringify(err.message || err)}`);
  }
  return res.json();
}

export async function callWiboWithStore(path, storeName, extraParams = {}) {
  const { organizationId, storeId } = await resolveOrThrow(storeName);
  const data = await wiboFetch(path, { organizationId, storeId, ...extraParams });
  return ok(data);
}
