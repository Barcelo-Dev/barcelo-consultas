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
  const [role, setRole] = useState<"camarero" | "supervisor" | "admin">("camarero");

  // Editar (usuario en edición)
  const [editId, setEditId] = useState<string | null>(null);
  const [eUsername, setEUsername] = useState("");
  const [eFullName, setEFullName] = useState("");
  const [eRole, setERole] = useState<"camarero" | "supervisor" | "admin">("camarero");
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
    setERole(u.role);
    setEPassword("");
    setMsg(null);
  }

  async function guardarEdicion(u: ManagedUser) {
    const payload: Record<string, unknown> = {
      action: "update", id: u.id, username: eUsername, fullName: eFullName, role: eRole,
    };
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
            <PasswordField required value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value as "camarero" | "supervisor" | "admin")} className={inputCls}>
              <option value="camarero">Camarero</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
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
                        {isSelf ? (
                          <span className="inline-block rounded-full bg-barcelo-cream px-2.5 py-0.5 text-xs font-medium text-barcelo-deep" title="No puedes cambiar tu propio rol">{roleLabel[u.role]}</span>
                        ) : (
                          <select value={eRole} onChange={e => setERole(e.target.value as "camarero" | "supervisor" | "admin")} className={inputCls}>
                            <option value="camarero">Camarero</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                        <PasswordField value={ePassword} onChange={setEPassword} placeholder="Nueva contraseña (opcional)" className="mt-2" />
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
                          <button onClick={() => abrirEdicion(u)} className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink hover:bg-barcelo-cream">Editar</button>
                          {!isSelf && (
                            <button onClick={() => eliminar(u)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60">Eliminar</button>
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

// Campo de contraseña: oculta el texto y agrega un "ojito" para mostrarla.
function PasswordField({
  value, onChange, placeholder, required, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const base = "w-full rounded-lg border border-barcelo-gray/30 py-2 pl-3 pr-10 text-sm outline-none focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20";
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type={show ? "text" : "password"}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className={base}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-barcelo-gray transition hover:text-barcelo-ink"
      >
        {show ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}
