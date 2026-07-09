-- ============================================================
--  Esquema de base de datos — Barceló Guatemala City
--  Correos de huéspedes (formulario) + consulta (admin)
--  Ejecutar en Supabase: panel > SQL Editor > New query > pegar > Run
--  Ambas webs (formulario y consultas) usan ESTA MISMA base de datos.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  Tabla principal: suscriptores
-- ------------------------------------------------------------
create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  full_name       text,
  room_number     text,
  hotel           text default 'Barceló Guatemala City',
  source          text default 'web_form',      -- web_form, wifi, qr_recepcion, etc.

  consent         boolean not null default false,
  consent_at      timestamptz,

  confirmed       boolean not null default false,
  confirmed_at    timestamptz,
  confirm_token   text unique default encode(gen_random_bytes(24), 'hex'),

  coupon_code     text unique,
  coupon_redeemed boolean not null default false,
  coupon_redeemed_at timestamptz,

  created_at      timestamptz not null default now()
);

create index if not exists idx_subscribers_created_at on public.subscribers (created_at desc);
create index if not exists idx_subscribers_confirmed  on public.subscribers (confirmed);

-- ------------------------------------------------------------
--  Genera un código de cupón legible (ej: BARCELO-7F3A9C) al insertar
-- ------------------------------------------------------------
create or replace function public.set_coupon_code()
returns trigger as $$
begin
  if new.coupon_code is null then
    new.coupon_code := 'BARCELO-' || upper(encode(gen_random_bytes(3), 'hex'));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_coupon_code on public.subscribers;
create trigger trg_set_coupon_code
  before insert on public.subscribers
  for each row execute function public.set_coupon_code();

-- ------------------------------------------------------------
--  Seguridad a nivel de fila (RLS)
-- ------------------------------------------------------------
alter table public.subscribers enable row level security;

-- El formulario NO usa estas políticas: escribe desde su backend con la
-- service_role key, que ignora RLS. Por eso el público nunca puede leer
-- la lista desde el navegador.

-- El portal de CONSULTAS sí: cuando un admin inicia sesión, su rol pasa a
-- 'authenticated' y esta política le permite LEER todos los registros.
-- Como el registro público de usuarios está deshabilitado en Supabase,
-- los únicos 'authenticated' son los admins que tú creas a mano.
drop policy if exists "admins autenticados pueden leer" on public.subscribers;
create policy "admins autenticados pueden leer"
  on public.subscribers
  for select
  to authenticated
  using (true);

-- (Opcional) permitir que el admin marque un cupón como redimido desde el panel
drop policy if exists "admins autenticados pueden actualizar" on public.subscribers;
create policy "admins autenticados pueden actualizar"
  on public.subscribers
  for update
  to authenticated
  using (true)
  with check (true);
