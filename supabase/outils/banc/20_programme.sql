-- ============================================================================
-- Banc d'essai LOCAL : programme et plan (étape 2.6).
-- Se joue APRÈS 10_scenario.sql (réutilise le GM créé là-bas).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

update public.billetterie_config set actif = false where id = 1;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a0ff', 'intrus@test.local');

-- --- Le GM saisit le programme directement dans les tables ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);

insert into public.lieux (id, categorie, nom, x, y, pmr) values
  ('soleil',  'scene', 'Scène Soleil', 620, 150, true),
  ('dock',    'scene', 'Le Dock',      860, 360, true),
  ('st-kora', 'stand', 'Maison Kora',  690, 460, null),
  ('ferme',   'stand', 'Stand fermé',  0, 0, null);
update public.lieux set actif = false where id = 'ferme';
insert into public.scenes (id, couleur, ordre) values ('soleil', 'sodium', 1), ('dock', 'rose', 2);
insert into public.artistes (id, nom, genre, tete_affiche) values
  ('nova-kassa', 'Nova Kassa', 'Afro-pop', true),
  ('pixel-griot', 'Pixel Griot', 'Électro', false);
insert into public.artistes (id, nom, actif) values ('invite-surprise', 'Invité surprise', false);
insert into public.creneaux (artiste_id, scene_id, debut, fin) values
  ('nova-kassa',      'soleil', '2026-11-27 22:30+01', '2026-11-28 00:00+01'),
  ('pixel-griot',     'dock',   '2026-11-27 23:30+01', '2026-11-28 01:00+01'),
  ('pixel-griot',     'soleil', '2026-11-28 00:30+01', '2026-11-28 02:00+01'),
  ('invite-surprise', 'dock',   '2026-11-28 20:00+01', '2026-11-28 21:00+01');
insert into public.dedicaces (artiste_id, lieu_id, debut, fin) values
  ('nova-kassa', 'st-kora', '2026-11-27 20:00+01', '2026-11-27 20:45+01'),
  ('invite-surprise', 'st-kora', '2026-11-28 18:00+01', '2026-11-28 18:30+01');

do $$
begin
  -- Deux concerts en même temps sur la même scène : refusé
  begin
    insert into public.creneaux (artiste_id, scene_id, debut, fin)
    values ('nova-kassa', 'soleil', '2026-11-27 23:00+01', '2026-11-27 23:30+01');
    raise exception 'chevauchement accepté';
  exception when exclusion_violation then null; end;
  -- Fin avant le début : refusé
  begin
    insert into public.creneaux (artiste_id, scene_id, debut, fin)
    values ('nova-kassa', 'dock', '2026-11-29 23:00+01', '2026-11-29 22:00+01');
    raise exception 'durée négative acceptée';
  exception when check_violation then null; end;
  -- Une scène doit être un lieu de catégorie « scene »
  begin
    insert into public.scenes (id) values ('st-kora');
    raise exception 'stand promu scène';
  exception when foreign_key_violation then null; end;
  -- Identifiant mal formé
  begin
    insert into public.artistes (id, nom) values ('Nova Kassa', 'x');
    raise exception 'identifiant mal formé accepté';
  exception when check_violation then null; end;
  -- Le GM voit aussi ce qui n'est pas annoncé
  assert (select count(*) from public.artistes) = 3, 'GM : 3 artistes';
  assert (select count(*) from public.lieux) = 4, 'GM : 4 lieux';
end $$;

-- --- Un compte connecté qui n'est pas staff : lecture seule ---------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0ff', false);
do $$
declare n int;
begin
  begin
    insert into public.artistes (id, nom) values ('pirate', 'Pirate');
    raise exception 'intrus : insertion acceptée';
  exception when insufficient_privilege then null; end;
  update public.artistes set nom = 'Piraté' where id = 'nova-kassa';
  get diagnostics n = row_count;
  assert n = 0, 'intrus : modification acceptée';
  delete from public.creneaux;
  get diagnostics n = row_count;
  assert n = 0, 'intrus : suppression acceptée';
  assert (select count(*) from public.artistes) = 2, 'intrus : voit un artiste non annoncé';
end $$;
reset role;

-- --- Un visiteur puis un joueur (anon) ------------------------------------
select set_config('request.jwt.claim.sub', '', false);
create temp table t_prog (code text, a uuid, b uuid, c uuid, surprise uuid);
grant all on t_prog to anon;
insert into t_prog (surprise) select id from public.creneaux where artiste_id = 'invite-surprise';
set role anon;

do $$
declare v json; v_code text; v_a uuid; v_b uuid; v_c uuid; v_s uuid; n int;
begin
  -- Lecture publique : ce qui est annoncé seulement
  assert (select count(*) from public.artistes) = 2, 'anon : artistes';
  assert (select count(*) from public.creneaux) = 3, 'anon : créneaux';
  assert (select count(*) from public.dedicaces) = 1, 'anon : dédicaces';
  assert (select count(*) from public.lieux) = 3, 'anon : lieux actifs';
  v := public.programme_public();
  assert json_array_length(v->'artistes') = 2 and json_array_length(v->'creneaux') = 3
     and json_array_length(v->'scenes') = 2 and json_array_length(v->'lieux') = 3
     and json_array_length(v->'dedicaces') = 1, 'programme_public : ' || v::text;
  assert v->'scenes'->0->>'nom' = 'Scène Soleil', 'ordre des scènes';
  -- Le set de 0 h 30 appartient au vendredi
  assert (select count(*) from json_array_elements(v->'creneaux') c
          where c->>'jour' = '2026-11-27') = 3, 'journée de jeu des créneaux de nuit';

  -- Écriture directe : refusée partout
  begin
    insert into public.lieux (id, categorie, nom) values ('pirate', 'stand', 'x');
    raise exception 'anon : lieu inséré';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.favoris_programme (player_id, creneau_id)
    select id, (select id from public.creneaux limit 1) from public.players limit 1;
    raise exception 'anon : favori inséré en direct';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.favoris_programme) = 0, 'anon : lit les favoris';

  -- Un joueur
  v := public.create_player('Programme', 'soleil');
  v_code := v->>'secret_code';
  select id into v_a from public.creneaux where artiste_id = 'nova-kassa';
  select id into v_b from public.creneaux where artiste_id = 'pixel-griot' and scene_id = 'dock';
  select id into v_c from public.creneaux where artiste_id = 'pixel-griot' and scene_id = 'soleil';
  select surprise into v_s from t_prog;
  update t_prog set code = v_code, a = v_a, b = v_b, c = v_c;

  assert json_array_length(public.programme_favoris(v_code)->'favoris') = 0, 'favoris vides';
  v := public.programme_basculer_favori(v_code, v_a);
  assert (v->>'favori')::boolean and json_array_length(v->'chevauchements') = 0, 'ajout A : ' || v::text;
  v := public.programme_basculer_favori(lower(v_code), v_b);
  assert (v->>'favori')::boolean and v->'chevauchements'->>0 = v_a::text, 'ajout B chevauche A : ' || v::text;
  v := public.programme_basculer_favori(v_code, v_c);
  assert json_array_length(v->'chevauchements') = 1, 'ajout C chevauche B : ' || v::text;
  v := public.programme_basculer_favori(v_code, v_c);
  assert not (v->>'favori')::boolean, 'retrait C';

  v := public.programme_favoris(v_code)->'favoris';
  assert json_array_length(v) = 2 and v->0->>'creneau_id' = v_a::text
     and (v->0->>'rappel')::boolean, 'liste des favoris : ' || v::text;
  v := public.programme_rappel(v_code, v_a, false);
  assert not (public.programme_favoris(v_code)->'favoris'->0->>'rappel')::boolean, 'rappel coupé';
  assert (public.programme_popularite()->>v_a::text)::int = 1, 'popularité';

  begin perform public.programme_basculer_favori(v_code, v_s); raise exception 'surprise ajoutée';
  exception when others then assert sqlerrm = 'CRENEAU_INCONNU', sqlerrm; end;
  begin perform public.programme_basculer_favori('KORA-00000', v_a); raise exception 'faux code accepté';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
  begin perform public.programme_rappel(v_code, v_c, true); raise exception 'rappel sur non-favori';
  exception when others then assert sqlerrm = 'PAS_FAVORI', sqlerrm; end;
  begin perform public.programme_rappel(v_code, v_a, null); raise exception 'rappel null';
  exception when others then assert sqlerrm = 'VALEUR_INVALIDE', sqlerrm; end;
  begin perform public.programme_favoris(null); raise exception 'code null';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
end $$;
reset role;

-- --- Le GM annonce l'invité surprise, puis retire un artiste ---------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
update public.artistes set actif = true where id = 'invite-surprise';
reset role;

set role anon;
do $$
declare v json; r record;
begin
  select * into r from t_prog;
  assert json_array_length(public.programme_public()->'creneaux') = 4, 'surprise annoncée';
  v := public.programme_basculer_favori(r.code, r.surprise);
  assert (v->>'favori')::boolean, 'surprise ajoutée après annonce';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
-- Artiste masqué : ses favoris disparaissent de la liste sans être perdus
update public.artistes set actif = false where id = 'invite-surprise';
reset role;
set role anon;
do $$
declare r record;
begin
  select * into r from t_prog;
  assert json_array_length(public.programme_favoris(r.code)->'favoris') = 2, 'favori masqué avec l''artiste';
end $$;
reset role;
set role authenticated;
delete from public.artistes where id = 'nova-kassa';
reset role;
do $$
begin
  assert (select count(*) from public.favoris_programme) = 2, 'suppression en cascade';
  -- Renommer une scène suit partout
  update public.lieux set id = 'grande-scene' where id = 'soleil';
  assert (select count(*) from public.creneaux where scene_id = 'grande-scene') = 1, 'renommage de scène';
end $$;

select 'PROGRAMME : OK';
