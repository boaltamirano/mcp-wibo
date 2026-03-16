import { ADMIN_KEY } from "./config.js";

export function requireAdmin(adminKey) {
  if (!ADMIN_KEY) throw new Error("ADMIN_KEY no configurada en el servidor.");
  if (adminKey !== ADMIN_KEY) throw new Error("Clave de administrador incorrecta.");
}
