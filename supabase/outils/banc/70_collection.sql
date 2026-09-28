-- ============================================================================
-- Banc d'essai LOCAL : la collection (étape 4.5) — player_collection, un scan
-- de scène par concert, reliques, badges secrets, console_badge_enregistrer.
-- Se joue APRÈS 60_missions.sql.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Décor : une scène avec un concert EN COURS, un food-truck, une relique
-- trouvable, une relique éteinte, une séance de dédicaces.
insert into public.qr_codes (code, label, type, rarity, hint, xp_reward) values
  ('DQ-SCBANC', 'Scène du banc',      'scene',    null,   null, 30),
  ('DQ-FTBANC', 'Chez Yassa',         'foodtruck', null,  null, 15),
  ('DQ-RELBAN', 'Le micro d''or',     'relique',  'rare', 'Là où l''on se désaltère.', 150),
  ('DQ-DEDBAN', 'Dédicace du banc',   'dedicace', null,   null, 100);
insert into public.qr_codes (code, label, type, rarity, hint, active) values
  ('DQ-RELOFF', 'Relique éteinte', 'relique', 'commune', 'Nulle part.', false);
insert into public.lieux (id, categorie, nom, description, qr_code_id) values
  ('scene-banc', 'scene', 'Scène du banc', null, (select id from public.qr_codes where code = 'DQ-SCBANC')),
  ('yassa',      'food',  'Chez Yassa', 'Village food', (select id from public.qr_codes where code = 'DQ-FTBANC'));
insert into public.scenes (id, couleur) values ('scene-banc', 'vert');
insert into public.artistes (id, nom, genre) values ('art-a', 'Artiste A', 'Makossa'), ('art-b', 'Artiste B', 'Rap');
insert into public.creneaux (artiste_id, scene_id, debut, fin) values
  ('art-a', 'scene-banc', now() - interval '10 minutes', now() + interval '20 minutes'),
  ('art-b', 'scene-banc', now() + interval '3 hours', now() + interval '4 hours');
insert into public.dedicaces (artiste_id, lieu_id, debut, fin, qr_code_id) values
  ('art-b', 'yassa', now() - interval '1 hour', now() + interval '1 hour',
   (select id from public.qr_codes where code = 'DQ-DEDBAN'));

set role anon;
do $$
declare v json; v_code text;
begin
  v := public.create_player('Collection', 'soleil');
  v_code := v->>'secret_code';
  perform set_config('banc.code', v_code, false);

  -- Concert en cours : l'artiste A entre dans la collection
  v := public.scan_qr(v_code, 'DQ-SCBANC');
  assert v->'artiste'->>'id' = 'art-a' and (v->'artiste'->>'nouveau')::boolean
     and not (v->'artiste'->>'dedicace')::boolean, 'artiste A : ' || coalesce(v->>'artiste', 'null');
  assert json_array_length(v->'quetes') = 1, 'la mission de scène avance : ' || (v->>'quetes');
  begin perform public.scan_qr(v_code, 'DQ-SCBANC'); raise exception 'même concert accepté deux fois';
  exception when others then assert sqlerrm = 'DEJA_SCANNE', sqlerrm; end;
end $$;

-- Le concert A se termine, B commence sur la même scène
reset role;
update public.creneaux set debut = now() - interval '2 hours', fin = now() - interval '1 hour' where artiste_id = 'art-a';
update public.creneaux set debut = now() - interval '5 minutes', fin = now() + interval '1 hour' where artiste_id = 'art-b';
set role anon;
do $$
declare v json; v_code text := current_setting('banc.code');
begin
  v := public.scan_qr(v_code, 'DQ-SCBANC');
  assert v->'artiste'->>'id' = 'art-b', 'artiste B : ' || coalesce(v->>'artiste', 'null');
  assert (v->>'xp_gagne')::int = 30, 'XP du 2e concert : ' || (v->>'xp_gagne');
  assert json_array_length(v->'quetes') = 0, 'même scène : les missions n''avancent pas : ' || (v->>'quetes');
  begin perform public.scan_qr(v_code, 'DQ-SCBANC'); raise exception 'concert B accepté deux fois';
  exception when others then assert sqlerrm = 'DEJA_SCANNE', sqlerrm; end;
end $$;

-- Plus de concert : un scan « hors concert » par jour, sans artiste
reset role;
update public.creneaux set debut = now() - interval '50 minutes', fin = now() - interval '1 minute' where artiste_id = 'art-b';
set role anon;
do $$
declare v json; v_code text := current_setting('banc.code');
begin
  v := public.scan_qr(v_code, 'DQ-SCBANC');
  assert v->'artiste' is null or json_typeof(v->'artiste') = 'null', 'hors concert : pas d''artiste';
  begin perform public.scan_qr(v_code, 'DQ-SCBANC'); raise exception 'hors concert accepté deux fois';
  exception when others then assert sqlerrm = 'DEJA_SCANNE', sqlerrm; end;

  perform public.scan_qr(v_code, 'DQ-FTBANC');
  v := public.scan_qr(v_code, 'DQ-RELBAN');
  assert (v->'nouveaux_badges')::jsonb ? 'Fouineur', 'Fouineur : ' || (v->>'nouveaux_badges');
  v := public.scan_qr(v_code, 'DQ-DEDBAN');
  assert v->'artiste'->>'id' = 'art-b' and (v->'artiste'->>'dedicace')::boolean, 'dédicace : ' || coalesce(v->>'artiste', 'null');
end $$;

do $$
declare c json; x json;
begin
  c := public.player_collection(current_setting('banc.code'));
  assert c->'player' is null, 'pas de ligne joueur';

  -- Passeport (4.6) : joueurs, jours de présence, missions terminées
  assert (c->>'joueurs')::int = (select count(*) from public.players), 'joueurs : ' || (c->>'joueurs');
  assert (c->>'jours_presents')::int = 1, 'jours présents : ' || (c->>'jours_presents');
  assert (c->>'missions')::int >= 1, 'missions terminées : ' || (c->>'missions');

  -- Artistes : vus, avec la dédicace ; un artiste non annoncé n'apparaît pas
  select a into x from json_array_elements(c->'artistes') a where a->>'id' = 'art-a';
  assert x->>'vu' is not null and not (x->>'dedicace')::boolean, 'art-a : ' || x::text;
  assert x->'concert'->'scene'->>'nom' = 'Scène du banc', 'concert affiché : ' || x::text;
  select a into x from json_array_elements(c->'artistes') a where a->>'id' = 'art-b';
  assert x->>'vu' is not null and (x->>'dedicace')::boolean, 'art-b : ' || x::text;
  select a into x from json_array_elements(c->'artistes') a where a->>'id' = 'nova-kassa';
  assert x->>'vu' is null, 'nova-kassa pas vue';
  assert not exists (select 1 from json_array_elements(c->'artistes') a where a->>'id' = 'invite-surprise'), 'artiste non annoncé visible';

  -- Stands : seulement ceux qui ont un QR ; zone = description
  assert json_array_length(c->'stands') = 1, 'stands : ' || (c->>'stands');
  assert c->'stands'->0->>'zone' = 'Village food' and c->'stands'->0->>'vu' is not null
     and c->'stands'->0->>'categorie' = 'food', 'food-truck : ' || (c->>'stands');

  -- Reliques : trouvée = nom ; éteinte et jamais trouvée = absente
  select r into x from json_array_elements(c->'reliques') r where r->>'nom' = 'Le micro d''or';
  assert x is not null and x->>'indice' is not null and x->>'rarete' = 'rare', 'relique trouvée : ' || (c->>'reliques');
  assert not exists (select 1 from json_array_elements(c->'reliques') r where r->>'indice' = 'Nulle part.'), 'relique éteinte visible';
  assert not exists (select 1 from json_array_elements(c->'reliques') r where r->>'vu' is null and r->>'nom' is not null), 'nom d''une relique pas trouvée';

  -- Badges : Fouineur gagné, secrets cachés, pourcentage calculé
  select b into x from json_array_elements(c->'badges') b where b->>'nom' = 'Fouineur';
  assert x->>'obtenu' is not null and x->>'rarete' = 'epique' and (x->>'pct')::int between 1 and 100, 'Fouineur : ' || x::text;
  assert (select count(*) from json_array_elements(c->'badges') b
           where (b->>'secret')::boolean and b->>'nom' is null and b->>'icone' is null and b->>'texte' is not null) = 2,
         'badges secrets cachés';
  assert json_array_length(c->'badges') = 15, 'badges : ' || json_array_length(c->'badges');
end $$;
reset role;

-- La console règle l'affichage d'un badge ; un intrus est refusé
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false) is not null;
do $$
declare v_id uuid := (select id from public.badges where name = 'Jury');
begin
  perform public.console_badge_enregistrer(v_id, '{"nom": "Jury", "icone": "coeur", "rarete": "rare",
    "forme": "hexa", "secret": true, "lien": "coups-de-coeur.html"}');
  assert (select rarete = 'rare' and forme = 'hexa' and secret and lien = 'coups-de-coeur.html'
          from public.badges where id = v_id), 'réglage du badge';
  begin perform public.console_badge_enregistrer(v_id, '{"nom": "Jury", "forme": "carre"}'); raise exception 'forme inventée acceptée';
  exception when others then assert sqlerrm = 'FORME_INVALIDE', sqlerrm; end;
  begin perform public.console_badge_enregistrer(v_id, '{"nom": "Jury", "lien": "javascript:alert(1)"}'); raise exception 'lien dangereux accepté';
  exception when others then assert sqlerrm = 'LIEN_INVALIDE', sqlerrm; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0ff', false) is not null;
do $$
begin
  perform public.console_badge_enregistrer((select id from public.badges limit 1), '{"nom": "Intrus"}');
  raise exception 'intrus accepté';
exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;
reset role;

select 'COLLECTION : OK';
