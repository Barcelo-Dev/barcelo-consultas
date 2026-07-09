-- ============================================================
--  Migración: agregar número de habitación
--  Ejecuta esto en Supabase (SQL Editor) SOLO si ya habías corrido
--  el schema.sql antes. Para instalaciones nuevas no hace falta:
--  el schema.sql ya incluye la columna.
-- ============================================================
alter table public.subscribers
  add column if not exists room_number text;
