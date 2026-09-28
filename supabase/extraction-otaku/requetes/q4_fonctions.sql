with f as (
  select row_number() over (order by p.proname, pg_get_function_identity_arguments(p.oid)) as rn,
         p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select (rn - 1) / 10 as lot, count(*) as nb, string_agg(proname::text, ', ' order by rn) as noms,
       string_agg(def || ';', E'\n\n' order by rn) as ddl
from f group by 1 order by 1;
