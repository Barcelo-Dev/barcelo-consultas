import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "camarero" | "supervisor" | "admin";

export type SessionInfo = {
  userId: string;
  email: string | null;
  role: Role | null;
  name: string | null;
  username: string | null;
};

// Usuario logueado + su rol (leído con service_role).
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name, username")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role as Role) ?? null,
    name: profile?.full_name ?? null,
    username: profile?.username ?? null,
  };
}

// Quién puede entrar al portal de consultas: admin y supervisor.
export const puedeConsultar = (r: Role | null) => r === "admin" || r === "supervisor";
// Quién puede gestionar usuarios: solo admin.
export const esAdmin = (r: Role | null) => r === "admin";
