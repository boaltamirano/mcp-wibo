import { z } from "zod";
import { orgParams, callWiboReport } from "../api.js";

export function register(server) {
  server.tool("get_commercial_comparison",
    "Compara métricas de ventas entre el período actual y el anterior. " +
    "Para: desempeño, ventas, crecimiento, ranking. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/commercial/comparison", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_commercial_risk",
    "Detecta comercios en riesgo: caída de ventas y tiendas sin actividad. " +
    "Para: alertas, riesgos, tiendas inactivas. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    {
      ...orgParams,
      dropThreshold: z.number().optional().describe("% mínimo de caída para alertar. Default: 60"),
      zeroDays: z.number().optional().describe("Días sin ventas para considerar inactiva. Default: 3"),
    },
    async ({ orgName, storeName, period, startDate, endDate, dropThreshold, zeroDays }) =>
      callWiboReport("/commercial/risk", { orgName, storeName }, { period, startDate, endDate, dropThreshold, zeroDays })
  );
}
