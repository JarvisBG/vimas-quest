-- ============================================================================
-- Banc d'essai LOCAL : les coups de cœur (étape 4.9) — coeur_liste,
-- coeur_donner, coeur_retirer, coeur_palmares, et leur coût.
-- Se joue APRÈS 90_roue.sql (réutilise les 5 000 joueurs du classement).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Billetterie fermée (90_roue.sql) : pas de ticket à scanner.
-- Décor : une scène, 4 artistes (concert en cours, à venir, dédicace, passé),
-- 5 stands (4 scannés, 1 pas), 1 stand éteint.
insert into public.qr_codes (code, label, type, xp_reward) values
  ('DQ-SCCDC', 'Scène des cœurs', 'scene', 30),
  ('DQ-DECDC', 'Dédicace des cœurs', 'dedicace', 100);
insert into public.qr_codes (code, label, type, xp_reward)
select 'DQ-ST' || g, 'Stand cœur ' || g, 'stand', 20 from generate_series(1, 6) g;
insert into public.lieux (id, categorie, nom, description, qr_code_id, actif)
select 'cdc-st' || g, case when g = 2 then 'food' else 'stand' end, 'Stand cœur ' || g, 'Allée ' || g,
       (select id from public.qr_codes where code = 'DQ-ST' || g), g <> 6
from generate_series(1, 6) g;
insert into public.lieux (id, categorie, nom, qr_code_id) values
  ('scene-cdc', 'scene', 'Scène des cœurs', (select id from public.qr_codes where code = 'DQ-SCCDC'));
insert into public.scenes (id, couleur) values ('scene-cdc', 'rouge');
insert into public.artistes (id, nom, genre) values
  ('cdc-1', 'Cœur Un', 'Makossa'), ('cdc-2', 'Cœur Deux', 'Bikutsi'),
  ('cdc-3', 'Cœur Trois', 'Rap'), ('cdc-4', 'Cœur Quatre', 'Afro');
insert into public.creneaux (artiste_id, scene_id, debut, fin) values
  ('cdc-1', 'scene-cdc', now() - interval '10 minutes', now() + interval '20 minutes'),
  ('cdc-2', 'scene-cdc', now() + interval '3 hours', now() + interval '4 hours'),
  ('cdc-3', 'scene-cdc', now() + interval '5 hours', now() + interval '6 hours'),
  ('cdc-4', 'scene-cdc', now() - interval '3 hours', now() - interval '2 hours');
insert into public.dedicaces (artiste_id, lieu_id, debut, fin, qr_code_id) values
  ('cdc-3', 'cdc-st1', now() - interval '1 hour', now() + interval '1 hour',
   (select id from public.qr_codes where code = 'DQ-DECDC'));

set role anon;
do $$
declare v json; v_code text; g int; a json;
begin
  v := public.create_player('Coeur_1', 'soleil');
  v_code := v->>'secret_code';
  perform set_config('banc.code', v_code, false);
  perform public.scan_qr(v_code, 'DQ-SCCDC');     -- concert de cdc-1 en cours
  perform public.scan_qr(v_code, 'DQ-DECDC');     -- dédicace de cdc-3
  for g in 1..4 loop perform public.scan_qr(v_code, 'DQ-ST' || g); end loop;

  v := public.coeur_liste(v_code);
  assert (v->>'max')::int = 3 and (v->>'xp')::int = 10 and (v->>'xp_restants')::int = 3
     and not (v->>'clos')::boolean and v->>'cloture' is not null and not (v->>'jury')::boolean, 'réglages : ' || v::text;
  for a in select * from json_array_elements(v->'artistes') x where x->>'id' like 'cdc-%' loop
    assert (a->>'vu')::boolean = (a->>'id' in ('cdc-1', 'cdc-3')), 'vu : ' || a::text;
    assert a->'concert'->'scene'->>'nom' = 'Scène des cœurs', 'concert : ' || a::text;
  end loop;
  assert (select count(*) from json_array_elements(v->'stands') x where x->>'id' like 'cdc-st%') = 5, 'stand éteint visible';
  assert (select count(*) from json_array_elements(v->'stands') x where (x->>'vu')::boolean and x->>'id' like 'cdc-st%') = 4, 'stands vus';
  assert (select x->>'categorie' from json_array_elements(v->'stands') x where x->>'id' = 'cdc-st2') = 'food', 'food-truck';

  -- Artistes : pas vu = refusé ; 10 XP par cœur (+ les missions de compteur coeur actives)
  begin perform public.coeur_donner(v_code, 'artistes', 'cdc-2'); raise exception 'artiste pas vu accepté';
  exception when others then assert sqlerrm = 'PAS_SCANNE', sqlerrm; end;
  begin perform public.coeur_donner(v_code, 'artistes', 'cdc-4'); raise exception 'concert passé sans scan accepté';
  exception when others then assert sqlerrm = 'PAS_SCANNE', sqlerrm; end;
  v := public.coeur_donner(v_code, 'artistes', 'cdc-1');
  assert (v->>'gain')::int = 10 + coalesce((select sum(xp_reward) from public.quests where active and counter = 'coeur' and goal_count = 1), 0)
     and (v->>'coeurs')::int = 1 and (v->'mes')::text = '["cdc-1"]', 'cœur 1 : ' || v::text;
  begin perform public.coeur_donner(v_code, 'artistes', 'cdc-1'); raise exception 'double cœur accepté';
  exception when others then assert sqlerrm = 'DEJA_VOTE', sqlerrm; end;
  v := public.coeur_donner(v_code, 'artistes', 'cdc-3');   -- vu en dédicace
  assert (v->>'gain')::int = 10, 'dédicace : ' || v::text;

  -- Stands : le 3e cœur de la catégorie paie 0 XP (3 déjà versés) et donne le badge Jury
  v := public.coeur_donner(v_code, 'stands', 'cdc-st1');
  assert (v->>'gain')::int = 10, 'stand 1 : ' || v::text;
  v := public.coeur_donner(v_code, 'stands', 'cdc-st2');
  assert (v->>'gain')::int = 0 and (v->'badges')::text = '[]', 'stand 2 : ' || v::text;
  v := public.coeur_donner(v_code, 'stands', 'cdc-st3');
  assert (v->'badges')::text = '["Jury"]', 'badge Jury : ' || v::text;
  begin perform public.coeur_donner(v_code, 'stands', 'cdc-st4'); raise exception '4e cœur accepté';
  exception when others then assert sqlerrm = 'PLUS_DE_COEURS', sqlerrm; end;
  begin perform public.coeur_donner(v_code, 'stands', 'cdc-st5'); raise exception 'stand pas scanné accepté';
  exception when others then assert sqlerrm = 'PAS_SCANNE', sqlerrm; end;

  -- Changer d'avis : retirer puis donner ailleurs, sans XP ni badge de plus
  v := public.coeur_retirer(v_code, 'stands', 'cdc-st1');
  assert (v->>'coeurs')::int = 0 and (v->'mes')::text = '["cdc-st2", "cdc-st3"]', 'retrait : ' || v::text;
  v := public.coeur_retirer(v_code, 'stands', 'cdc-st1');   -- double clic : rien
  v := public.coeur_donner(v_code, 'stands', 'cdc-st4');
  assert (v->>'gain')::int = 0 and (v->'badges')::text = '[]', 'redonner : ' || v::text;
  begin perform public.coeur_donner(v_code, 'concerts', 'cdc-1'); raise exception 'catégorie inventée acceptée';
  exception when others then assert sqlerrm = 'CATEGORIE_INVALIDE', sqlerrm; end;

  v := public.coeur_liste(v_code);
  assert (v->>'jury')::boolean and (v->>'xp_restants')::int = 0, 'jury / xp : ' || v::text;
  assert (v->'mes'->'artistes')::text = '["cdc-1", "cdc-3"]' and json_array_length(v->'mes'->'stands') = 3, 'mes : ' || (v->>'mes');
  assert (select count(*) from public.coeurs) = 0, 'anon lit la table coeurs';

  -- Palmarès : un artiste éteint disparaît
  assert public.coeur_palmares('artistes', 1)->0->>'nom' in ('Cœur Un', 'Cœur Trois'), 'palmarès artistes';
  assert json_array_length(public.coeur_palmares(null, 50)) = 5, 'palmarès complet : ' || public.coeur_palmares(null, 50)::text;
  begin perform public.coeur_liste('PAS-UN-CODE'); raise exception 'code inconnu accepté';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
  raise notice 'coups de cœur : artistes vus, stands, plafond, Jury, retrait ok';
end $$;

-- Clôture : à la date, puis par la phase CLOTURE
reset role;
update public.coeur_config set cloture = now() - interval '1 second' where id = 1;
set role anon;
do $$
declare v_code text := current_setting('banc.code');
begin
  assert (public.coeur_liste(v_code)->>'clos')::boolean, 'clos à la date';
  begin perform public.coeur_retirer(v_code, 'stands', 'cdc-st2'); raise exception 'retrait après clôture';
  exception when others then assert sqlerrm = 'VOTES_CLOS', sqlerrm; end;
end $$;
reset role;
update public.coeur_config set cloture = now() + interval '1 day' where id = 1;
create temp table t_phase as select phase from public.game_state where id = 1;
update public.game_state set phase = 'CLOTURE' where id = 1;
set role anon;
do $$
begin
  begin perform public.coeur_donner(current_setting('banc.code'), 'stands', 'cdc-st1'); raise exception 'vote pendant CLOTURE';
  exception when others then assert sqlerrm = 'VOTES_CLOS', sqlerrm; end;
end $$;
reset role;
update public.game_state set phase = (select phase from t_phase) where id = 1;
update public.coeur_config set actif = false where id = 1;
set role anon;
do $$
begin
  begin perform public.coeur_donner(current_setting('banc.code'), 'stands', 'cdc-st1'); raise exception 'vote désactivé';
  exception when others then assert sqlerrm = 'COEUR_DESACTIVE', sqlerrm; end;
end $$;
reset role;
update public.coeur_config set actif = true where id = 1;

-- Coût : 40 artistes et 30 stands de plus, 5 000 joueurs à 6 cœurs = 30 000 cœurs
insert into public.artistes (id, nom) select 'cout-a' || g, 'Artiste ' || g from generate_series(1, 40) g;
insert into public.creneaux (artiste_id, scene_id, debut, fin)
select 'cout-a' || g, 'scene-cdc', now() + make_interval(days => 1, hours => g), now() + make_interval(days => 1, hours => g, mins => 50)
from generate_series(1, 40) g;
insert into public.qr_codes (code, label, type) select 'DQ-CO' || g, 'Stand coût ' || g, 'stand' from generate_series(1, 30) g;
insert into public.lieux (id, categorie, nom, qr_code_id)
select 'cout-s' || g, 'stand', 'Stand coût ' || g, (select id from public.qr_codes where code = 'DQ-CO' || g) from generate_series(1, 30) g;
insert into public.coeurs (player_id, categorie, cible)
select p.id, 'artistes', 'cout-a' || (1 + (abs(hashtext(p.id::text)) + k * 7) % 40)
from public.players p cross join generate_series(0, 2) k where p.pseudo like 'Banc%'
union all
select p.id, 'stands', 'cout-s' || (1 + (abs(hashtext(p.id::text)) + k * 11) % 30)
from public.players p cross join generate_series(0, 2) k where p.pseudo like 'Banc%';
insert into public.scans (player_id, qr_code_id, day)
select (select id from public.players where pseudo = 'Coeur_1'), id, public.jour_jeu() from public.qr_codes where code = 'DQ-CO1';
analyze public.coeurs;
select set_config('banc.nb_coeurs', (select count(*) from public.coeurs)::text, false);

set role anon;
do $$
declare t0 timestamptz; i int; v json; ms_l numeric; ms_v numeric; v_code text := current_setting('banc.code');
begin
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.coeur_liste(v_code); end loop;
  ms_l := extract(epoch from clock_timestamp() - t0) * 1000 / 100;
  assert json_array_length(v->'artistes') >= 44 and json_array_length(v->'stands') >= 35, 'listes : ' || json_array_length(v->'artistes');
  perform public.coeur_retirer(v_code, 'stands', 'cdc-st4');
  t0 := clock_timestamp();
  for i in 1..50 loop
    v := public.coeur_donner(v_code, 'stands', 'cout-s1');
    v := public.coeur_retirer(v_code, 'stands', 'cout-s1');
  end loop;
  ms_v := extract(epoch from clock_timestamp() - t0) * 1000 / 100;
  raise notice 'COÛT sur % cœurs : coeur_liste % ms, coeur_donner / coeur_retirer % ms',
    current_setting('banc.nb_coeurs'), round(ms_l, 2), round(ms_v, 2);
end $$;
reset role;

-- Le compteur suit le vrai décompte, y compris après des retraits
do $$
begin
  assert not exists (
    select 1 from (select categorie, cible, count(*) as n from public.coeurs group by 1, 2) c
    full join public.coeurs_totaux t using (categorie, cible)
    where coalesce(c.n, 0) <> coalesce(t.n, 0)), 'coeurs_totaux faux';
end $$;

select 'COUPS DE CŒUR : OK';
