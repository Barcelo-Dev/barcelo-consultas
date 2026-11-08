import { NextResponse } from "next/server";
import { getSession } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

// Roles que se pueden asignar desde la web (los tres son distintos).
const ASIGNABLES = ["camarero", "supervisor", "admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_RE = /^[a-zA-Z0-9._-]{3,30}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin")
    return NextResponse.json({ error: "Solo un administrador puede gestionar usuarios." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Petición inválida." }, { status: 400 }); }

  const action = String(body?.action ?? "");
  const admin = createAdminClient();

  // Verifica que el nombre de usuario no esté tomado por OTRA persona.
  async function usuarioDisponible(username: string, exceptoId?: string) {
    const { data } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
    return !data || data.id === exceptoId;
  }

  // Cuenta cuántos administradores hay (para no quedarnos sin ninguno).
  async function totalAdmins() {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    return count ?? 0;
  }

  // --- Crear usuario ---
  if (action === "create") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    const role = String(body?.role ?? "camarero");
    const fullName = String(body?.fullName ?? "").trim() || null;

    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
    if (username && !USER_RE.test(username))
      return NextResponse.json({ error: "El usuario debe tener 3–30 caracteres (letras, números, . _ -)." }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    if (!ASIGNABLES.includes(role)) return NextResponse.json({ error: "Rol no permitido." }, { status: 400 });
    if (username && !(await usuarioDisponible(username)))
      return NextResponse.json({ error: "Ese nombre de usuario ya existe." }, { status: 400 });

    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      const msg = error?.message?.includes("already") ? "Ese correo ya existe." : "No se pudo crear el usuario.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    await admin.from("profiles").upsert({ id: data.user.id, role, full_name: fullName, username: username || null });
    return NextResponse.json({ ok: true });
  }

  // --- Editar usuario (nombre, usuario, rol y/o contraseña) ---
  if (action === "update") {
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "Usuario no indicado." }, { status: 400 });

    const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
    if (!target) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

    const fullName = body?.fullName !== undefined ? (String(body.fullName).trim() || null) : undefined;
    const username = body?.username !== undefined ? String(body.username).trim() : undefined;
    const role = body?.role !== undefined ? String(body.role) : undefined;
    const password = body?.password ? String(body.password) : undefined;

    if (username !== undefined && username && !USER_RE.test(username))
      return NextResponse.json({ error: "El usuario debe tener 3–30 caracteres (letras, números, . _ -)." }, { status: 400 });
    if (username !== undefined && username && !(await usuarioDisponible(username, id)))
      return NextResponse.json({ error: "Ese nombre de usuario ya existe." }, { status: 400 });
    if (password !== undefined && password.length < 6)
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });

    // Protecciones al cambiar el rol.
    if (role !== undefined && role !== target.role) {
      if (!ASIGNABLES.includes(role))
        return NextResponse.json({ error: "Rol no permitido." }, { status: 400 });
      if (id === session.userId)
        return NextResponse.json({ error: "No puedes cambiar tu propio rol (para no perder el acceso)." }, { status: 400 });
      // No dejar al sistema sin ningún administrador.
      if (target.role === "admin" && role !== "admin" && (await totalAdmins()) <= 1)
        return NextResponse.json({ error: "Debe quedar al menos un administrador." }, { status: 400 });
    }

    // Cambios en profiles (nombre, usuario, rol).
    const cambiosPerfil: Record<string, unknown> = {};
    if (fullName !== undefined) cambiosPerfil.full_name = fullName;
    if (username !== undefined) cambiosPerfil.username = username || null;
    if (role !== undefined) cambiosPerfil.role = role;
    if (Object.keys(cambiosPerfil).length > 0) {
      const { error } = await admin.from("profiles").update(cambiosPerfil).eq("id", id);
      if (error) return NextResponse.json({ error: "No se pudieron guardar los cambios." }, { status: 500 });
    }

    // Cambio de contraseña (vía Auth).
    if (password !== undefined) {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return NextResponse.json({ error: "No se pudo cambiar la contraseña." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // --- Eliminar usuario ---
  if (action === "delete") {
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "Usuario no indicado." }, { status: 400 });
    if (id === session.userId)
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });

    const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
    // No dejar al sistema sin ningún administrador.
    if (target?.role === "admin" && (await totalAdmins()) <= 1)
      return NextResponse.json({ error: "Debe quedar al menos un administrador." }, { status: 400 });

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: "No se pudo eliminar el usuario." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
