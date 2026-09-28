-- ============================================================================
-- Banc d'essai LOCAL : le classement (étape 4.7) — classement_joueur,
-- classement_chercher, classement_amis, et leur coût sur 5 000 joueurs.
-- Se joue APRÈS 70_collection.sql.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- 5 000 joueurs : XP total 0 → 8 000, la moitié a joué aujourd'hui
insert into public.players (pseudo, archetype, xp, xp_jour, jour, created_at)
select 'Banc' || g, 'soleil', (g * 1.6)::int,
       case when g % 2 = 0 then g % 900 else 0 end,
       case when g % 2 = 0 then public.jour_jeu() else public.jour_jeu() - 1 end,
       now() - make_interval(secs => g)
from generate_series(1, 5000) g;
-- Le joueur qu'on suit : 2 000 XP au total, 450 aujourd'hui ; un ex æquo ; un exclu
insert into public.players (id, pseudo, archetype, xp, xp_jour, jour) values
  ('00000000-0000-0000-0000-00000000c1a5', 'Classé_1', 'soleil', 2000, 450, public.jour_jeu()),
  ('00000000-0000-0000-0000-00000000c1a6', 'Jumeau', 'soleil', 2000, 450, public.jour_jeu());
insert into public.players (pseudo, archetype, xp, status) values ('Tricheur', 'soleil', 999999, 'exclu');
insert into public.player_secrets (player_id, secret_code) values ('00000000-0000-0000-0000-00000000c1a5', 'BANC-CLASSE');
analyze public.players;

set role anon;
do $$
declare c json; x json; v_attendu int;
begin
  -- Général : place = 1 + joueurs actifs strictement devant ; l'exclu ne compte pas
  c := public.classement_joueur('banc-classe', 'general');
  select 1 + count(*) into v_attendu from public.players where status = 'actif' and xp > 2000;
  assert (c->'moi'->>'place')::int = v_attendu, 'place générale : ' || (c->'moi')::text || ' attendu ' || v_attendu;
  assert json_array_length(c->'top') = 10, 'top 10';
  assert (c->'top'->0->>'pseudo') <> 'Tricheur', 'exclu dans le top';
  assert (c->'top'->0->>'place')::int = 1, 'premier : ' || (c->'top'->0)::text;
  assert json_array_length(c->'autour') = 5, 'voisins : ' || (c->>'autour');
  select a into x from json_array_elements(c->'autour') a where (a->>'moi')::boolean;
  assert x is not null and (x->>'place')::int = v_attendu, 'moi dans les voisins';
  -- L'ex æquo a la même place que moi
  select a into x from json_array_elements(c->'autour') a where a->>'pseudo' = 'Jumeau';
  assert x is not null and (x->>'place')::int = v_attendu, 'ex æquo : ' || coalesce(x::text, 'absent');
  assert (c->'moi'->'devant'->>'ecart')::int >= 1, 'écart : ' || (c->'moi')::text;
  assert (c->>'total')::int = (select count(*) from public.players where status = 'actif'), 'total';

  -- Aujourd'hui : seuls ceux qui ont joué depuis 6 h
  c := public.classement_joueur('BANC-CLASSE', 'jour');
  select 1 + count(*) into v_attendu from public.players
   where status = 'actif' and jour = public.jour_jeu() and xp_jour > 450;
  assert (c->'moi'->>'place')::int = v_attendu, 'place du jour : ' || (c->'moi')::text || ' attendu ' || v_attendu;
  assert (c->'moi'->>'score')::int = 450, 'score du jour';
  assert not exists (select 1 from json_array_elements(c->'top') t where (t->>'score')::int = 0), 'joueur à 0 dans le top du jour';

  -- Recherche : 3 lettres minimum, 10 résultats au plus, % pris au pied de la lettre
  begin perform public.classement_chercher('BANC-CLASSE', 'ba', 'general'); raise exception 'recherche courte acceptée';
  exception when others then assert sqlerrm = 'RECHERCHE_TROP_COURTE', sqlerrm; end;
  assert json_array_length(public.classement_chercher('BANC-CLASSE', 'banc', 'general')) = 10, 'recherche limitée à 10';
  assert json_array_length(public.classement_chercher('BANC-CLASSE', '%%%', 'general')) = 0, '% interprété';
  x := public.classement_chercher('BANC-CLASSE', 'jumeau', 'general')->0;
  assert x->>'pseudo' = 'Jumeau' and x->>'place' is not null, 'recherche : ' || coalesce(x::text, 'rien');
  assert json_array_length(public.classement_chercher('BANC-CLASSE', 'classé', 'general')) = 0, 'on ne se trouve pas soi-même';

  -- Amis : moi + les pseudos connus (casse ignorée), inconnus absents, 30 au plus
  c := public.classement_amis('BANC-CLASSE', array['jumeau', 'BANC10', 'Personne'], 'general');
  assert json_array_length(c) = 3, 'amis : ' || c::text;
  assert (select count(*) from json_array_elements(c) a where (a->>'moi')::boolean) = 1, 'moi parmi les amis';
  begin perform public.classement_amis('BANC-CLASSE', array(select 'x' || g from generate_series(1, 31) g), 'general');
    raise exception '31 amis acceptés';
  exception when others then assert sqlerrm = 'TROP_D_AMIS', sqlerrm; end;

  begin perform public.classement_joueur('PAS-UN-CODE', 'general'); raise exception 'code inconnu accepté';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
end $$;

-- Coût : moyenne de 200 appels (joueur hors du top, le cas le plus cher)
do $$
declare t0 timestamptz; i int; v json; ms_g numeric; ms_j numeric; ms_l numeric;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.classement_joueur('BANC-CLASSE', 'general'); end loop;
  ms_g := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.classement_joueur('BANC-CLASSE', 'jour'); end loop;
  ms_j := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.leaderboard_view('00000000-0000-0000-0000-00000000c1a5'); end loop;
  ms_l := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  raise notice 'COÛT sur % joueurs : classement_joueur général % ms, jour % ms ; leaderboard_view % ms',
    (select count(*) from public.players), round(ms_g, 2), round(ms_j, 2), round(ms_l, 2);
  t0 := clock_timestamp();
  for i in 1..50 loop v := public.classement_amis('BANC-CLASSE', array(select 'Banc' || g from generate_series(1, 30) g), 'general'); end loop;
  ms_g := extract(epoch from clock_timestamp() - t0) * 1000 / 50;
  t0 := clock_timestamp();
  for i in 1..50 loop v := public.classement_chercher('BANC-CLASSE', 'banc12', 'general'); end loop;
  ms_j := extract(epoch from clock_timestamp() - t0) * 1000 / 50;
  raise notice 'COÛT : classement_amis (30 amis) % ms, classement_chercher % ms', round(ms_g, 2), round(ms_j, 2);
end $$;
reset role;

select 'CLASSEMENT : OK';
