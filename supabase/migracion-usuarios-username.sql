-- ============================================================
--  Migración: nombre de usuario para login (además del correo)
--  Ejecutar UNA vez en Supabase > SQL Editor.
--  La tabla "profiles" ya existe (creada por la migración de canje).
-- ============================================================

-- Columna de nombre de usuario. Puede quedar vacía: en ese caso el
-- usuario entra solo con su correo. Si se le asigna un nombre de usuario,
-- podrá entrar con cualquiera de los dos (usuario o correo).
alter table public.profiles add column if not exists username text;

-- Nombre de usuario único, sin distinguir mayúsculas/minúsculas.
-- (Permite varios registros sin usuario, porque los nulos no chocan.)
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));
