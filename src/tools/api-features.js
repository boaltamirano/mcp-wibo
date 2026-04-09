import { orgParams, callWiboReport } from "../api.js";

export function register(server) {
  server.tool("get_features_usage",
    "Adopción de funcionalidades: cupones, wallet, beneficiarios, promociones. " +
    "Para: uso de features, adopción por comercio. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/features/usage", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_user_experience",
    "Métricas de UX en el flujo de compra: abandono, reintentos, completitud. " +
    "Para: conversión, experiencia de usuario, embudo de compra. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/user-experience", { orgName, storeName }, { period, startDate, endDate })
  );

  server.tool("get_system_pos_errors",
    "Errores del sistema POS agrupados por sistema y tipo. " +
    "Para: fallas de fudo, mrc, justo, nutriserv, errores de integración. " +
    "Opcional: orgName para filtrar por organización, storeName para un comercio específico, o sin filtro para datos globales.",
    { ...orgParams },
    async ({ orgName, storeName, period, startDate, endDate }) =>
      callWiboReport("/system/pos-errors", { orgName, storeName }, { period, startDate, endDate })
  );
}
