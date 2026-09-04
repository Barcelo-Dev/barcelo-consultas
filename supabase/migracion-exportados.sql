-- ============================================================
--  Migración: marca de "exportado" para la opción "solo registros nuevos"
--  Ejecutar UNA vez en Supabase > SQL Editor si ya tenías la base creada.
-- ============================================================

-- Columna que guarda cuándo se exportó cada registro (null = nuevo/sin exportar)
alter table public.subscribers add column if not exists exported_at timestamptz;

-- Asegura que el admin autenticado pueda ACTUALIZAR (para marcar exportados)
drop policy if exists "admins autenticados pueden actualizar" on public.subscribers;
create policy "admins autenticados pueden actualizar" on public.subscribers
  for update to authenticated using (true) with check (true);
