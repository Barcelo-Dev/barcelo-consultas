import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Traduce un "usuario o correo" al correo con el que Supabase inicia sesión.
// - Si trae "@", se toma como correo tal cual.
// - Si es un nombre de usuario, se busca el correo asociado en profiles.
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ email: "" }); }
  const id = String((body as { identificador?: string })?.identificador ?? "").trim();
  if (!id) return NextResponse.json({ email: "" });

  if (id.includes("@")) return NextResponse.json({ email: id.toLowerCase() });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", id) // coincidencia exacta sin distinguir mayúsculas
    .single();

  if (!profile) return NextResponse.json({ email: id }); // deja que el login falle genéricamente

  const { data } = await admin.auth.admin.getUserById(profile.id);
  return NextResponse.json({ email: data?.user?.email ?? id });
}
