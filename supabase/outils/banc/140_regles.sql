-- ============================================================================
-- Banc d'essai LOCAL : règles du jeu de la page Infos (étape 4.13) — regles_jeu.
-- Se joue APRÈS 130_programme.sql (réutilise les QR des scénarios précédents).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

insert into public.qr_codes (code, label, type, xp_reward, active) values
  ('DQ-RGL01', 'Règle 1', 'surprise', 7, true),
  ('DQ-RGL02', 'Règle 2', 'surprise', 93, true),
  ('DQ-RGL03', 'Règle éteinte', 'surprise', 999, false);

set role anon;
do $$
declare v json; t0 timestamptz; i int; b jsonb;
begin
  v := public.regles_jeu();
  b := (v->'bareme')::jsonb;
  assert jsonb_array_length(b) >= 3, 'barème : ' || v::text;
  -- Nombres seulement : ni code, ni libellé, ni indice
  assert v::text !~ 'DQ-' and v::text !~ 'Règle' and v::text !~ 'label|hint|code',
    'fuite dans le barème : ' || v::text;
  -- QR éteint ignoré
  assert b @> '[{"type": "surprise", "min": 7, "max": 93}]'::jsonb, 'surprise : ' || b::text;
  assert (v->'roue'->>'cout')::int = (select roulette_cost from public.game_state where id = 1)
     and (v->'roue'->>'max_jour')::int = (select roulette_max_jour from public.game_state where id = 1),
    'roue : ' || v::text;

  t0 := clock_timestamp();
  for i in 1..200 loop v := public.regles_jeu(); end loop;
  raise notice 'COÛT : regles_jeu % ms (% types de QR)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2), jsonb_array_length(b);
end $$;
reset role;

select 'REGLES : OK';
