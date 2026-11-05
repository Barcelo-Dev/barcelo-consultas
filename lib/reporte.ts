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
    mejorMes: mejor ? monthLabel(mejor[0]) : "—",
    mejorMesCount: mejor ? mejor[1] : 0,
    mesActual: monthLabel(thisYM),
    generado: ahoraGT(),
  };
}

// ---- Genera el archivo Excel (buffer) con todos los registros ----
export function construirExcel(rows: Registro[]): Buffer {
  const r = construirResumen(rows);
  const encabezado = [
    ["Barceló Guatemala City — Reporte de registros"],
    [`Generado: ${r.generado}`],
    [`Total: ${r.total}`, `Confirmados: ${r.confirmados}`, `Cupones redimidos: ${r.redimidos}`, `Registros ${r.mesActual}: ${r.esteMes}`],
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
function reporteEmailHtml(r: ReturnType<typeof construirResumen>) {
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
          <h1 style="margin:0 0 4px 0;font-family:Georgia,serif;font-size:24px;line-height:1.2;color:#14323d;">Resumen de la promoción</h1>
          <p style="margin:0;font-size:13px;color:#8e9091;">Generado el ${r.generado}</p>
        </td></tr>
        <tr><td style="padding:16px 24px 8px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>${tile("Total de registros", r.total)}${tile("Correos confirmados", r.confirmados)}</tr>
            <tr>${tile("Cupones redimidos", r.redimidos)}${tile(`Registros · ${r.mesActual}`, r.esteMes)}</tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;font-family:Helvetica,Arial,sans-serif;">
          <p style="margin:0;padding:12px 16px;background-color:#f6f4ef;border-radius:10px;font-size:14px;color:#14323d;"> El mes con más registros fue <strong>${r.mejorMes}</strong> con <strong>${r.mejorMesCount}</strong>.</p>
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
export async function enviarReporte(rows: Registro[], toOverride?: string[]) {
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

  const resumen = construirResumen(rows);
  const excel = construirExcel(rows);
  const fecha = new Date().toISOString().slice(0, 10);

  const resend = new Resend(apiKey);

  return resend.emails.send({
    from,
    to: destinatarios,
    subject: `📊 Reporte de registros — Barceló Guatemala City (${resumen.generado})`,
    html: reporteEmailHtml(resumen),
    attachments: [
      { filename: `barcelo-reporte-${fecha}.xlsx`, content: excel },
    ],
  });
}
