import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_payments_rejected",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Transacciones rechazadas: desglose por motivo y método de pago. " +
    "Usa este tool en vez de query_mongodb para datos de rechazos.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/payments/rejected", storeName, { period, startDate, endDate })
  );

  server.tool("get_payments_methods",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Estadísticas por método de pago: aprobación, rechazo, errores técnicos. " +
    "Usa este tool en vez de query_mongodb para datos de métodos de pago.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/payments/methods", storeName, { period, startDate, endDate })
  );
}
