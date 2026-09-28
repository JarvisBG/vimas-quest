-- ============================================================================
-- Banc d'essai LOCAL : imite le strict nécessaire d'un projet Supabase neuf
-- (rôles, schéma auth, auth.uid(), publication Realtime, droits par défaut)
-- pour pouvoir exécuter 00_schema.sql sur un PostgreSQL installé en local.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
-- Les rôles sont communs à tout le serveur : on ne les crée qu'une fois.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema extensions;
create schema auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Comme sur Supabase : l'identifiant de l'utilisateur vient du jeton.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create publication supabase_realtime;
