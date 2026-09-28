-- ============================================================================
-- Audit de la base DOMAF Quest : une ligne par objet, triée.
-- À exécuter tel quel dans l'éditeur SQL de Supabase (Export → CSV) et sur le
-- banc local, puis comparer les deux sorties (voir supabase/README.md).
-- Lecture seule.
-- ============================================================================
with
fn as (
  select p.oid, p.prosrc, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig,
         p.prosecdef, p.proconfig, p.provolatile
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
tb as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
lignes as (
  -- Tables : RLS + droits des rôles de l'API
  select 'table' as genre, relname as objet,
         'rls=' || relrowsecurity || ' force=' || relforcerowsecurity
         || ' anon=' || concat_ws('', case when has_table_privilege('anon', oid, 'SELECT') then 'S' end,
                                      case when has_table_privilege('anon', oid, 'INSERT') then 'I' end,
                                      case when has_table_privilege('anon', oid, 'UPDATE') then 'U' end,
                                      case when has_table_privilege('anon', oid, 'DELETE') then 'D' end)
         || ' auth=' || concat_ws('', case when has_table_privilege('authenticated', oid, 'SELECT') then 'S' end,
                                      case when has_table_privilege('authenticated', oid, 'INSERT') then 'I' end,
                                      case when has_table_privilege('authenticated', oid, 'UPDATE') then 'U' end,
                                      case when has_table_privilege('authenticated', oid, 'DELETE') then 'D' end)
         || ' politiques=' || (select count(*) from pg_policy po where po.polrelid = tb.oid) as detail
  from tb
  union all
  -- Politiques RLS
  select 'politique', tablename || ' / ' || policyname,
         cmd || ' ' || array_to_string(roles, ',') || ' ' || permissive
         || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public'
  union all
  -- Fonctions : definer, search_path, exécution par anon / authenticated
  select 'fonction', sig,
         case when prosecdef then 'DEFINER' else 'invoker' end
         || ' ' || coalesce(array_to_string(proconfig, ','), 'search_path=NON_FIXE')
         || ' anon=' || case when has_function_privilege('anon', oid, 'EXECUTE') then 'X' else '-' end
         || ' auth=' || case when has_function_privilege('authenticated', oid, 'EXECUTE') then 'X' else '-' end
         -- empreinte du code (fins de ligne neutralisées) : détecte un corps pas à jour
         || ' corps=' || left(md5(replace(prosrc, chr(13), '')), 10)
  from fn
  union all
  -- Déclencheurs
  select 'declencheur', c.relname || ' / ' || t.tgname, pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  -- Temps réel
  select 'realtime', tablename, pubname
  from pg_publication_tables where pubname = 'supabase_realtime'
  union all
  -- Vues (il ne doit pas y en avoir)
  select 'vue', c.relname, c.relkind::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')
  union all
  -- Séquences
  select 'sequence', c.relname,
         'anon=' || case when has_sequence_privilege('anon', c.oid, 'USAGE') then 'U' else '-' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'
)
-- « limit » explicite : sinon l'éditeur de Supabase coupe à 100 lignes.
select genre, objet, detail from lignes order by genre, objet limit 5000;
