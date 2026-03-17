import { z } from "zod";
import { orgParams, callWiboWithOrg } from "../api.js";

export function register(server) {
  server.tool("get_transactions_daily",
    "Transacciones diarias de una organización con métricas y promedios por comercio. " +
    "Para: actividad diaria, ventas diarias, tendencias. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/transactions/daily", orgName, { period, startDate, endDate })
  );

  server.tool("get_transactions_totals",
    "Totales agregados de una organización: transacciones exitosas, ventas totales, usuarios. " +
    "Para: resumen global, KPIs totales, cuántas órdenes hubo. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/transactions/totals", orgName, { period, startDate, endDate })
  );

  server.tool("get_low_transactions",
    "Comercios de una organización con transacciones semanales bajo el umbral mínimo. " +
    "Para: bajo rendimiento, alertas de actividad, comercios sin ventas. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    {
      ...orgParams,
      threshold: z.number().optional().describe("Umbral mínimo semanal. Default: 140"),
    },
    async ({ orgName, period, startDate, endDate, threshold }) =>
      callWiboWithOrg("/transactions/low-transactions", orgName, { period, startDate, endDate, threshold })
  );
}