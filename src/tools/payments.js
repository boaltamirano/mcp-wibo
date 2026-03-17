import { z } from "zod";
import { getDb } from "../db.js";
import { resolveOrThrow } from "../store-resolver.js";
import { storeNameParam, ok } from "../api.js";
import { QUERY_TIMEOUT_MS } from "../config.js";

export function register(server) {
  // ── get_payment_errors ────────────────────────────────────
  server.tool(
    "get_payment_errors",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "Analiza errores de pago de cualquier método (getnet, transbank, fpay, mercadopago, klap, niubiz, etc). " +
    "Agrupa errores por código y mensaje, muestra frecuencia y porcentaje.",
    {
      storeName: storeNameParam,
      paymentMethod: z.string().optional().describe(
        "Método de pago a filtrar: getnet, transbank, fpay, mercadopago, klap, niubiz, cash, etc. Omitir = todos."
      ),
      months: z.number().optional().describe("Meses hacia atrás a consultar. Default: 3"),
    },
    async ({ storeName, paymentMethod, months = 3 }) => {
      const { storeId } = await resolveOrThrow(storeName);
      const database = await getDb();

      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const match = {
        store_id: storeId,
        created_at: { $gte: since.toISOString() },
      };
      if (paymentMethod) {
        match["payment_details.payment_method.id"] = paymentMethod;
      }

      const totalOrders = await database.collection("orders").countDocuments(match, { maxTimeMS: QUERY_TIMEOUT_MS });

      const errorAgg = await database.collection("orders").aggregate([
        { $match: { ...match, "payment.request.data.response.responseCode": { $exists: true, $ne: 0 } } },
        {
          $group: {
            _id: {
              responseCode: "$payment.request.data.response.responseCode",
              responseMessage: "$payment.request.data.response.responseMessage",
              paymentMethod: "$payment_details.payment_method.id",
            },
            count: { $sum: 1 },
            lastOccurrence: { $max: "$created_at" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

      const noResponseCount = await database.collection("orders").countDocuments({
        ...match,
        "payment.request.data.response": { $exists: false },
        "payment_details.payment_method.id": { $exists: true },
      }, { maxTimeMS: QUERY_TIMEOUT_MS });

      const errors = errorAgg.map((e) => ({
        paymentMethod: e._id.paymentMethod || "desconocido",
        responseCode: e._id.responseCode,
        responseMessage: e._id.responseMessage || "Sin mensaje",
        count: e.count,
        percentage: totalOrders > 0 ? `${((e.count / totalOrders) * 100).toFixed(1)}%` : "N/A",
        lastOccurrence: e.lastOccurrence,
      }));

      return ok({
        storeName,
        period: `Últimos ${months} meses`,
        totalOrders,
        totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
        ordersWithoutPaymentResponse: noResponseCount,
        errorsByType: errors,
      });
    }
  );

  // ── get_payment_summary ───────────────────────────────────
  server.tool(
    "get_payment_summary",
    "REQUIERE ORGANIZACIÓN — Si el usuario no especificó organización o comercio, usa list_organizations PRIMERO. " +
    "Resumen de pagos por método: total de órdenes, aprobadas, rechazadas y tasa de éxito por cada método de pago.",
    {
      storeName: storeNameParam,
      months: z.number().optional().describe("Meses hacia atrás. Default: 3"),
    },
    async ({ storeName, months = 3 }) => {
      const { storeId } = await resolveOrThrow(storeName);
      const database = await getDb();

      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const summary = await database.collection("orders").aggregate([
        {
          $match: {
            store_id: storeId,
            created_at: { $gte: since.toISOString() },
            "payment_details.payment_method.id": { $exists: true },
          },
        },
        {
          $group: {
            _id: "$payment_details.payment_method.id",
            total: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ["$payment.request.data.response.responseCode", 0] }, 1, 0] },
            },
            totalAmount: { $sum: { $ifNull: ["$payment_details.amounts.total", 0] } },
          },
        },
        { $sort: { total: -1 } },
      ], { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();

      const results = summary.map((s) => ({
        paymentMethod: s._id,
        totalOrders: s.total,
        approved: s.approved,
        rejected: s.total - s.approved,
        approvalRate: s.total > 0 ? `${((s.approved / s.total) * 100).toFixed(1)}%` : "N/A",
        totalAmount: s.totalAmount,
      }));

      return ok({
        storeName,
        period: `Últimos ${months} meses`,
        paymentMethods: results,
        totals: {
          orders: results.reduce((sum, r) => sum + r.totalOrders, 0),
          approved: results.reduce((sum, r) => sum + r.approved, 0),
          rejected: results.reduce((sum, r) => sum + r.rejected, 0),
        },
      });
    }
  );
}
