import { z } from "zod";
import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_transactions_daily",
    "Transacciones diarias por tienda con métricas y promedios. " +
    "Para: actividad diaria, ventas diarias, tendencias. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/transactions/daily", storeName, { period, startDate, endDate })
  );

  server.tool("get_transactions_totals",
    "Totales agregados: transacciones exitosas, ventas totales, usuarios. " +
    "Para: resumen global, KPIs totales, cuántas órdenes hubo. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/transactions/totals", storeName, { period, startDate, endDate })
  );

  server.tool("get_low_transactions",
    "Tiendas con transacciones semanales bajo umbral mínimo. " +
    "Para: bajo rendimiento, alertas de actividad. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams,
      threshold: z.number().optional().describe("Umbral mínimo semanal. Default: 140"),
    },
    async ({ storeName, period, startDate, endDate, threshold }) =>
      callWiboWithStore("/transactions/low-transactions", storeName, { period, startDate, endDate, threshold })
  );
}
