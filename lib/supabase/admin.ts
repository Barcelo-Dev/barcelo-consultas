import { createClient } from "@supabase/supabase-js";

// Cliente SOLO de servidor (service_role, ignora RLS).
// Se usa en la API del reporte para leer los registros tanto cuando lo
// dispara un admin (botón) como cuando lo dispara la tarea programada
// (donde no hay sesión de usuario). Nunca se expone al navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
