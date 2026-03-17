import { commonParams, callWiboWithStore } from "../api.js";

export function register(server) {
  server.tool("get_features_usage",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Adopción de funcionalidades: cupones, wallet, beneficiarios, promociones. " +
    "Usa este tool en vez de query_mongodb para datos de features.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/features/usage", storeName, { period, startDate, endDate })
  );

  server.tool("get_user_experience",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Métricas de UX en el flujo de compra. " +
    "Para: abandono, reintentos, completitud. " +
    "Usa este tool en vez de query_mongodb para datos de experiencia de usuario.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/user-experience", storeName, { period, startDate, endDate })
  );

  server.tool("get_system_pos_errors",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "REPORTE: Errores del sistema POS agrupados por sistema y tipo. " +
    "Para: fallas de fudo, mrc, justo, nutriserv. " +
    "Usa este tool en vez de query_mongodb para errores de POS.",
    { ...commonParams },
    async ({ storeName, period, startDate, endDate }) =>
      callWiboWithStore("/system/pos-errors", storeName, { period, startDate, endDate })
  );
}
