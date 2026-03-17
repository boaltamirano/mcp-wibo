import { z } from "zod";
import { orgParams, callWiboWithOrg } from "../api.js";

export function register(server) {
  server.tool("get_commercial_comparison",
    "Compara métricas de ventas de una organización entre el período actual y el anterior. " +
    "Para: desempeño, ventas, crecimiento, ranking de comercios. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/commercial/comparison", orgName, { period, startDate, endDate })
  );

  server.tool("get_commercial_risk",
    "Detecta comercios en riesgo dentro de una organización: caída de ventas y tiendas sin actividad. " +
    "Para: alertas, riesgos, tiendas inactivas. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    {
      ...orgParams,
      dropThreshold: z.number().optional().describe("% mínimo de caída para alertar. Default: 60"),
      zeroDays: z.number().optional().describe("Días sin ventas para considerar inactiva. Default: 3"),
    },
    async ({ orgName, period, startDate, endDate, dropThreshold, zeroDays }) =>
      callWiboWithOrg("/commercial/risk", orgName, { period, startDate, endDate, dropThreshold, zeroDays })
  );
}