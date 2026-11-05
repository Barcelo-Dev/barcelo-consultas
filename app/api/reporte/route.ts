import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarReporte, type Registro } from "@/lib/reporte";

export const dynamic = "force-dynamic";

// Envía el reporte. Se permite de dos formas:
//  1) Botón del panel: hay una sesión de admin (cookies).
//  2) Tarea programada (Vercel Cron): trae el encabezado
//     Authorization: Bearer <CRON_SECRET>.
async function autorizado(request: Request): Promise<boolean> {
  // ¿Viene de la tarea programada con el secreto correcto?
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  // ¿Viene de un admin con sesión iniciada?
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function enviar(request: Request, toOverride?: string[]) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscribers")
    .select("email, full_name, room_number, confirmed, coupon_code, coupon_redeemed, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al leer registros:", error);
    return NextResponse.json({ error: "No se pudieron leer los registros." }, { status: 500 });
  }

  try {
    await enviarReporte((data ?? []) as Registro[], toOverride);
  } catch (e) {
    console.error("Error al enviar el reporte:", e);
    return NextResponse.json({ error: "No se pudo enviar el reporte." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, enviados: (data ?? []).length });
}

// El botón del panel usa POST y puede traer los correos escritos a mano.
export async function POST(request: Request) {
  let correos: string[] | undefined;
  try {
    const body = await request.json();
    const crudos = String(body?.to ?? "")
      .split(",")
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
    if (crudos.length > 0) {
      const invalido = crudos.find((c: string) => !EMAIL_RE.test(c));
      if (invalido) {
        return NextResponse.json({ error: `Correo inválido: ${invalido}` }, { status: 400 });
      }
      correos = crudos;
    }
  } catch {
    // Sin cuerpo: se usará el correo fijo por defecto.
  }
  return enviar(request, correos);
}

// Vercel Cron invoca el endpoint con GET.
export async function GET(request: Request) {
  return enviar(request);
}
