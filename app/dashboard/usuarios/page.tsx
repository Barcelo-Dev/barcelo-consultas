import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import UsuariosClient, { type ManagedUser } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const { data: profiles } = await admin.from("profiles").select("id, role, full_name, username");

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const users: ManagedUser[] = (list?.users ?? []).map((u) => {
    const p = byId.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      username: p?.username ?? null,
      role: (p?.role as ManagedUser["role"]) ?? "camarero",
      full_name: p?.full_name ?? null,
    };
  }).sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="min-h-[100svh]">
      <header className="border-b border-barcelo-gray/15 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-6">
          <img src="/logo.png" alt="Barceló Guatemala City" className="h-7 w-auto" />
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink transition hover:bg-barcelo-cream">
              ← Panel
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink transition hover:bg-barcelo-cream">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-barcelo-ink">Gestión de usuarios</h1>
        <p className="mt-1 text-sm text-barcelo-gray">
          Crea, edita y elimina usuarios del sistema. Los administradores se gestionan directamente en Supabase.
        </p>
        <div className="mt-6">
          <UsuariosClient users={users} currentUserId={session.userId} />
        </div>
      </main>
    </div>
  );
}
