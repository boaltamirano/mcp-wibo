export function register(server) {
  server.tool(
    "how_to_use",
    "Guía de uso del MCP de Wibo con ejemplos de prompts por categoría. " +
    "Ejecuta este tool cuando el usuario pregunte cómo usar el MCP, qué puede preguntar, o pida ejemplos.",
    {},
    async () => {
      const guide = {
        titulo: "Wibo MCP v8.0 — Guía de uso",
        resumen: "20 herramientas: 10 reportes API (por organización) + 8 MongoDB + 1 guía + 1 utilidad",
        importante: [
          "Los reportes API operan a nivel ORGANIZACIÓN (orgName). Si no sabes cuál, usa list_organizations.",
          "get_store_config, get_payment_errors y get_payment_summary operan a nivel COMERCIO (storeName).",
          "Períodos: 'day', 'week', 'month', '6months', o startDate/endDate YYYY-MM-DD (máx 6 meses).",
          "Puedes buscar por nombre — no necesitas IDs técnicos.",
        ],
        categorias: [
          {
            nombre: "Búsqueda y exploración",
            tipo: "MongoDB",
            ejemplos: [
              "¿Qué comercios hay disponibles?",
              "Busca comercios que se llamen 'Pollo'",
              "¿Qué colecciones hay en la base de datos?",
              "¿Qué campos tiene la colección orders?",
              "¿Cuántas órdenes hay en total?",
              "Muéstrame las últimas 10 órdenes creadas",
            ],
          },
          {
            nombre: "Configuración de comercio",
            tipo: "MongoDB (storeName)",
            ejemplos: [
              "¿Qué métodos de pago tiene habilitados Pollo Bravo?",
              "¿Qué POS usa Kiosko Chacay Centro?",
              "Muéstrame la configuración de Sushi Express Mall",
            ],
          },
          {
            nombre: "Errores y pagos por comercio",
            tipo: "MongoDB (storeName)",
            ejemplos: [
              "¿Qué errores de pago ha tenido Pollo Bravo en los últimos 3 meses?",
              "Muéstrame los errores de Getnet en Kiosko Chacay Centro",
              "¿Cuál es la tasa de aprobación de pagos en Pollo Bravo?",
              "Resumen de pagos aprobados vs rechazados de Kiosko Chacay Centro",
            ],
          },
          {
            nombre: "Ventas y transacciones",
            tipo: "API (orgName)",
            ejemplos: [
              "¿Cómo le fue a Sodexo Energía este mes comparado con el anterior?",
              "¿Cuántas transacciones diarias tuvo Sodexo Energía esta semana?",
              "¿Cuáles son los totales de Sodexo Energía este mes?",
              "¿Qué método de pago se usa más en Sodexo Energía?",
              "¿Por qué se están rechazando pagos en Sodexo Energía?",
            ],
          },
          {
            nombre: "Alertas y riesgos",
            tipo: "API (orgName)",
            ejemplos: [
              "¿Qué tiendas de Sodexo Energía tienen alertas de riesgo?",
              "¿Hay tiendas que hayan caído más del 50% en ventas?",
              "¿Qué tiendas tienen bajo volumen de transacciones?",
              "¿Qué errores de POS tiene Sodexo Energía?",
            ],
          },
          {
            nombre: "Features y experiencia de usuario",
            tipo: "API (orgName)",
            ejemplos: [
              "¿Qué features están usando en Sodexo Energía?",
              "¿Cuántos cupones se han redimido este mes?",
              "¿Cuál es la tasa de abandono en Sodexo Energía?",
              "Métricas de experiencia de usuario de Sodexo Energía",
            ],
          },
          {
            nombre: "Consultas avanzadas (combinan múltiples tools)",
            tipo: "Mixto",
            ejemplos: [
              "Hazme un diagnóstico completo de Sodexo Energía: ventas, errores de pago, configuración y alertas",
              "Genera un reporte semanal ejecutivo de Sodexo Energía",
              "Analiza la salud de pagos de Kiosko Chacay Centro: errores, tasa de aprobación y rechazos",
              "¿Cuántas órdenes con cupón se han hecho en los últimos 7 días?",
            ],
          },
        ],
        tips: [
          "Búsqueda por nombre: No necesitas el nombre exacto. Si dices 'Kiosko', Claude buscará todos los que coincidan.",
          "Períodos: Puedes usar lenguaje natural — 'esta semana', 'el último mes', 'del 1 al 15 de enero'.",
          "Métodos de pago soportados: getnet, transbank, fpay, mercadopago, klap, niubiz, cash, wallet.",
          "Consultas abiertas: Para datos que no cubren los tools especializados, Claude usa query_mongodb.",
        ],
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(guide, null, 2),
        }],
      };
    }
  );
}
