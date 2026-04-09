import { orgParams, callWiboReport } from "../api.js";

export function register(server) {
  server.tool("get_payments_rejected",
    "Transacciones rechazadas: desglose por motivo y método de pago. " +
    "Para: pagos fallidos, análisis de rechazos. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/payments/rejected", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_payments_methods",
    "Estadísticas por método de pago: aprobación, rechazo, errores técnicos. " +
    "Para: análisis de medios de pago, tasas de éxito. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/payments/methods", { orgName, storeName }, { period, startDate, endDate })
  );
}
