import { z } from "zod";
import { orgParams, callWiboReport } from "../api.js";

export function register(server) {
  server.tool("get_transactions_daily",
    "Transacciones diarias con métricas y promedios. " +
    "Para: actividad diaria, ventas diarias, tendencias. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/transactions/daily", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_transactions_totals",
    "Totales agregados: transacciones exitosas, ventas totales, usuarios. " +
    "Para: resumen global, KPIs totales, cuántas órdenes hubo. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/transactions/totals", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_low_transactions",
    "Comercios con transacciones semanales bajo el umbral mínimo. " +
    "Para: bajo rendimiento, alertas de actividad, comercios sin ventas. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    {
      ...orgParams,
      threshold: z.number().optional().describe("Umbral mínimo semanal. Default: 140"),
    },
    async ({ orgName, storeName, period, startDate, endDate, threshold }) =>
      callWiboReport("/transactions/low-transactions", { orgName, storeName }, { period, startDate, endDate, threshold })
  );
}
