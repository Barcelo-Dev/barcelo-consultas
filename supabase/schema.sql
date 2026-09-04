-- ============================================================
--  Esquema de base de datos — Barceló Guatemala City
--  Ejecutar en Supabase > SQL Editor (una sola vez).
-- ============================================================
create extension if not exists "pgcrypto";

create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  full_name       text,
  room_number     text,
  hotel           text default 'Barceló Guatemala City',
  source          text default 'web_form',
  consent         boolean not null default false,
  consent_at      timestamptz,
  confirmed       boolean not null default false,
  confirmed_at    timestamptz,
  confirm_token   text unique default encode(gen_random_bytes(24), 'hex'),
  coupon_code     text unique,
  coupon_redeemed boolean not null default false,
  coupon_redeemed_at timestamptz,
  exported_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_subscribers_created_at on public.subscribers (created_at desc);
create index if not exists idx_subscribers_email on public.subscribers (email);
create index if not exists idx_subscribers_confirmed on public.subscribers (confirmed);

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
create trigger trg_set_coupon_code before insert on public.subscribers
  for each row execute function public.set_coupon_code();

alter table public.subscribers enable row level security;

drop policy if exists "admins autenticados pueden leer" on public.subscribers;
create policy "admins autenticados pueden leer" on public.subscribers
  for select to authenticated using (true);

drop policy if exists "admins autenticados pueden actualizar" on public.subscribers;
create policy "admins autenticados pueden actualizar" on public.subscribers
  for update to authenticated using (true) with check (true);
