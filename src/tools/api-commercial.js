import { commonParams, callWiboWithStore } from "../api.js";
import { z } from "zod";

export function register(server) {
  server.tool("get_commercial_comparison",
    "Compara métricas de ventas entre el período actual y el anterior. " +
    "Para: desempeño, ventas, crecimiento, ranking. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/commercial/comparison", storeName, { period, startDate, endDate })
  );

  server.tool("get_commercial_risk",
    "Detecta tiendas en riesgo: caída de ventas y tiendas sin actividad. " +
    "Para: alertas, riesgos, tiendas inactivas. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams,
      dropThreshold: z.number().optional().describe("% mínimo de caída para alertar. Default: 60"),
      zeroDays: z.number().optional().describe("Días sin ventas para considerar inactiva. Default: 3"),
    },
    async ({ storeName, period, startDate, endDate, dropThreshold, zeroDays }) =>
      callWiboWithStore("/commercial/risk", storeName, { period, startDate, endDate, dropThreshold, zeroDays })
  );
}
