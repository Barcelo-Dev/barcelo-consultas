# Barceló Guatemala City — Portal de consultas

## Novedades
- Resumen general: totales, cupones redimidos, gráfica de registros por mes y mes con más registros.
- La tabla muestra el MES ACTUAL por defecto; botón "Todo el historial" para ver todo.
- Exportar CSV con dos opciones: "Todo el historial" o "Solo registros nuevos" (marca los exportados).
- El CSV muestra la fecha simple (DD/MM/AAAA), no el formato largo.

## IMPORTANTE
Ejecuta en Supabase (SQL Editor) el archivo `supabase/migracion-exportados.sql`
si ya tenías la base creada. Agrega la columna `exported_at` y la política de update.

## Variables de entorno (Vercel)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
