-- ============================================================================
-- Banc d'essai LOCAL : le mur de l'écran géant (étape 5.1) — mur_direct,
-- et son coût face à live_board sur 5 000 joueurs et 200 000 événements.
-- Se joue APRÈS 150_blind_joueur.sql (les 5 000 joueurs de 80_classement.sql).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Le roi du jour, un exclu très bien placé, et de quoi remplir le journal
insert into public.players (id, pseudo, archetype, xp, xp_jour, jour, created_at) values
  ('00000000-0000-0000-0000-0000000e0001', 'MurRoi', 'soleil', 3000, 5000, public.jour_jeu(), now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000e0002', 'MurHier', 'soleil', 3000, 9000, public.jour_jeu() - 1, now());
insert into public.players (id, pseudo, archetype, xp, xp_jour, jour, status) values
  ('00000000-0000-0000-0000-0000000e0003', 'MurExclu', 'soleil', 9000, 9999, public.jour_jeu(), 'exclu');
insert into public.badges (name, rarete, secret) values ('Banc secret', 'epique', true), ('Banc visible', 'rare', false)
  on conflict (name) do nothing;

-- 200 000 scans de stands dans le journal (le bruit que le mur ne relit jamais)
insert into public.events (type, player_id, payload, created_at)
select 'scan', p.id, jsonb_build_object('qr_type', 'stand', 'label', 'Stand ' || g), now() - make_interval(secs => g)
from generate_series(1, 200000) g
join lateral (select id from public.players where pseudo = 'Banc' || (g % 5000 + 1)) p on true;
-- 50 000 scans en table, dont 30 000 aujourd'hui
insert into public.qr_codes (code, label, type, xp_reward)
select 'DQ-MUR' || g, 'QR mur ' || g, 'stand', 10 from generate_series(1, 10) g;
insert into public.scans (player_id, qr_code_id, day)
select p.id, q.id, case when p.n <= 3000 then public.jour_jeu() else public.jour_jeu() - 1 end
from (select id, row_number() over (order by created_at) as n from public.players where pseudo like 'Banc%') p
cross join (select id from public.qr_codes where code like 'DQ-MUR%') q;

-- Les exploits, du plus ancien au plus récent (1 s d'écart)
insert into public.events (type, player_id, payload, created_at) values
  ('level_up', '00000000-0000-0000-0000-0000000e0001', '{"level": 4, "old_level": 3}', now() - interval '9 s'),   -- Fan → Fan : caché
  ('level_up', '00000000-0000-0000-0000-0000000e0001', '{"level": 3, "old_level": 2}', now() - interval '8 s'),   -- → Fan
  ('level_up', '00000000-0000-0000-0000-0000000e0001', '{"level": 6}', now() - interval '7 s'),                  -- roue : → Groupie
  ('scan', '00000000-0000-0000-0000-0000000e0001', '{"qr_type": "relique", "label": "Le micro d''or", "rarity": "legendaire"}', now() - interval '6 s'),
  ('scan', '00000000-0000-0000-0000-0000000e0001', '{"qr_type": "scene", "label": "Scène Soleil"}', now() - interval '5 s'),   -- caché
  ('badge', '00000000-0000-0000-0000-0000000e0001', '{"badge": "Banc secret"}', now() - interval '4 s'),
  ('badge', '00000000-0000-0000-0000-0000000e0001', '{"badge": "Banc visible"}', now() - interval '3 s'),
  ('quete', '00000000-0000-0000-0000-0000000e0001', '{"quest": "Trois scènes", "xp": 120}', now() - interval '2 s'),
  ('roulette', '00000000-0000-0000-0000-0000000e0001', '{"prize": "Tote bag", "kind": "objet"}', now() - interval '1 s'),
  ('badge', '00000000-0000-0000-0000-0000000e0003', '{"badge": "Banc visible"}', now()),                          -- exclu : caché
  ('kill_switch', '00000000-0000-0000-0000-0000000e0003', '{"message": "MurExclu a été exclu"}', now());        -- jamais
insert into public.tournament_kings (jour, pseudo, points)
  values (public.jour_jeu() - 1, 'MurHier', 9000) on conflict (jour) do update set pseudo = excluded.pseudo, points = excluded.points;

delete from public.announcements;
insert into public.announcements (titre, message, type, categorie, fin, created_at) values
  ('Orage', 'Abris ouverts.', 'danger', 'meteo', now() + interval '1 hour', now() - interval '1 minute'),
  ('Fermée', 'Plus valable.', 'info', 'pratique', now() - interval '1 minute', now() - interval '2 hours'),
  ('Vieille', 'Il y a 3 jours.', 'info', 'pratique', null, now() - interval '3 days');
analyze public.players; analyze public.events; analyze public.scans; analyze public.announcements;
-- Les bancs précédents ont aussi scanné aujourd'hui
select set_config('banc.scans_jour', (select count(*) from public.scans where day = public.jour_jeu())::text, false);

set role anon;
do $$
declare m json; ex json;
begin
  m := public.mur_direct();
  -- Tournoi du jour : le roi en tête, l'exclu et le joueur d'hier absents
  assert m->'top'->0->>'pseudo' = 'MurRoi' and (m->'top'->0->>'points')::int = 5000
     and (m->'top'->0->>'place')::int = 1, 'roi : ' || (m->'top'->0)::text;
  assert json_array_length(m->'top') = 10, 'top 10';
  assert not exists (select 1 from json_array_elements(m->'top') t where t->>'pseudo' in ('MurExclu', 'MurHier')), 'exclu ou hier dans le top';
  assert m->'roi_veille'->>'pseudo' = 'MurHier', 'roi de la veille : ' || (m->>'roi_veille');
  assert (m->>'scans_jour')::int = current_setting('banc.scans_jour')::int
     and current_setting('banc.scans_jour')::int >= 30000, 'scans du jour : ' || (m->>'scans_jour');
  assert (m->>'joueurs')::int >= 5000, 'joueurs';
  assert m->>'phase' is not null, 'phase';

  -- Exploits : les 7 affichables en tête, du plus récent au plus ancien (8 au plus)
  ex := m->'exploits';
  assert json_array_length(ex) = 8, 'exploits : ' || ex::text;
  assert ex->0->>'type' = 'roue'    and ex->0->>'nom' = 'Tote bag' and ex->0->>'detail' = 'objet', 'roue : ' || (ex->0)::text;
  assert ex->1->>'type' = 'mission' and ex->1->>'nom' = 'Trois scènes' and ex->1->>'detail' = '120', 'mission : ' || (ex->1)::text;
  assert ex->2->>'type' = 'badge'   and ex->2->>'nom' = 'Banc visible' and ex->2->>'detail' = 'rare', 'badge : ' || (ex->2)::text;
  assert ex->3->>'type' = 'badge'   and ex->3->>'nom' is null and ex->3->>'detail' = 'epique', 'badge secret : ' || (ex->3)::text;
  assert ex->4->>'type' = 'relique' and ex->4->>'nom' = 'Le micro d''or' and ex->4->>'detail' = 'legendaire', 'relique : ' || (ex->4)::text;
  assert ex->5->>'type' = 'rang'    and ex->5->>'nom' = 'Groupie', 'rang (roue) : ' || (ex->5)::text;
  assert ex->6->>'type' = 'rang'    and ex->6->>'nom' = 'Fan', 'rang : ' || (ex->6)::text;
  assert ex->0->>'pseudo' = 'MurRoi', 'pseudo';

  -- Annonces : seulement l'orage (la fermée et la vieille sont écartées)
  assert json_array_length(m->'annonces') = 1 and m->'annonces'->0->>'titre' = 'Orage', 'annonces : ' || (m->>'annonces');
end $$;

-- Coût : moyenne de 200 appels, contre live_board (Otaku)
do $$
declare t0 timestamptz; i int; v json; ms_m numeric; ms_l numeric;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.mur_direct(); end loop;
  ms_m := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  t0 := clock_timestamp();
  for i in 1..50 loop v := public.live_board(); end loop;
  ms_l := extract(epoch from clock_timestamp() - t0) * 1000 / 50;
  raise notice 'COÛT sur % joueurs, % événements, % scans du jour : mur_direct % ms (% octets) ; live_board % ms',
    (select count(*) from public.players), (select count(*) from public.events), current_setting('banc.scans_jour'),
    round(ms_m, 2), length(public.mur_direct()::text), round(ms_l, 2);
end $$;
reset role;

select 'MUR : OK';
