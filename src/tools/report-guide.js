import { ok } from "../api.js";

export function register(server) {
  server.tool(
    "available_reports",
    "IMPORTANTE: Consulta este tool ANTES de generar cualquier reporte. " +
    "Lista todos los reportes disponibles con ejemplos de uso. " +
    "Los reportes SOLO se generan con los tools de API listados aquí, NUNCA con query_mongodb. " +
    "El rango máximo de fechas es 6 meses.",
    {},
    async () => ok({
      instrucciones: "Usa ÚNICAMENTE estos tools para generar reportes. NO uses query_mongodb para reportes. El rango máximo de fechas es 6 meses.",
      reportes: [
        {
          tool: "get_commercial_comparison",
          descripcion: "Comparación de ventas entre período actual y anterior",
          usosPara: "desempeño, ventas, crecimiento, ranking de tiendas",
          ejemplo: 'get_commercial_comparison({ storeName: "Montaditos", period: "month" })',
          ejemploFechas: 'get_commercial_comparison({ storeName: "Montaditos", startDate: "2026-01-01", endDate: "2026-03-31" })',
        },
        {
          tool: "get_commercial_risk",
          descripcion: "Tiendas en riesgo por caída de ventas o inactividad",
          usosPara: "alertas, riesgos, tiendas inactivas, caídas de ventas",
          ejemplo: 'get_commercial_risk({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_transactions_daily",
          descripcion: "Transacciones diarias con métricas y promedios por tienda",
          usosPara: "actividad diaria, ventas diarias, tendencias",
          ejemplo: 'get_transactions_daily({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_transactions_totals",
          descripcion: "Totales agregados: transacciones exitosas, ventas totales, usuarios",
          usosPara: "resumen global, KPIs totales, cuántas órdenes hubo",
          ejemplo: 'get_transactions_totals({ storeName: "Montaditos", startDate: "2026-02-01", endDate: "2026-02-28" })',
        },
        {
          tool: "get_low_transactions",
          descripcion: "Tiendas con transacciones bajo umbral mínimo semanal",
          usosPara: "bajo rendimiento, alertas de actividad, tiendas flojas",
          ejemplo: 'get_low_transactions({ storeName: "Montaditos", period: "month", threshold: 140 })',
        },
        {
          tool: "get_payments_rejected",
          descripcion: "Transacciones rechazadas por motivo y método de pago",
          usosPara: "pagos rechazados, errores de pago, tasa de rechazo",
          ejemplo: 'get_payments_rejected({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_payments_methods",
          descripcion: "Estadísticas por método de pago: aprobación, rechazo, errores",
          usosPara: "métodos de pago, tasas de éxito, comparar métodos",
          ejemplo: 'get_payments_methods({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_features_usage",
          descripcion: "Adopción de funcionalidades: cupones, wallet, beneficiarios, promociones",
          usosPara: "uso de features, adopción, cupones, wallet",
          ejemplo: 'get_features_usage({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_user_experience",
          descripcion: "Métricas de UX: abandono, reintentos, completitud del flujo de compra",
          usosPara: "experiencia de usuario, abandono, conversión",
          ejemplo: 'get_user_experience({ storeName: "Montaditos", period: "month" })',
        },
        {
          tool: "get_system_pos_errors",
          descripcion: "Errores del sistema POS agrupados por sistema y tipo",
          usosPara: "fallas POS, errores de fudo, mrc, justo, nutriserv",
          ejemplo: 'get_system_pos_errors({ storeName: "Montaditos", period: "month" })',
        },
      ],
      periodos: {
        predefinidos: ["day", "week", "month", "6months"],
        personalizados: "Usa startDate y endDate en formato YYYY-MM-DD (máximo 6 meses de rango)",
        ejemplos: [
          "Enero a Junio: startDate='2026-01-01', endDate='2026-06-30'",
          "Febrero a Julio: startDate='2026-02-01', endDate='2026-07-31'",
          "Solo febrero: startDate='2026-02-01', endDate='2026-02-28'",
        ],
      },
      nota: "Para buscar el nombre exacto de un comercio usa search_stores antes de pedir un reporte.",
    })
  );
}
