import { orgParams, callWiboWithOrg } from "../api.js";

export function register(server) {
  server.tool("get_features_usage",
    "Adopción de funcionalidades en una organización: cupones, wallet, beneficiarios, promociones. " +
    "Para: uso de features, adopción por comercio. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/features/usage", orgName, { period, startDate, endDate })
  );

  server.tool("get_user_experience",
    "Métricas de UX en el flujo de compra de una organización: abandono, reintentos, completitud. " +
    "Para: conversión, experiencia de usuario, embudo de compra. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/user-experience", orgName, { period, startDate, endDate })
  );

  server.tool("get_system_pos_errors",
    "Errores del sistema POS agrupados por sistema y tipo en una organización. " +
    "Para: fallas de fudo, mrc, justo, nutriserv, errores de integración. " +
    "orgName es OBLIGATORIO. Si el usuario no dijo qué organización, usa list_organizations y PREGÚNTALE.",
    { ...orgParams },
    async ({ orgName, period, startDate, endDate }) =>
      callWiboWithOrg("/system/pos-errors", orgName, { period, startDate, endDate })
  );
}