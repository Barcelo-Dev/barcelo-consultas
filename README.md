# Barceló Guatemala City — Portal de consultas

## Funciones
- Login del personal autorizado (Supabase Auth).
- Resumen general: totales, cupones redimidos, gráfica de registros por mes.
- Tabla con búsqueda, filtro y vista "Mes actual / Todo el historial".
- Exportar CSV ("Todo el historial" o "Solo registros nuevos").
- **Reporte por correo (Resend): resumen + Excel adjunto.**
  - Botón "Enviar reporte" en el panel (manual).
  - Envío automático programado (Vercel Cron): cada lunes, 9:00 a.m. GT.

## Variables de entorno (Vercel)
| Variable | Para qué | Tipo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (mismo proyecto) | Config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (login) | Config |
| `SUPABASE_SERVICE_ROLE_KEY` | Leer registros para el reporte | Secret |
| `RESEND_API_KEY` | Enviar el reporte | Secret |
| `EMAIL_FROM` | Remitente (dominio verificado en Resend) | Config |
| `REPORTE_TO` | Correo(s) que reciben el reporte (coma = varios) | Config |
| `CRON_SECRET` | Protege el envío automático | Secret |

## Envío automático (Vercel Cron)
- Configurado en `vercel.json`: `"schedule": "0 15 * * 1"` (15:00 UTC = 9:00 a.m. Guatemala, cada lunes).
- Para cambiar la frecuencia, edita ese valor (formato cron, en UTC).
- Vercel envía la petición del cron con `Authorization: Bearer <CRON_SECRET>`,
  por eso debes poner `CRON_SECRET` en las variables de Vercel.
- Nota: en el plan gratuito (Hobby) de Vercel los cron corren como máximo 1 vez al día;
  mensual está bien dentro de ese límite.

## Seguridad
- El reporte se lee con `service_role` solo en el servidor (API route), nunca en el navegador.
- El endpoint `/api/reporte` solo responde a: (a) un admin con sesión, o (b) el cron con el secreto.
