-- ============================================================================
-- Banc d'essai LOCAL : la roue (étape 4.8) — roulette_joueur, spin_roulette
-- (plafond par jour, id du lot), admin_redeem (remis par), et leur coût.
-- Se joue APRÈS 80_classement.sql (réutilise ses 5 000 joueurs).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Billetterie fermée : pass_actif() répond oui à tout le monde
update public.billetterie_config set actif = false where id = 1;
update public.game_state set roulette_cost = 5, roulette_max_jour = 3 where id = 1;
-- On repart d'une roue vide : 1 objet en stock limité, 1 bonus d'XP, 1 lot inactif
delete from public.roulette_spins;
delete from public.roulette_prizes;
insert into public.roulette_prizes (id, name, icon, weight, stock, kind, value, rarete, court, active) values
  ('00000000-0000-0000-0000-0000000001a1', 'Casquette officielle', 'etoile', 50, 2, 'objet', 0, 'commun', 'Casquette', true),
  ('00000000-0000-0000-0000-0000000001a2', '+50 XP', 'eclair', 50, null, 'xp', 50, 'commun', '+50 XP', true),
  ('00000000-0000-0000-0000-0000000001a3', 'Lot retiré', 'cadeau', 10, null, 'objet', 0, 'rare', null, false);
insert into public.players (id, pseudo, archetype, jetons) values
  ('00000000-0000-0000-0000-00000000f001', 'Roue_1', 'soleil', 100);
insert into public.player_secrets (player_id, secret_code) values ('00000000-0000-0000-0000-00000000f001', 'BANC-ROUE');
-- 20 000 tirages d'hier et d'avant répartis sur les joueurs du classement
insert into public.roulette_spins (player_id, prize_id, cost, redeem_code, created_at)
select p.id, '00000000-0000-0000-0000-0000000001a2', 5,
       case when g % 10 = 0 then upper(substr(md5(g::text), 1, 6)) end,
       public._debut_jour_jeu() - make_interval(mins => g % 3000)
from generate_series(1, 20000) g
join lateral (select id from public.players where pseudo = 'Banc' || (1 + g % 5000)) p on true;
-- Et 4 tirages du joueur suivi, la veille : ils ne comptent pas dans le plafond
insert into public.roulette_spins (player_id, prize_id, cost, created_at)
select '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000001a2', 5,
       public._debut_jour_jeu() - interval '1 minute'
from generate_series(1, 4);
analyze public.roulette_spins;

set role anon;
do $$
declare r json; v json; i int; v_bons int := 0;
begin
  r := public.roulette_joueur('banc-roue');
  assert (r->>'cout')::int = 5 and (r->>'max_jour')::int = 3, 'réglages : ' || r::text;
  assert (r->>'tirages_jour')::int = 0, 'tirages de la veille comptés : ' || (r->>'tirages_jour');
  assert json_array_length(r->'lots') = 2, 'lot inactif visible : ' || (r->>'lots');
  assert r->'lots'->0->>'court' = 'Casquette' and r->'lots'->0->>'rarete' = 'commun', 'lot : ' || (r->'lots'->0)::text;
  assert json_array_length(r->'bons') = 0, 'bons';

  -- 3 tirages, puis le plafond ; chaque réponse donne l'id d'un lot de la roue
  for i in 1..3 loop
    v := public.spin_roulette('BANC-ROUE');
    assert v->'prize'->>'id' in ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001a2'),
      'id du lot : ' || v::text;
    assert (v->>'jetons_restants')::int = 100 - 5 * i, 'jetons : ' || v::text;
    if v->'prize'->>'redeem' is not null then v_bons := v_bons + 1; end if;
  end loop;
  begin perform public.spin_roulette('BANC-ROUE'); raise exception '4e tirage accepté';
  exception when others then assert sqlerrm = 'PLAFOND_JOUR', sqlerrm; end;

  r := public.roulette_joueur('BANC-ROUE');
  assert (r->>'tirages_jour')::int = 3, 'tirages du jour : ' || (r->>'tirages_jour');
  assert (r->>'jetons')::int = 85, 'jetons (le 4e tirage refusé ne débite rien) : ' || (r->>'jetons');
  -- (anon ne lit pas roulette_spins : on compte les bons reçus pendant les tirages)
  assert json_array_length(r->'bons') = v_bons, 'bons : ' || (r->>'bons');
  raise notice 'roue : 3 tirages, plafond ok (% bon(s))', v_bons;

  begin perform public.roulette_joueur('PAS-UN-CODE'); raise exception 'code inconnu accepté';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
  begin perform public.admin_prize_affichage('00000000-0000-0000-0000-0000000001a1', 'rare', 'X');
    raise exception 'anon règle un lot';
  exception when others then assert sqlerrm like 'permission denied%', sqlerrm; end;
end $$;
reset role;

-- Un bon forcé pour le retrait au stand (le hasard peut n'en avoir donné aucun)
insert into public.roulette_spins (player_id, prize_id, cost, redeem_code, created_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000001a1', 5, 'BANCB1', now() - interval '2 days');

-- Le vendeur remet le lot : son prénom apparaît sur le bon du joueur
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);
do $$
declare v json;
begin
  v := public.admin_redeem('bancb1');
  assert v->>'player' = 'Roue_1', 'retrait : ' || v::text;
  begin perform public.admin_set_roulette_plafond(5); raise exception 'vendeur règle le plafond';
  exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json;
begin
  v := public.admin_prize_affichage('00000000-0000-0000-0000-0000000001a1', 'Epique', ' Casquette ');
  assert v->>'rarete' = 'epique' and v->>'court' = 'Casquette', 'affichage : ' || v::text;
  begin perform public.admin_prize_affichage('00000000-0000-0000-0000-0000000001a1', 'mythique', null);
    raise exception 'rareté inventée acceptée';
  exception when others then assert sqlerrm = 'RARETE_INVALIDE', sqlerrm; end;
  v := public.admin_set_roulette_plafond(0);
  v := public.admin_create_prize('Sans icône', null, 1, null);
  assert v->>'icon' = 'cadeau', 'icône par défaut : ' || v::text;
end $$;
set role anon;
do $$
declare r json; b json;
begin
  select x into b from json_array_elements(public.roulette_joueur('BANC-ROUE')->'bons') x where x->>'code' = 'BANCB1';
  assert b->>'par' = 'Awa' and b->>'retire_le' is not null, 'bon retiré : ' || coalesce(b::text, 'absent');
  -- Plafond à 0 = sans plafond
  perform public.spin_roulette('BANC-ROUE');
end $$;
reset role;

-- Coût : moyenne de 200 appels, 20 000 tirages en base
do $$
declare t0 timestamptz; i int; v json; ms_r numeric; ms_s numeric;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.roulette_joueur('BANC-ROUE'); end loop;
  ms_r := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  t0 := clock_timestamp();
  for i in 1..10 loop v := public.spin_roulette('BANC-ROUE'); end loop;
  ms_s := extract(epoch from clock_timestamp() - t0) * 1000 / 10;
  raise notice 'COÛT sur % tirages : roulette_joueur % ms, spin_roulette % ms',
    (select count(*) from public.roulette_spins), round(ms_r, 2), round(ms_s, 2);
end $$;

select 'ROUE : OK';
