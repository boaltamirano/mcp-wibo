import { orgParams, callWiboWithOrg } from "../api.js";

export function register(server) {
  server.tool("get_payments_rejected",
    "Transacciones rechazadas de una organización: desglose por motivo y método de pago. " +
    "Para: pagos fallidos, análisis de rechazos. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/payments/rejected", orgName, { period, startDate, endDate })
  );

  server.tool("get_payments_methods",
    "Estadísticas por método de pago de una organización: aprobación, rechazo, errores técnicos. " +
    "Para: análisis de medios de pago, tasas de éxito. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/payments/methods", orgName, { period, startDate, endDate })
  );
}