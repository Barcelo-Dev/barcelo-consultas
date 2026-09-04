import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import DashboardClient, { type Subscriber } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("id, email, full_name, room_number, source, consent, confirmed, coupon_code, coupon_redeemed, exported_at, created_at")
    .order("created_at", { ascending: false });

  const rows = (subscribers ?? []) as Subscriber[];

  return (
    <div className="min-h-[100svh]">
      <header className="border-b border-barcelo-gray/15 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <img src="/logo.png" alt="Barceló Guatemala City" className="h-7 w-auto" />
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-barcelo-gray sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink transition hover:bg-barcelo-cream">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        {error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No se pudieron cargar los registros: {error.message}</p>
        ) : (
          <DashboardClient rows={rows} />
        )}
      </main>
    </div>
  );
}
