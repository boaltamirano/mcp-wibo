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
              resumen: "Todo reporte necesita 1 organización + 1 comercio.",
              pasos: [
                "1. Muestra las organizaciones de arriba y pregunta cuál quiere el usuario. Espera respuesta.",
                "2. Con la organización elegida, usa search_stores para ver sus comercios. Pregunta cuál. Espera respuesta.",
                "3. Con organización y comercio confirmados, ejecuta el tool de reporte.",
              ],
              reglas: [
                "Si el usuario ya mencionó un comercio específico (ej: 'Pollo Bravo'), ve directo al paso 3.",
                "Si pide 'todos', responde: 'Los reportes se generan por organización y comercio. ¿Cuál quieres consultar?'",
                "Un reporte = una organización + un comercio. No iteres sobre múltiples.",
              ],
            },
            reportes: [
              { tool: "get_commercial_comparison", para: "ventas, crecimiento, ranking" },
              { tool: "get_commercial_risk", para: "alertas, riesgos, tiendas inactivas" },
              { tool: "get_transactions_daily", para: "actividad diaria, tendencias" },
              { tool: "get_transactions_totals", para: "KPIs totales, resumen global" },
              { tool: "get_low_transactions", para: "bajo rendimiento, alertas" },
              { tool: "get_payments_rejected", para: "pagos rechazados, errores" },
              { tool: "get_payments_methods", para: "métodos de pago, tasas" },
              { tool: "get_features_usage", para: "cupones, wallet, promociones" },
              { tool: "get_user_experience", para: "abandono, conversión, UX" },
              { tool: "get_system_pos_errors", para: "errores POS, fallas" },
            ],
            periodos: ["day", "week", "month", "6months", "o startDate/endDate YYYY-MM-DD (máx 6 meses)"],
          }, null, 2),
        }],
      };
    }
  );
}
