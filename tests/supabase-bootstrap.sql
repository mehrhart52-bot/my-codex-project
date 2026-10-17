-- Minimal Supabase Auth objects for validating schema.sql in plain PostgreSQL.
-- This file is for automated/local schema tests only; never run it in Supabase.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
