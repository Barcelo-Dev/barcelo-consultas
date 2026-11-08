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
// Devuelve el path SVG de un segmento de dona entre dos ángulos (en grados).
function arcoDona(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const p = (r: number, a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];
  const [x0, y0] = p(rExt, a0);
  const [x1, y1] = p(rExt, a1);
  const [x2, y2] = p(rInt, a1);
  const [x3, y3] = p(rInt, a0);
  const largo = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${rExt} ${rExt} 0 ${largo} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInt} ${rInt} 0 ${largo} 0 ${x3} ${y3} Z`;
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
  // Año seleccionado para la gráfica (por defecto, el año en curso).
  const anioActual = Number(thisYM.slice(0, 4));
  const [anioSel, setAnioSel] = useState<number>(anioActual);

  const analytics = useMemo(() => {
    const total = rows.length;
    const confirmados = rows.filter(r => r.confirmed).length;
    const redimidos = rows.filter(r => r.coupon_redeemed).length;
    const thisMonth = rows.filter(r => ymGT(r.created_at) === thisYM).length;

    // Años disponibles (los que tienen registros), de mayor a menor.
    const aniosSet = new Set<number>();
    for (const r of rows) aniosSet.add(Number(ymGT(r.created_at).slice(0, 4)));
    aniosSet.add(anioActual); // el año en curso siempre aparece
    const anios = Array.from(aniosSet).sort((a, b) => b - a);

    return { total, confirmados, redimidos, thisMonth, anios };
  }, [rows, thisYM, anioActual]);

  // Datos de los 12 meses del AÑO SELECCIONADO (incluye meses en cero).
  const meses = useMemo(() => {
    const conteo = new Array(12).fill(0);
    for (const r of rows) {
      const ym = ymGT(r.created_at);
      if (Number(ym.slice(0, 4)) === anioSel) {
        const m = Number(ym.slice(5, 7)) - 1;
        conteo[m]++;
      }
    }
    const totalAnio = conteo.reduce((a, b) => a + b, 0);
    const nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    // Rampa de teal: enero (claro) -> diciembre (oscuro).
    const colores = ["#cfe9f0","#bed8e0","#adc8cf","#9cb7bf","#8ba6af","#7a969f","#69858e","#58757e","#47646e","#36535e","#25434d","#14323d"];
    const items = conteo.map((c, i) => ({
      mes: nombres[i], valor: c, color: colores[i],
      pct: totalAnio > 0 ? (c / totalAnio) * 100 : 0,
    }));
    const mejorIdx = conteo.reduce((best, c, i) => (c > conteo[best] ? i : best), 0);
    return { items, totalAnio, mejorMes: nombres[mejorIdx], mejorValor: conteo[mejorIdx] };
  }, [rows, anioSel]);

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

  // ---- Enviar reporte por correo (Resend) ----
  const [reporteOpen, setReporteOpen] = useState(false);
  const [reporteTo, setReporteTo] = useState("");
  const [reporteRango, setReporteRango] = useState<"todos" | "semana" | "mes">("todos");

  async function enviarReporte() {
    const correos = reporteTo.split(",").map(s => s.trim()).filter(Boolean);
    if (correos.length === 0) { setNotice("Escribe al menos un correo destino."); return; }

    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: reporteTo, rango: reporteRango }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "No se pudo enviar el reporte.");
      } else {
        setNotice(`Reporte enviado a ${correos.join(", ")} (${data.enviados} registros).`);
        setReporteOpen(false);
        setReporteTo("");
      }
    } catch {
      setNotice("Hubo un problema de conexión al enviar el reporte.");
    } finally {
      setBusy(false);
    }
  }

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

        {/* Registros por mes del año seleccionado: donut + tabla */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-barcelo-ink">Registros por mes</p>
            {/* Selector de año (permite consultar años anteriores) */}
            <select
              value={anioSel}
              onChange={e => setAnioSel(Number(e.target.value))}
              className="rounded-lg border border-barcelo-gray/30 bg-white px-3 py-1.5 text-sm font-medium outline-none focus:border-barcelo-teal"
            >
              {analytics.anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="mt-4 grid gap-6 sm:grid-cols-2 sm:items-center">
            {/* Donut */}
            <div className="flex items-center justify-center">
              {meses.totalAnio === 0 ? (
                <p className="py-10 text-sm text-barcelo-gray">Sin registros en {anioSel}.</p>
              ) : (
                <svg viewBox="0 0 200 200" className="w-full max-w-[220px]" role="img" aria-label={`Registros por mes de ${anioSel}`}>
                  {(() => {
                    let a = 0;
                    const arcos = meses.items
                      .filter(it => it.valor > 0)
                      .map((it, i) => {
                        const ang = (it.valor / meses.totalAnio) * 360;
                        // separador de 2px entre segmentos
                        const gap = ang > 4 ? 1 : 0;
                        const path = arcoDona(100, 100, 90, 58, a + gap, a + ang - gap);
                        a += ang;
                        return <path key={i} d={path} fill={it.color} />;
                      });
                    return arcos;
                  })()}
                  <text x="100" y="94" textAnchor="middle" className="fill-barcelo-ink" style={{ fontSize: 30, fontWeight: 700, fontFamily: "Georgia, serif" }}>{meses.totalAnio}</text>
                  <text x="100" y="114" textAnchor="middle" className="fill-barcelo-gray" style={{ fontSize: 11 }}>registros {anioSel}</text>
                </svg>
              )}
            </div>

            {/* Tabla de los 12 meses (incluye ceros) */}
            <div>
              <table className="w-full text-sm">
                <tbody>
                  {meses.items.map((it, i) => (
                    <tr key={i} className="border-b border-barcelo-gray/10 last:border-0">
                      <td className="py-1.5">
                        <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: it.color }} />
                        <span className={`align-middle ${it.valor === 0 ? "text-barcelo-gray" : "text-barcelo-ink"}`}>{it.mes}</span>
                      </td>
                      <td className="py-1.5 text-right font-semibold text-barcelo-ink">{it.valor}</td>
                      <td className="py-1.5 pl-3 text-right text-xs text-barcelo-gray">{it.pct > 0 ? `${it.pct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meses.totalAnio > 0 && (
            <p className="mt-4 rounded-lg bg-barcelo-cream px-3 py-2 text-sm text-barcelo-ink">
              📈 En {anioSel}, el mes con más registros fue{" "}
              <span className="font-semibold">{meses.mejorMes}</span>{" "}
              con <span className="font-semibold">{meses.mejorValor}</span>.
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

          <div className="flex items-center gap-2">
          {/* Enviar reporte por correo */}
          <div className="relative">
            <button onClick={() => { setReporteOpen(o => !o); setMenuOpen(false); }} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-barcelo-teal px-4 py-2 text-sm font-semibold text-barcelo-teal transition hover:bg-barcelo-teal/5 disabled:opacity-60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Enviar reporte
            </button>
            {reporteOpen && (
              <div className="absolute right-0 z-20 mt-1 w-80 rounded-lg border border-barcelo-gray/20 bg-white p-4 shadow-lg">
                <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">¿Qué registros exportar?</label>
                <select
                  value={reporteRango}
                  onChange={e => setReporteRango(e.target.value as "todos" | "semana" | "mes")}
                  className="mb-3 w-full rounded-lg border border-barcelo-gray/30 bg-white px-3 py-2 text-sm outline-none focus:border-barcelo-teal"
                >
                  <option value="todos">Todos los registros</option>
                  <option value="semana">Solo los de esta semana</option>
                  <option value="mes">Solo los de este mes</option>
                </select>
                <label className="mb-1.5 block text-sm font-medium text-barcelo-ink">Enviar a:</label>
                <input
                  type="text"
                  value={reporteTo}
                  onChange={e => setReporteTo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-lg border border-barcelo-gray/30 px-3 py-2 text-sm outline-none focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20"
                />
                <p className="mt-1.5 text-xs text-barcelo-gray">Separa varios correos con coma.</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => { setReporteOpen(false); setReporteTo(""); }}
                    className="rounded-lg border border-barcelo-gray/30 px-3 py-1.5 text-sm font-medium text-barcelo-ink hover:bg-barcelo-cream">
                    Cancelar
                  </button>
                  <button onClick={enviarReporte} disabled={busy}
                    className="rounded-lg bg-barcelo-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-barcelo-deep disabled:opacity-60">
                    {busy ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </div>
            )}
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
