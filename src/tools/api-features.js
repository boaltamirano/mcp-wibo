import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_features_usage",
    "Adopción de funcionalidades: cupones, wallet, beneficiarios, promociones. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/features/usage", storeName, { period, startDate, endDate })
  );

  server.tool("get_user_experience",
    "Métricas de UX en el flujo de compra: abandono, reintentos, completitud. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/user-experience", storeName, { period, startDate, endDate })
  );

  server.tool("get_system_pos_errors",
    "Errores del sistema POS agrupados por sistema y tipo. " +
    "Para: fallas de fudo, mrc, justo, nutriserv. " +
    "storeName es OBLIGATORIO. Si el usuario no dijo qué comercio, PREGÚNTALE antes de llamar este tool.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/system/pos-errors", storeName, { period, startDate, endDate })
  );
}
