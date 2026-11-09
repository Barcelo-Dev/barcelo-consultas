import { NextResponse } from "next/server";
import { getSession, puedeEliminar } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Eliminación de registros. SOLO para los usuarios autorizados
// (ver ELIMINADORES en lib/roles.ts). La verificación es del lado del
// servidor: aunque alguien manipule el navegador, aquí se rechaza.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!puedeEliminar(session.username))
    return NextResponse.json({ error: "No tienes permiso para eliminar registros." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Petición inválida." }, { status: 400 }); }

  const action = String(body?.action ?? "");
  const admin = createAdminClient();

  // --- Eliminar un registro por su id ---
  if (action === "delete_one") {
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });

    const { error } = await admin.from("subscribers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "No se pudo eliminar el registro." }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: 1 });
  }

  // --- Eliminar TODOS los registros ---
  if (action === "delete_all") {
    // Cuenta antes de borrar (para informar cuántos se eliminaron).
    const { count } = await admin.from("subscribers").select("id", { count: "exact", head: true });

    // Borra todo. El filtro "id no es nulo" aplica a todas las filas;
    // Supabase exige un filtro en los delete, por eso se usa este.
    const { error } = await admin.from("subscribers").delete().not("id", "is", null);
    if (error) return NextResponse.json({ error: "No se pudieron eliminar los registros." }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  }

  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
