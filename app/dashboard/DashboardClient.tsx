"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export type Subscriber = {
  id: string;
  email: string;
  full_name: string | null;
  room_number: string | null;
  source: string | null;
  consent: boolean;
  confirmed: boolean;
  coupon_code: string | null;
  coupon_redeemed: boolean;
  exported_at: string | null;
  created_at: string;
};

type Period = "month" | "all";
type StatusFilter = "todos" | "confirmados" | "pendientes";

// ---- Helpers de fecha (zona horaria de Guatemala) ----
const GT = "America/Guatemala";
function ymGT(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: GT, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}
function currentYM() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: GT, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}
// Solo fecha para el CSV (DD/MM/AAAA)
function dateOnly(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { timeZone: GT, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
// Fecha y hora para la tabla en pantalla
function dateTime(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { timeZone: GT, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
// Etiqueta de mes legible: "sep 2026"
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function csvCell(v: string | boolean | null) {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCSV(list: Subscriber[]) {
  const headers = ["Correo", "Nombre", "Habitación", "Confirmado", "Cupón", "Cupón redimido", "Fecha de registro"];
  const lines = list.map(r =>
    [r.email, r.full_name, r.room_number, r.confirmed ? "Sí" : "No", r.coupon_code, r.coupon_redeemed ? "Sí" : "No", dateOnly(r.created_at)]
      .map(csvCell).join(",")
  );
  return "\uFEFF" + [headers.join(","), ...lines].join("\n");
}
function download(csv: string, name: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardClient({ rows: initialRows }: { rows: Subscriber[] }) {
  const [rows, setRows] = useState<Subscriber[]>(initialRows);
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const thisYM = currentYM();

  // ---- Analítica (siempre sobre TODO el historial) ----
  const analytics = useMemo(() => {
    const total = rows.length;
    const confirmados = rows.filter(r => r.confirmed).length;
    const redimidos = rows.filter(r => r.coupon_redeemed).length;
    const thisMonth = rows.filter(r => ymGT(r.created_at) === thisYM).length;

    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const k = ymGT(r.created_at);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    }
    const monthsSorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const last12 = monthsSorted.slice(-12);
    const maxCount = Math.max(1, ...last12.map(([, c]) => c));
    const best = monthsSorted.reduce<[string, number] | null>((acc, cur) => (!acc || cur[1] > acc[1] ? cur : acc), null);

    return { total, confirmados, redimidos, thisMonth, last12, maxCount, best };
  }, [rows, thisYM]);

  const nuevosCount = useMemo(() => rows.filter(r => !r.exported_at).length, [rows]);

  // ---- Tabla filtrada (por periodo + búsqueda + estado) ----
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (period === "month" && ymGT(r.created_at) !== thisYM) return false;
      if (statusFilter === "confirmados" && !r.confirmed) return false;
      if (statusFilter === "pendientes" && r.confirmed) return false;
      if (query) {
        const q = query.toLowerCase();
        return r.email.toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q) ||
          (r.coupon_code ?? "").toLowerCase().includes(q) || (r.room_number ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, period, statusFilter, query, thisYM]);

  // ---- Exportaciones ----
  function exportAll() {
    setMenuOpen(false);
    download(buildCSV(rows), `barcelo-historial-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function exportNew() {
    setMenuOpen(false);
    const nuevos = rows.filter(r => !r.exported_at);
    if (nuevos.length === 0) { setNotice("No hay registros nuevos que exportar."); return; }
    download(buildCSV(nuevos), `barcelo-nuevos-${new Date().toISOString().slice(0, 10)}.csv`);

    // Marcar como exportados en la base de datos
    setBusy(true); setNotice("");
    try {
      const supabase = createBrowserSupabase();
      const now = new Date().toISOString();
      const ids = nuevos.map(r => r.id);
      const { error } = await supabase.from("subscribers").update({ exported_at: now }).in("id", ids);
      if (error) throw error;
      setRows(prev => prev.map(r => (ids.includes(r.id) ? { ...r, exported_at: now } : r)));
      setNotice(`Se exportaron ${nuevos.length} registros nuevos y se marcaron como exportados.`);
    } catch {
      setNotice("Se descargó el CSV, pero no se pudieron marcar como exportados. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-barcelo-ink">Panel de consultas</h1>
      <p className="mt-1 text-sm text-barcelo-gray">Resumen general y registros de huéspedes.</p>

      {/* ---- RESUMEN GENERAL (analítica) ---- */}
      <section className="mt-6 rounded-2xl border border-barcelo-gray/15 bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-barcelo-deep">Resumen general</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total de registros" value={analytics.total} />
          <Stat label="Correos confirmados" value={analytics.confirmados} />
          <Stat label="Cupones redimidos" value={analytics.redimidos} />
          <Stat label="Registros este mes" value={analytics.thisMonth} accent />
        </div>

        {/* Gráfica de registros por mes */}
        <div className="mt-6">
          <p className="text-sm font-medium text-barcelo-ink">Registros por mes</p>
          {analytics.last12.length === 0 ? (
            <p className="mt-3 text-sm text-barcelo-gray">Aún no hay datos.</p>
          ) : (
            <div className="mt-3 flex items-end gap-2 sm:gap-3" style={{ height: 160 }}>
              {analytics.last12.map(([ym, count]) => {
                const isBest = analytics.best && ym === analytics.best[0];
                return (
                  <div key={ym} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-barcelo-ink">{count}</span>
                    <div
                      className={`w-full rounded-t-md ${isBest ? "bg-barcelo-gold" : "bg-barcelo-teal"}`}
                      style={{ height: `${(count / analytics.maxCount) * 120}px` }}
                      title={`${monthLabel(ym)}: ${count}`}
                    />
                    <span className="mt-1 text-[10px] text-barcelo-gray sm:text-xs">{monthLabel(ym)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {analytics.best && (
            <p className="mt-4 rounded-lg bg-barcelo-cream px-3 py-2 text-sm text-barcelo-ink">
              📈 El mes con más registros fue{" "}
              <span className="font-semibold capitalize">{monthLabel(analytics.best[0])}</span>{" "}
              con <span className="font-semibold">{analytics.best[1]}</span>.
            </p>
          )}
        </div>
      </section>

      {/* ---- REGISTROS ---- */}
      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {/* Selector de periodo */}
            <div className="inline-flex rounded-lg border border-barcelo-gray/30 bg-white p-0.5">
              <button onClick={() => setPeriod("month")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${period === "month" ? "bg-barcelo-teal text-white" : "text-barcelo-ink"}`}>
                Mes actual
              </button>
              <button onClick={() => setPeriod("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${period === "all" ? "bg-barcelo-teal text-white" : "text-barcelo-ink"}`}>
                Todo el historial
              </button>
            </div>
          </div>

          {/* Exportar con opciones */}
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-barcelo-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-barcelo-deep disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {busy ? "Exportando…" : "Exportar CSV"}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-barcelo-gray/20 bg-white shadow-lg">
                <button onClick={exportAll} className="block w-full px-4 py-3 text-left text-sm hover:bg-barcelo-cream">
                  <span className="font-medium text-barcelo-ink">Todo el historial</span>
                  <span className="block text-xs text-barcelo-gray">{analytics.total} registros</span>
                </button>
                <button onClick={exportNew} className="block w-full border-t border-barcelo-gray/15 px-4 py-3 text-left text-sm hover:bg-barcelo-cream">
                  <span className="font-medium text-barcelo-ink">Solo registros nuevos</span>
                  <span className="block text-xs text-barcelo-gray">{nuevosCount} sin exportar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Búsqueda + estado */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por correo, nombre, habitación o cupón…"
            className="w-full rounded-lg border border-barcelo-gray/30 px-4 py-2 text-sm outline-none focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20 sm:max-w-xs" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-barcelo-gray/30 bg-white px-3 py-2 text-sm outline-none focus:border-barcelo-teal">
            <option value="todos">Todos</option>
            <option value="confirmados">Confirmados</option>
            <option value="pendientes">Pendientes</option>
          </select>
          <span className="text-sm text-barcelo-gray">{filtered.length} en vista</span>
        </div>

        {notice && <p className="mt-3 rounded-lg bg-barcelo-cream px-3 py-2 text-sm text-barcelo-ink">{notice}</p>}

        {/* Tabla */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-barcelo-gray/15 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-barcelo-gray/15 text-xs uppercase tracking-wide text-barcelo-gray">
                <th className="px-4 py-3 font-semibold">Correo</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Hab.</th>
                <th className="px-4 py-3 font-semibold">Cupón</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-barcelo-gray">No hay registros que coincidan.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-barcelo-gray/10 last:border-0 hover:bg-barcelo-cream/50">
                  <td className="px-4 py-3 font-medium text-barcelo-ink">{r.email}</td>
                  <td className="px-4 py-3 text-barcelo-ink/80">{r.full_name || "—"}</td>
                  <td className="px-4 py-3 text-barcelo-ink/80">{r.room_number || "—"}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-barcelo-deep">{r.coupon_code || "—"}</span></td>
                  <td className="px-4 py-3">
                    {r.confirmed ? <Badge tone="green">Confirmado</Badge> : <Badge tone="amber">Pendiente</Badge>}
                  </td>
                  <td className="px-4 py-3 text-barcelo-gray">{dateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? "border-barcelo-teal/30 bg-barcelo-teal/5" : "border-barcelo-gray/15 bg-white"}`}>
      <p className="text-xs text-barcelo-gray sm:text-sm">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-barcelo-deep sm:text-3xl">{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" }) {
  const styles = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}
