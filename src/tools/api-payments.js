import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_payments_rejected",
    "Transacciones rechazadas: desglose por motivo y método de pago.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/payments/rejected", storeName, { period, startDate, endDate })
  );

  server.tool("get_payments_methods",
    "Estadísticas por método de pago: aprobación, rechazo, errores técnicos.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/payments/methods", storeName, { period, startDate, endDate })
  );
}
