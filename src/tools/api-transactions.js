import { z } from "zod";
import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_transactions_daily",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Transacciones diarias por tienda con métricas y promedios. " +
    "Para: actividad diaria, ventas diarias. " +
    "Usa este tool en vez de query_mongodb para datos diarios.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/transactions/daily", storeName, { period, startDate, endDate })
  );

  server.tool("get_transactions_totals",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Totales agregados: transacciones exitosas, ventas totales, usuarios. " +
    "Para: resumen global, KPIs totales, cuántas órdenes hubo. " +
    "Usa este tool en vez de query_mongodb para totales de ventas.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/transactions/totals", storeName, { period, startDate, endDate })
  );

  server.tool("get_low_transactions",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Tiendas con transacciones semanales bajo umbral mínimo. " +
    "Para: bajo rendimiento, alertas de actividad. " +
    "Usa este tool en vez de query_mongodb para alertas de transacciones.",
    { ...commonParams,
      threshold: z.number().optional().describe("Umbral mínimo semanal. Default: 140"),
    },
    async ({ storeName, period, startDate, endDate, threshold }) =>
      callWiboWithStore("/transactions/low-transactions", storeName, { period, startDate, endDate, threshold })
  );
}
