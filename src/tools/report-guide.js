import { getOrganizationList } from "../org-list.js";

export function register(server) {
  server.tool(
    "available_reports",
    "Guía de reportes y lista de organizaciones. Ejecuta este tool cuando el usuario pida un reporte, análisis de ventas, transacciones o datos comerciales. " +
    "Devuelve las organizaciones disponibles y el flujo correcto para generar reportes.",
    {},
    async () => {
      const orgList = await getOrganizationList();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            organizacionesDisponibles: orgList,
            instruccion: "Muestra la lista de organizaciones al usuario y pregunta: '¿De cuál organización quieres el reporte?' Espera su respuesta antes de continuar.",
            flujo: {
              resumen: "Todo reporte se genera por organización. Nunca iteres sobre múltiples organizaciones.",
              pasos: [
                "1. Muestra las organizaciones de arriba y pregunta cuál quiere el usuario. Espera respuesta.",
                "2. Con la organización confirmada, ejecuta el tool de reporte usando orgName.",
              ],
              reglas: [
                "Si el usuario ya mencionó una organización (ej: 'Sodexo Energía'), ve directo al paso 2.",
                "Si pide 'todos' o 'todas las organizaciones', responde: 'Los reportes se generan por organización. ¿Cuál quieres consultar?'",
                "Un reporte = una organización. Nunca hagas loops sobre la lista.",
                "get_store_config, get_payment_errors y get_payment_summary operan a nivel de COMERCIO específico — esos sí piden storeName.",
              ],
            },
            reportes: [
              { tool: "get_commercial_comparison", param: "orgName", para: "ventas, crecimiento, ranking de comercios de la org" },
              { tool: "get_commercial_risk", param: "orgName", para: "alertas, riesgos, tiendas inactivas" },
              { tool: "get_transactions_daily", param: "orgName", para: "actividad diaria, tendencias" },
              { tool: "get_transactions_totals", param: "orgName", para: "KPIs totales, resumen global" },
              { tool: "get_low_transactions", param: "orgName", para: "bajo rendimiento, comercios bajo umbral" },
              { tool: "get_payments_rejected", param: "orgName", para: "pagos rechazados, errores" },
              { tool: "get_payments_methods", param: "orgName", para: "métodos de pago, tasas de aprobación" },
              { tool: "get_features_usage", param: "orgName", para: "cupones, wallet, promociones" },
              { tool: "get_user_experience", param: "orgName", para: "abandono, conversión, UX" },
              { tool: "get_system_pos_errors", param: "orgName", para: "errores POS, fallas de integración" },
              { tool: "get_store_config", param: "storeName", para: "configuración de UN comercio específico" },
              { tool: "get_payment_errors", param: "storeName", para: "errores de pago de UN comercio específico" },
              { tool: "get_payment_summary", param: "storeName", para: "resumen de pagos de UN comercio específico" },
            ],
            periodos: ["day", "week", "month", "6months", "o startDate/endDate YYYY-MM-DD (máx 6 meses)"],
          }, null, 2),
        }],
      };
    }
  );
}