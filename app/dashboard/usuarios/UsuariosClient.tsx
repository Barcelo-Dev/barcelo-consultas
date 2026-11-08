"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ManagedUser = {
  id: string;
  email: string;
  username: string | null;
  role: "camarero" | "supervisor" | "admin";
  full_name: string | null;
};

const roleLabel: Record<string, string> = { camarero: "Camarero", supervisor: "Supervisor", admin: "Administrador" };

export default function UsuariosClient({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Crear
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"camarero" | "supervisor">("camarero");

  // Editar (usuario en edición)
  const [editId, setEditId] = useState<string | null>(null);
  const [eUsername, setEUsername] = useState("");
  const [eFullName, setEFullName] = useState("");
  const [eRole, setERole] = useState<"camarero" | "supervisor">("camarero");
  const [ePassword, setEPassword] = useState("");

  async function call(payload: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error ?? "Error." }); return false; }
      return true;
    } catch {
      setMsg({ type: "err", text: "Problema de conexión." }); return false;
    } finally { setBusy(false); }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call({ action: "create", email, username, fullName, password, role });
    if (ok) {
      setMsg({ type: "ok", text: `Usuario ${email} creado.` });
      setEmail(""); setUsername(""); setFullName(""); setPassword(""); setRole("camarero");
      router.refresh();
    }
  }

  function abrirEdicion(u: ManagedUser) {
    setEditId(u.id);
    setEUsername(u.username ?? "");
    setEFullName(u.full_name ?? "");
    setERole(u.role === "supervisor" ? "supervisor" : "camarero");
    setEPassword("");
    setMsg(null);
  }

  async function guardarEdicion(u: ManagedUser) {
    const payload: Record<string, unknown> = {
      action: "update", id: u.id, username: eUsername, fullName: eFullName,
    };
    if (u.role !== "admin") payload.role = eRole;        // el rol de un admin no se cambia aquí
    if (ePassword.trim()) payload.password = ePassword;  // solo si se escribió una nueva
    const ok = await call(payload);
    if (ok) { setMsg({ type: "ok", text: "Cambios guardados." }); setEditId(null); router.refresh(); }
  }

  async function eliminar(u: ManagedUser) {
    if (!confirm(`¿Eliminar al usuario ${u.email}? Esta acción no se puede deshacer.`)) return;
    const ok = await call({ action: "delete", id: u.id });
    if (ok) { setMsg({ type: "ok", text: "Usuario eliminado." }); router.refresh(); }
  }

  const inputCls = "w-full rounded-lg border border-barcelo-gray/30 px-3 py-2 text-sm outline-none focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20";

  return (
    <div>
      {/* Crear usuario */}
      <div className="rounded-2xl border border-barcelo-gray/15 bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-barcelo-deep">Crear usuario</h2>
        <form onSubmit={crear} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Correo</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Nombre de usuario</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="ej. jperez" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Nombre <span className="text-barcelo-gray">(opcional)</span></label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Contraseña</label>
            <input type="text" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value as "camarero" | "supervisor")} className={inputCls}>
              <option value="camarero">Camarero</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-barcelo-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-barcelo-deep disabled:opacity-60">
              {busy ? "Guardando…" : "Crear usuario"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-barcelo-gray">El usuario podrá iniciar sesión con su nombre de usuario o con su correo.</p>
        {msg && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
        )}
      </div>

      {/* Lista */}
      <div className="mt-8 overflow-x-auto rounded-xl border border-barcelo-gray/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-barcelo-gray/15 text-xs uppercase tracking-wide text-barcelo-gray">
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = u.id === currentUserId;
              const isAdmin = u.role === "admin";
              const bloqueado = isAdmin && !isSelf;
              const editing = editId === u.id;
              return (
                <tr key={u.id} className="border-b border-barcelo-gray/10 align-top last:border-0">
                  <td className="px-4 py-3 font-medium text-barcelo-ink">
                    {u.email}{isSelf && <span className="ml-2 text-xs text-barcelo-gray">(tú)</span>}
                  </td>
                  {editing ? (
                    <>
                      <td className="px-4 py-3"><input value={eUsername} onChange={e => setEUsername(e.target.value)} placeholder="usuario" className={inputCls} /></td>
                      <td className="px-4 py-3"><input value={eFullName} onChange={e => setEFullName(e.target.value)} placeholder="nombre" className={inputCls} /></td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-block rounded-full bg-barcelo-cream px-2.5 py-0.5 text-xs font-medium text-barcelo-deep">Administrador</span>
                        ) : (
                          <select value={eRole} onChange={e => setERole(e.target.value as "camarero" | "supervisor")} className={inputCls}>
                            <option value="camarero">Camarero</option>
                            <option value="supervisor">Supervisor</option>
                          </select>
                        )}
                        <input value={ePassword} onChange={e => setEPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" className={`${inputCls} mt-2`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditId(null)} className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm hover:bg-barcelo-cream">Cancelar</button>
                          <button onClick={() => guardarEdicion(u)} disabled={busy} className="rounded-lg bg-barcelo-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-barcelo-deep disabled:opacity-60">Guardar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-barcelo-ink/80">{u.username || "—"}</td>
                      <td className="px-4 py-3 text-barcelo-ink/80">{u.full_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-barcelo-cream px-2.5 py-0.5 text-xs font-medium text-barcelo-deep">{roleLabel[u.role]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {bloqueado ? (
                            <span className="text-xs text-barcelo-gray">Gestionado en Supabase</span>
                          ) : (
                            <>
                              <button onClick={() => abrirEdicion(u)} className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink hover:bg-barcelo-cream">Editar</button>
                              {!isSelf && !isAdmin && (
                                <button onClick={() => eliminar(u)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60">Eliminar</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-barcelo-gray">
        Al editar puedes cambiar el nombre de usuario, el nombre, el rol y la contraseña. La contraseña solo cambia si escribes una nueva.
      </p>
    </div>
  );
}
