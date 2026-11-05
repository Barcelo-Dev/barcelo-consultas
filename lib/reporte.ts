import { Resend } from "resend";
import * as XLSX from "xlsx";

// ---- Tipo de registro que usa el reporte ----
export type Registro = {
  email: string;
  full_name: string | null;
  room_number: string | null;
  confirmed: boolean;
  coupon_code: string | null;
  coupon_redeemed: boolean;
  created_at: string;
};

const GT = "America/Guatemala";

// Año-mes (YYYY-MM) de una fecha, en hora de Guatemala.
function ymGT(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: GT, year: "numeric", month: "2-digit" }).formatToParts(new Date(iso));
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}
function currentYM() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: GT, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}
// Solo fecha (DD/MM/AAAA) para el Excel.
function dateOnly(iso: string) {
  return new Intl.DateTimeFormat("es-GT", { timeZone: GT, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
// Fecha y hora legible para el encabezado del reporte.
function ahoraGT() {
  return new Intl.DateTimeFormat("es-GT", { timeZone: GT, day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
// Etiqueta de mes legible: "noviembre 2026".
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

// Fecha corta "05 nov" para las etiquetas de rango.
function fechaCorta(dt: Date) {
  return new Intl.DateTimeFormat("es-GT", { timeZone: GT, day: "2-digit", month: "short" }).format(dt);
}

// ---- Rango de fechas del reporte ----
// Guatemala es UTC-6 todo el año, así que las 00:00 GT de una fecha
// equivalen a las 06:00 UTC de ese mismo día.
export type Rango = "todos" | "semana" | "mes" | "semana_anterior";

function inicioDiaGT(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
}
function hoyGT() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: GT, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => Number(p.find(x => x.type === t)!.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

// Devuelve [desde, hasta) del rango y una etiqueta legible del período.
function rangoInfo(rango: Rango): { desde?: Date; hasta?: Date; etiqueta: string } {
  const { y, m, d } = hoyGT();
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=domingo..6=sábado
  const desdeLunes = (dow + 6) % 7;                            // días desde el lunes
  const inicioSemana = inicioDiaGT(y, m, d - desdeLunes);      // lunes 00:00 GT de esta semana
  const inicioMes = inicioDiaGT(y, m, 1);

  if (rango === "semana") {
    return { desde: inicioSemana, etiqueta: `Esta semana (desde ${fechaCorta(inicioSemana)})` };
  }
  if (rango === "mes") {
    return { desde: inicioMes, etiqueta: "Este mes" };
  }
  if (rango === "semana_anterior") {
    const inicioPrev = new Date(inicioSemana.getTime() - 7 * 864e5);
    const finPrev = inicioSemana; // exclusivo (lunes de esta semana)
    const domingoPrev = new Date(finPrev.getTime() - 864e5);
    return { desde: inicioPrev, hasta: finPrev, etiqueta: `Semana anterior (${fechaCorta(inicioPrev)} al ${fechaCorta(domingoPrev)})` };
  }
  return { etiqueta: "Todo el historial" };
}

// Filtra los registros según el rango.
export function filtrarPorRango(rows: Registro[], rango: Rango): Registro[] {
  const { desde, hasta } = rangoInfo(rango);
  return rows.filter(r => {
    const t = new Date(r.created_at).getTime();
    if (desde && t < desde.getTime()) return false;
    if (hasta && t >= hasta.getTime()) return false;
    return true;
  });
}

// ---- Resumen de métricas (sobre todo el historial) ----
export function construirResumen(rows: Registro[]) {
  const thisYM = currentYM();
  const total = rows.length;
  const confirmados = rows.filter(r => r.confirmed).length;
  const redimidos = rows.filter(r => r.coupon_redeemed).length;
  const esteMes = rows.filter(r => ymGT(r.created_at) === thisYM).length;

  const porMes = new Map<string, number>();
  for (const r of rows) {
    const k = ymGT(r.created_at);
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }
  const mejor = Array.from(porMes.entries()).reduce<[string, number] | null>(
    (acc, cur) => (!acc || cur[1] > acc[1] ? cur : acc), null
  );

  return {
    total, confirmados, redimidos, esteMes,
    sinConfirmar: total - confirmados,
    mejorMes: mejor ? monthLabel(mejor[0]) : "—",
    mejorMesCount: mejor ? mejor[1] : 0,
    mesActual: monthLabel(thisYM),
    generado: ahoraGT(),
  };
}

// ---- Genera el archivo Excel (buffer) con todos los registros ----
export function construirExcel(rows: Registro[], etiqueta = "Todo el historial"): Buffer {
  const r = construirResumen(rows);
  const encabezado = [
    ["Barceló Guatemala City — Reporte de registros"],
    [`Período: ${etiqueta}`],
    [`Generado: ${r.generado}`],
    [`Total: ${r.total}`, `Confirmados: ${r.confirmados}`, `Sin confirmar: ${r.sinConfirmar}`, `Cupones redimidos: ${r.redimidos}`],
    [],
    ["Correo", "Nombre", "Habitación", "Confirmado", "Cupón", "Cupón redimido", "Fecha de registro"],
  ];
  const cuerpo = rows.map(x => [
    x.email,
    x.full_name || "—",
    x.room_number || "—",
    x.confirmed ? "Sí" : "No",
    x.coupon_code || "—",
    x.coupon_redeemed ? "Sí" : "No",
    dateOnly(x.created_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...cuerpo]);
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---- HTML del correo del reporte (resumen con estética de marca) ----
function reporteEmailHtml(r: ReturnType<typeof construirResumen>, etiqueta: string) {
  const tile = (label: string, value: number | string) => `
    <td style="padding:8px;" width="50%">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e0d8;border-radius:12px;background-color:#ffffff;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8e9091;">${label}</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#2f5c78;">${value}</p>
        </td></tr>
      </table>
    </td>`;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="color-scheme" content="light" /><title>Reporte de registros</title></head>
<body style="margin:0;padding:0;background-color:#f6f4ef;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f4ef;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(20,50,61,0.08);">
        <tr><td style="background-color:#2f5c78;background:linear-gradient(120deg,#2f5c78 0%,#1f7d9c 60%,#309dba 100%);padding:32px 40px;text-align:center;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;"><strong>Barceló</strong> <span style="opacity:0.9;">Guatemala City</span></span>
        </td></tr>
        <tr><td style="padding:32px 32px 8px 32px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c99a3f;font-weight:bold;">Reporte de registros</p>
          <h1 style="margin:0 0 4px 0;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#14323d;">${etiqueta}</h1>
          <p style="margin:0;font-size:13px;color:#8e9091;">Generado el ${r.generado}</p>
        </td></tr>
        <tr><td style="padding:16px 24px 8px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>${tile("Total de registros", r.total)}${tile("Correos confirmados", r.confirmados)}</tr>
            <tr>${tile("Sin confirmar", r.sinConfirmar)}${tile("Cupones redimidos", r.redimidos)}</tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0;padding:12px 16px;background-color:#f6f4ef;border-radius:10px;font-size:14px;color:#14323d;">Este reporte incluye los registros de: <strong>${etiqueta}</strong>.</p>
          <p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#33474f;">Se adjunta el detalle completo de los registros en el archivo Excel.</p>
        </td></tr>
        <tr><td style="background-color:#f6f4ef;padding:20px 32px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8e9091;text-align:center;">Barceló Guatemala City · Reporte interno automático</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ---- Envía el reporte por Resend con el Excel adjunto ----
// toOverride: correos escritos en el botón (envío manual). Si no se pasa,
// usa REPORTE_TO (envío automático programado).
// rango: qué registros incluir (todos / semana / mes / semana_anterior).
export async function enviarReporte(rows: Registro[], toOverride?: string[], rango: Rango = "todos") {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.REPORTE_TO;
  if (!apiKey || !from) {
    throw new Error("Faltan RESEND_API_KEY o EMAIL_FROM.");
  }

  // Destinatarios: los escritos a mano, o el correo fijo por defecto.
  const destinatarios = (toOverride && toOverride.length > 0)
    ? toOverride
    : (to ?? "").split(",").map(s => s.trim()).filter(Boolean);

  if (destinatarios.length === 0) {
    throw new Error("No hay destinatarios para el reporte.");
  }

  // Filtramos los registros al rango pedido y obtenemos su etiqueta.
  const { etiqueta } = rangoInfo(rango);
  const filtrados = filtrarPorRango(rows, rango);

  const resumen = construirResumen(filtrados);
  const excel = construirExcel(filtrados, etiqueta);
  const fecha = new Date().toISOString().slice(0, 10);

  const resend = new Resend(apiKey);

  return resend.emails.send({
    from,
    to: destinatarios,
    subject: `Reporte de registros — Barceló Guatemala City (${etiqueta})`,
    html: reporteEmailHtml(resumen, etiqueta),
    attachments: [
      { filename: `barcelo-reporte-${fecha}.xlsx`, content: excel },
    ],
  });
}
