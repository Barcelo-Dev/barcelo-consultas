"use client";

import { useMemo, useState } from "react";

export type Subscriber = {
  id: string;
  email: string;
  full_name: string | null;
  room_number: string | null;
  hotel: string | null;
  source: string | null;
  consent: boolean;
  confirmed: boolean;
  coupon_code: string | null;
  coupon_redeemed: boolean;
  created_at: string;
};

type Filter = "todos" | "confirmados" | "pendientes";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Escapa un valor para CSV (comillas, comas, saltos de línea).
function csvCell(value: string | boolean | null) {
  const s = value === null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function SubscribersTable({ rows }: { rows: Subscriber[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "confirmados" && !r.confirmed) return false;
      if (filter === "pendientes" && r.confirmed) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        r.email.toLowerCase().includes(q) ||
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.coupon_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      confirmados: rows.filter((r) => r.confirmed).length,
      redimidos: rows.filter((r) => r.coupon_redeemed).length,
    }),
    [rows]
  );

  function exportCSV() {
    const headers = [
      "Correo",
      "Nombre",
      "Habitación",
      "Hotel",
      "Origen",
      "Consentimiento",
      "Confirmado",
      "Cupón",
      "Cupón redimido",
      "Fecha de registro",
    ];
    const lines = filtered.map((r) =>
      [
        r.email,
        r.full_name,
        r.room_number,
        r.hotel,
        r.source,
        r.consent ? "Sí" : "No",
        r.confirmed ? "Sí" : "No",
        r.coupon_code,
        r.coupon_redeemed ? "Sí" : "No",
        r.created_at,
      ]
        .map(csvCell)
        .join(",")
    );
    // BOM para que Excel abra bien los acentos.
    const csv = "\uFEFF" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `barcelo-correos-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de registros" value={stats.total} />
        <StatCard label="Correos confirmados" value={stats.confirmados} />
        <StatCard label="Cupones redimidos" value={stats.redimidos} />
      </div>

      {/* Barra de herramientas */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por correo, nombre o cupón…"
            className="w-full rounded-lg border border-barcelo-gray/30 px-4 py-2 text-sm outline-none focus:border-barcelo-teal focus:ring-2 focus:ring-barcelo-teal/20 sm:max-w-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-lg border border-barcelo-gray/30 bg-white px-3 py-2 text-sm outline-none focus:border-barcelo-teal"
          >
            <option value="todos">Todos</option>
            <option value="confirmados">Confirmados</option>
            <option value="pendientes">Pendientes</option>
          </select>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-barcelo-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-barcelo-deep"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Exportar CSV ({filtered.length})
        </button>
      </div>

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
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-barcelo-gray"
                >
                  No hay registros que coincidan.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-barcelo-gray/10 last:border-0 hover:bg-barcelo-cream/50"
                >
                  <td className="px-4 py-3 font-medium text-barcelo-ink">
                    {r.email}
                  </td>
                  <td className="px-4 py-3 text-barcelo-ink/80">
                    {r.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-barcelo-ink/80">
                    {r.room_number || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-barcelo-deep">
                      {r.coupon_code || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.confirmed ? (
                      <Badge tone="green">Confirmado</Badge>
                    ) : (
                      <Badge tone="amber">Pendiente</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-barcelo-gray">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-barcelo-gray/15 bg-white px-5 py-4">
      <p className="text-sm text-barcelo-gray">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-barcelo-deep">
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber";
}) {
  const styles =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}
