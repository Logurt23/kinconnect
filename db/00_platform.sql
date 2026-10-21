-- The few pieces of a Supabase-style database that KinConnect's schema relies on, for plain Postgres
-- (Cloud SQL locally the same). Run as the database's admin user. Safe to re-run.
--
-- PostgREST logs in as `authenticator` and switches to the role named in each request's JWT:
--   authenticated  a signed-in member (sub = their user id); every table's RLS applies
--   service_role   the app's admin calls; it owns the tables, so RLS doesn't apply to it
--   anon           no JWT; granted nothing

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end $$;

grant anon, authenticated, service_role to authenticator;
-- The schema is created as service_role (see 01), so the admin user must be able to SET ROLE to it.
grant service_role to current_user;

grant usage, create on schema public to service_role;
grant usage on schema public to anon, authenticated;
alter default privileges for role service_role in schema public grant all on tables to authenticated, service_role;
alter default privileges for role service_role in schema public grant all on sequences to authenticated, service_role;

-- auth.uid() is the `sub` of the request's JWT, as PostgREST exposes it.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
