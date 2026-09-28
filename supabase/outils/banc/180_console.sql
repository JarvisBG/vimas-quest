-- ============================================================================
-- Banc d'essai LOCAL : le tableau de bord de la console (étape 6.1) —
-- console_accueil, ses droits, son coût ; admin_set_phase('CLOTURE') sur
-- l'index du classement du jour.
-- Se joue APRÈS 170_ecran_blind.sql (5 000 joueurs, 200 000 événements).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Un compte connecté qui n'est pas de l'équipe
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a0ff', 'curieux@test.local')
  on conflict do nothing;

-- --- Droits : ni anonyme, ni compte quelconque, ni vendeur -----------------
set role anon;
do $$ begin
  perform public.console_accueil();
  raise exception 'anonyme accepté';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0ff', false);
do $$ begin
  perform public.console_accueil();
  raise exception 'compte hors équipe accepté';
exception when raise_exception then
  assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);   -- le vendeur
do $$ begin
  perform public.console_accueil();
  raise exception 'vendeur accepté';
exception when raise_exception then
  assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;

-- --- Le GM : contenu -------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
create temp table t_avant as select public.console_accueil() as v;
reset role;
grant select on t_avant to authenticated;

-- Points offerts : deux aujourd'hui par Awa, un par le GM, un avant-hier (ignoré)
insert into public.events (type, player_id, payload, created_at) values
  ('bonus', '00000000-0000-0000-0000-0000000e0001', '{"message": "Awa récompense MurRoi : +300 XP", "xp": 300, "par": "Awa", "reason": "Danse"}', now() - interval '3 s'),
  ('bonus', '00000000-0000-0000-0000-0000000e0001', '{"message": "Awa récompense MurRoi : +300 XP", "xp": 300, "par": "Awa"}', now() - interval '2 s'),
  ('bonus', '00000000-0000-0000-0000-0000000e0001', '{"message": "Le Game Master accorde +100 XP à MurRoi", "xp": 100}', now() - interval '1 s'),
  ('bonus', '00000000-0000-0000-0000-0000000e0001', '{"message": "vieux", "xp": 5000, "par": "Awa"}', now() - interval '2 days');
-- Le fil : une exclusion, puis du bruit qui ne doit pas y apparaître
insert into public.events (type, player_id, payload, created_at) values
  ('kill_switch', '00000000-0000-0000-0000-0000000e0003', '{"message": "MurExclu a été exclu"}', now());
insert into public.events (type, player_id, payload, created_at) values
  ('scan', '00000000-0000-0000-0000-0000000e0001', '{"qr_type": "stand", "label": "Stand bruit"}', now() + interval '1 s'),
  ('level_up', '00000000-0000-0000-0000-0000000e0001', '{"level": 9, "message": "bruit"}', now() + interval '2 s');
analyze public.events;

set role authenticated;
do $$
declare v json; a json := (select t.v from t_avant t); f json;
begin
  v := public.console_accueil();
  -- Identité
  assert (v->'acces'->>'gm')::boolean and v->'acces'->>'nom' = 'GM', 'accès : ' || (v->>'acces');
  assert v->>'jour' = public.jour_jeu()::text and v->>'phase' is not null, 'jour / phase';

  -- Chiffres : mêmes que le mur pour ce qu'ils partagent
  assert (v->'chiffres'->>'joueurs')::int = (public.mur_direct()->>'joueurs')::int, 'joueurs';
  assert (v->'chiffres'->>'joueurs_jour')::int = (public.mur_direct()->>'joueurs_jour')::int, 'joueurs du jour';
  assert (v->'chiffres'->>'scans_jour')::int = (public.mur_direct()->>'scans_jour')::int, 'scans du jour';
  assert (v->'chiffres'->>'exclus')::int >= 1, 'exclus';
  assert (v->'chiffres'->>'xp_jour')::int >= 5000, 'XP du jour';

  -- Top 5 du jour : trié, sans exclu
  assert json_array_length(v->'top') = 5, 'top 5';
  assert (v->'top'->0->>'points')::int >= (v->'top'->4->>'points')::int, 'tri du top';
  assert v->'top'->0->>'pseudo' = public.mur_direct()->'top'->0->>'pseudo', 'même premier que le mur';
  assert not exists (select 1 from json_array_elements(v->'top') t where t->>'pseudo' = 'MurExclu'), 'exclu dans le top';

  -- Fil : l'exclusion en tête, jamais les scans de stands ni les niveaux
  f := v->'fil';
  assert json_array_length(f) = 15, 'fil : ' || json_array_length(f);
  assert f->0->>'type' = 'kill_switch' and f->0->>'pseudo' = 'MurExclu', 'fil 0 : ' || (f->0)::text;
  assert not exists (select 1 from json_array_elements(f) e
                     where e->>'type' = 'level_up' or (e->>'type' = 'scan' and e->>'message' is distinct from null
                       and e->>'message' like '%Stand bruit%')), 'bruit dans le fil';

  -- Points offerts : + 700 XP en 3 gestes (celui d'avant-hier ignoré)
  assert (v->'bonus'->>'total')::int - (a->'bonus'->>'total')::int = 700,
    'bonus : ' || (v->'bonus'->>'total') || ' / avant ' || (a->'bonus'->>'total');
  assert (v->'bonus'->>'gestes')::int - (a->'bonus'->>'gestes')::int = 3, 'gestes';
  assert exists (select 1 from json_array_elements(v->'bonus'->'par') p where p->>'par' = 'Awa' and (p->>'xp')::int >= 600), 'par Awa';
  assert v->'bonus'->'derniers'->0->>'par' = 'Game Master' and (v->'bonus'->'derniers'->0->>'xp')::int = 100,
    'dernier geste : ' || (v->'bonus'->'derniers'->0)::text;
  assert json_array_length(v->'bonus'->'derniers') <= 12, '12 derniers';

  -- Contenu et annonces : présents et cohérents
  assert (v->'contenu'->>'qr_actifs')::int <= (v->'contenu'->>'qr')::int, 'QR';
  assert (v->'contenu'->>'lieux_places')::int <= (v->'contenu'->>'lieux')::int, 'lieux';
  assert (v->'annonces'->>'en_cours')::int >= json_array_length(v->'annonces'->'dernieres'), 'annonces';
  assert json_array_length(v->'annonces'->'dernieres') <= 3, '3 annonces';
end $$;

-- --- Clôture : le roi du jour pris sur l'index, même résultat qu'avant -------
do $$
declare v_attendu text; v_points int; t0 timestamptz;
begin
  select pseudo, xp_jour into v_attendu, v_points from public.players
   where status = 'actif' and jour = public.jour_jeu() and xp_jour > 0
   order by xp_jour desc, created_at limit 1;
  t0 := clock_timestamp();
  perform public.admin_set_phase('CLOTURE');
  raise notice 'COÛT : admin_set_phase(CLOTURE) % ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 2);
  assert (select pseudo from public.tournament_kings where jour = public.jour_jeu()) = v_attendu
     and (select points from public.tournament_kings where jour = public.jour_jeu()) = v_points,
    'roi du jour : ' || coalesce((select pseudo from public.tournament_kings where jour = public.jour_jeu()), 'aucun');
  assert public.console_accueil()->>'phase' = 'CLOTURE', 'phase';
  perform public.admin_set_phase('EXPLORATION');
end $$;

-- --- Coût : moyenne de 200 appels ------------------------------------------
do $$
declare t0 timestamptz; i int; v json; v_ms numeric;
        -- Comptés avant la mesure (un raise évalue ses arguments dans l'ordre).
        v_n_joueurs bigint := (select count(*) from public.players);
        v_n_events bigint := (select count(*) from public.events);
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.console_accueil(); end loop;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2);
  raise notice 'COÛT sur % joueurs, % événements : console_accueil % ms (% octets)',
    v_n_joueurs, v_n_events, v_ms, length(v::text);
end $$;
reset role;

delete from public.tournament_kings where jour = public.jour_jeu();
select 'CONSOLE : OK';
