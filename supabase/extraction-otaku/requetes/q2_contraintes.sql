select co.contype as type_contrainte, count(*) as nb,
 string_agg(format(upper('alter') || ' table public.%I add constraint %I %s;', c.relname, co.conname, pg_get_constraintdef(co.oid)), E'\n' order by c.relname, co.conname) as ddl
from pg_constraint co
join pg_class c on c.oid = co.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
group by co.contype
order by position(co.contype::text in 'pucxtf');

