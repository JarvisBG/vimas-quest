-- ============================================================================
-- Banc d'essai LOCAL : programme dans la console (étape 6.4) — lieux et
-- scènes, artistes, concerts (chevauchement nommé), dédicaces ; identifiants
-- figés, suppression refusée après usage ; droits et coût.
-- Se joue APRÈS 210_collecte.sql (ou seul après 10_scenario / 130_programme :
-- il crée ses comptes au besoin).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a003', 'lea@test.local'),
  ('00000000-0000-0000-0000-00000000a0ff', 'curieux@test.local')
on conflict do nothing;
insert into public.staff (user_id, display_name, role)
  values ('00000000-0000-0000-0000-00000000a003', 'Léa', 'staff') on conflict do nothing;

-- --- Droits -----------------------------------------------------------------
set role anon;
do $$
declare f text;
begin
  foreach f in array array['console_programme()', 'console_programme_supprimer(''lieu'', ''x'')',
                           'console_programme_activer(''lieu'', ''x'', true)'] loop
    begin
      execute 'select public.' || f;
      raise exception 'anonyme accepté : %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

set role authenticated;
do $$
declare f text; qui text;
begin
  foreach qui in array array['00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a0ff'] loop
    perform set_config('request.jwt.claim.sub', qui, true);
    foreach f in array array['console_programme()',
                             'console_lieu_enregistrer(null, ''{"id": "x", "categorie": "eau", "nom": "x"}'')',
                             'console_artiste_enregistrer(null, ''{"id": "x", "nom": "x"}'')',
                             'console_concert_enregistrer(null, ''{}'')',
                             'console_dedicace_enregistrer(null, ''{}'')',
                             'console_programme_supprimer(''lieu'', ''x'')',
                             'console_programme_activer(''artiste'', ''x'', true)'] loop
      begin
        execute 'select public.' || f;
        raise exception 'accepté pour % : %', qui, f;
      exception when raise_exception then assert sqlerrm = 'ACCES_REFUSE', qui || ' ' || f || ' : ' || sqlerrm;
      end;
    end loop;
  end loop;
end $$;

-- --- Lieux et scènes (Léa, staff) --------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', false);
do $$
declare v json; v_l json;
begin
  begin perform public.console_lieu_enregistrer(null, '{"id": "Scène B64", "categorie": "scene", "nom": "x"}');
    raise exception 'identifiant mal formé accepté';
  exception when raise_exception then assert sqlerrm = 'ID_INVALIDE', sqlerrm; end;
  begin perform public.console_lieu_enregistrer(null, '{"id": "b64-x", "categorie": "bar", "nom": "x"}');
    raise exception 'catégorie inventée acceptée';
  exception when raise_exception then assert sqlerrm = 'CATEGORIE_INVALIDE', sqlerrm; end;
  begin perform public.console_lieu_enregistrer(null, '{"id": "b64-x", "categorie": "eau", "nom": "x", "x": 500}');
    raise exception 'x sans y accepté';
  exception when raise_exception then assert sqlerrm = 'POSITION_INVALIDE', sqlerrm; end;
  begin perform public.console_lieu_enregistrer(null, '{"id": "b64-x", "categorie": "eau", "nom": "x", "x": 500, "y": 900}');
    raise exception 'y hors du plan accepté';
  exception when raise_exception then assert sqlerrm = 'POSITION_INVALIDE', sqlerrm; end;
  begin perform public.console_lieu_enregistrer(null, '{"id": "b64-x", "categorie": "scene", "nom": "x", "couleur": "violet"}');
    raise exception 'couleur inventée acceptée';
  exception when raise_exception then assert sqlerrm = 'COULEUR_INVALIDE', sqlerrm; end;

  -- Une scène : lieu + couleur en un appel
  v := public.console_lieu_enregistrer(null, '{"id": "scene-b64", "categorie": "scene", "nom": " Scène du banc 6.4 ",
         "x": 500, "y": 300, "pmr": true, "couleur": "rose", "ordre": 2, "horaires": "18 h - 2 h"}');
  assert v->>'id' = 'scene-b64', v::text;
  assert (select nom = 'Scène du banc 6.4' and x = 500 and pmr and ordre = 2 from public.lieux where id = 'scene-b64'), 'lieu';
  assert (select couleur = 'rose' and ordre = 2 from public.scenes where id = 'scene-b64'), 'scène créée avec sa couleur';
  begin perform public.console_lieu_enregistrer(null, '{"id": "scene-b64", "categorie": "eau", "nom": "Doublon"}');
    raise exception 'identifiant en double accepté';
  exception when raise_exception then assert sqlerrm = 'ID_PRIS', sqlerrm; end;

  -- Modifier : l'identifiant ne bouge pas même si le formulaire en envoie un autre
  perform public.console_lieu_enregistrer('scene-b64', '{"id": "autre", "categorie": "scene", "nom": "Scène Rose",
            "couleur": "vert", "pmr": null}');
  assert (select nom = 'Scène Rose' and pmr is null and x is null from public.lieux where id = 'scene-b64'), 'lieu modifié, retiré du plan';
  assert not exists (select 1 from public.lieux where id = 'autre'), 'identifiant figé';
  assert (select couleur = 'vert' from public.scenes where id = 'scene-b64'), 'couleur modifiée';
  begin perform public.console_lieu_enregistrer('scene-b64', '{"categorie": "stand", "nom": "Plus une scène"}');
    raise exception 'scène changée en stand';
  exception when raise_exception then assert sqlerrm = 'CATEGORIE_SCENE_FIGEE', sqlerrm; end;

  -- Stand → food : permis tant qu'il n'a ni QR ni cœurs
  perform public.console_lieu_enregistrer(null, '{"id": "stand-b64", "categorie": "stand", "nom": "Stand 6.4", "x": 100, "y": 100}');
  perform public.console_lieu_enregistrer('stand-b64', '{"categorie": "food", "nom": "Food 6.4", "x": 100, "y": 100}');
  assert (select categorie = 'food' from public.lieux where id = 'stand-b64'), 'stand devenu food';
  begin perform public.console_lieu_enregistrer('inconnu-b64', '{"categorie": "eau", "nom": "x"}');
    raise exception 'lieu fantôme modifié';
  exception when raise_exception then assert sqlerrm = 'LIEU_INCONNU', sqlerrm; end;

  -- Éteint : absent de la lecture publique, présent dans la console
  perform public.console_programme_activer('lieu', 'stand-b64', false);
  select l into v_l from json_array_elements(public.console_programme()->'lieux') l where l->>'id' = 'stand-b64';
  assert (v_l->>'actif')::boolean = false, 'console : lieu éteint visible';
  perform public.console_programme_activer('lieu', 'stand-b64', true);
end $$;

-- --- Artistes ------------------------------------------------------------------
do $$
declare v json; v_a json;
begin
  begin perform public.console_artiste_enregistrer(null, '{"id": "b64-a", "nom": "x", "genre": "polka"}');
    raise exception 'style inventé accepté';
  exception when raise_exception then assert sqlerrm = 'GENRE_INVALIDE', sqlerrm; end;
  begin perform public.console_artiste_enregistrer(null, '{"id": "b64-a", "nom": "x", "photo_url": "javascript:alert(1)"}');
    raise exception 'photo dangereuse acceptée';
  exception when raise_exception then assert sqlerrm = 'PHOTO_INVALIDE', sqlerrm; end;
  begin perform public.console_artiste_enregistrer(null, '{"id": "b64-a", "nom": "x", "photo_url": "assets/photos/../../x.webp"}');
    raise exception 'chemin détourné accepté';
  exception when raise_exception then assert sqlerrm = 'PHOTO_INVALIDE', sqlerrm; end;
  begin perform public.console_artiste_enregistrer(null, '{"id": "b64-a", "nom": ""}');
    raise exception 'nom vide accepté';
  exception when raise_exception then assert sqlerrm = 'NOM_MANQUANT', sqlerrm; end;

  -- Pas annoncé par défaut
  v := public.console_artiste_enregistrer(null, '{"id": "artiste-b64", "nom": "Nova Banc", "genre": "makossa",
         "photo_url": "assets/photos/artiste-b64.webp", "tete_affiche": true, "bio": "Une bio."}');
  assert (select not actif and tete_affiche and genre = 'makossa' from public.artistes where id = 'artiste-b64'), 'artiste créé éteint';
  perform public.console_artiste_enregistrer(null, '{"id": "artiste-b64b", "nom": "Second Banc", "actif": true,
         "photo_url": "https://exemple.org/photo.webp"}');
  perform public.console_artiste_enregistrer('artiste-b64', '{"nom": "Nova Banc (renommée)", "genre": "", "actif": true}');
  assert (select nom = 'Nova Banc (renommée)' and genre is null and actif and not tete_affiche and photo_url is null
            from public.artistes where id = 'artiste-b64'), 'artiste modifié (tous les champs)';
  begin perform public.console_artiste_enregistrer('fantome-b64', '{"nom": "x"}');
    raise exception 'artiste fantôme modifié';
  exception when raise_exception then assert sqlerrm = 'ARTISTE_INCONNU', sqlerrm; end;
  select a into v_a from json_array_elements(public.console_programme()->'artistes') a where a->>'id' = 'artiste-b64';
  assert v_a->>'nom' = 'Nova Banc (renommée)', v_a::text;
  assert json_array_length(public.console_programme()->'genres') >= 10, 'styles de la fiche fan';
end $$;

-- --- Concerts --------------------------------------------------------------------
do $$
declare v json; v_c1 uuid; v_c2 uuid; v_detail text; v_c json;
begin
  begin perform public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64", "scene_id": "stand-b64",
            "debut": "2026-11-27T20:00:00+01:00", "fin": "2026-11-27T21:00:00+01:00"}');
    raise exception 'concert sur un stand accepté';
  exception when raise_exception then assert sqlerrm = 'SCENE_INCONNUE', sqlerrm; end;
  begin perform public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64", "scene_id": "scene-b64",
            "debut": "2026-11-27 20:00", "fin": "2026-11-27T21:00:00+01:00"}');
    raise exception 'heure sans fuseau acceptée';
  exception when raise_exception then assert sqlerrm = 'HEURE_INVALIDE', sqlerrm; end;
  begin perform public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64", "scene_id": "scene-b64",
            "debut": "2026-11-27T20:00:00+01:00", "fin": "2026-11-27T19:00:00+01:00"}');
    raise exception 'fin avant début acceptée';
  exception when raise_exception then assert sqlerrm = 'DUREE_INVALIDE', sqlerrm; end;
  begin perform public.console_concert_enregistrer(null, '{"artiste_id": "personne", "scene_id": "scene-b64",
            "debut": "2026-11-27T20:00:00+01:00", "fin": "2026-11-27T21:00:00+01:00"}');
    raise exception 'artiste fantôme accepté';
  exception when raise_exception then assert sqlerrm = 'ARTISTE_INCONNU', sqlerrm; end;

  v := public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64", "scene_id": "scene-b64",
         "debut": "2026-11-27T20:00:00+01:00", "fin": "2026-11-27T21:00:00+01:00"}');
  v_c1 := (v->>'id')::uuid;
  -- Bout à bout : permis (21 h pile)
  v := public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64b", "scene_id": "scene-b64",
         "debut": "2026-11-27T21:00:00+01:00", "fin": "2026-11-27T22:30:00+01:00"}');
  v_c2 := (v->>'id')::uuid;
  -- Chevauchement : refusé, avec le concert gênant
  begin
    perform public.console_concert_enregistrer(null, '{"artiste_id": "artiste-b64b", "scene_id": "scene-b64",
              "debut": "2026-11-27T20:30:00+01:00", "fin": "2026-11-27T20:45:00+01:00"}');
    raise exception 'chevauchement accepté';
  exception when raise_exception then
    get stacked diagnostics v_detail = pg_exception_detail;
    assert sqlerrm = 'CHEVAUCHEMENT', sqlerrm;
    assert (v_detail::json)->>'artiste' = 'Nova Banc (renommée)', v_detail;
  end;
  -- Déplacer sur lui-même : pas un chevauchement
  perform public.console_concert_enregistrer(v_c1, '{"artiste_id": "artiste-b64", "scene_id": "scene-b64",
            "debut": "2026-11-27T19:45:00+01:00", "fin": "2026-11-27T21:00:00+01:00"}');
  assert (select debut = '2026-11-27T19:45:00+01:00'::timestamptz from public.creneaux where id = v_c1), 'concert décalé';
  select c into v_c from json_array_elements(public.console_programme()->'concerts') c where (c->>'id')::uuid = v_c1;
  assert (v_c->>'scanne')::boolean = false and (v_c->>'favoris')::int = 0, v_c::text;
  -- Supprimer une scène qui a des concerts : refusé
  begin perform public.console_programme_supprimer('lieu', 'scene-b64'); raise exception 'scène avec concerts supprimée';
  exception when raise_exception then assert sqlerrm = 'SCENE_A_DES_CONCERTS', sqlerrm; end;
  perform set_config('banc.c1', v_c1::text, false);
  perform set_config('banc.c2', v_c2::text, false);
end $$;

-- Traces des joueurs (en tant que la base) : un scan pendant le 1er concert,
-- un favori sur le 2e, un cœur sur le food
reset role;
do $$
declare v_joueur uuid := (select id from public.players where efface_le is null order by created_at limit 1);
        v_qr uuid;
begin
  insert into public.qr_codes (code, label, type, xp_reward, active)
    values ('DQ-B64SC', 'Scène du banc 6.4', 'scene', 30, true) returning id into v_qr;
  update public.lieux set qr_code_id = v_qr where id = 'scene-b64';
  insert into public.scans (player_id, qr_code_id, creneau_id, day)
    values (v_joueur, v_qr, current_setting('banc.c1')::uuid, '2026-11-27');
  insert into public.favoris_programme (player_id, creneau_id) values (v_joueur, current_setting('banc.c2')::uuid);
  insert into public.coeurs (player_id, categorie, cible) values (v_joueur, 'stands', 'stand-b64');
end $$;
set role authenticated;

do $$
declare v json; v_c1 uuid := current_setting('banc.c1')::uuid; v_c2 uuid := current_setting('banc.c2')::uuid; v_l json;
begin
  -- Concert scanné : ni changer d'artiste, ni de scène, ni supprimer ; le décaler, oui
  begin perform public.console_concert_enregistrer(v_c1, '{"artiste_id": "artiste-b64b", "scene_id": "scene-b64",
            "debut": "2026-11-27T19:45:00+01:00", "fin": "2026-11-27T21:00:00+01:00"}');
    raise exception 'artiste d''un concert scanné changé';
  exception when raise_exception then assert sqlerrm = 'CONCERT_DEJA_SCANNE', sqlerrm; end;
  perform public.console_concert_enregistrer(v_c1, '{"artiste_id": "artiste-b64", "scene_id": "scene-b64",
            "debut": "2026-11-27T19:30:00+01:00", "fin": "2026-11-27T20:50:00+01:00"}');
  begin perform public.console_programme_supprimer('concert', v_c1::text); raise exception 'concert scanné supprimé';
  exception when raise_exception then assert sqlerrm = 'CONCERT_DEJA_SCANNE', sqlerrm; end;
  begin perform public.console_programme_supprimer('artiste', 'artiste-b64'); raise exception 'artiste vu supprimé';
  exception when raise_exception then assert sqlerrm = 'ARTISTE_DEJA_VU', sqlerrm; end;
  begin perform public.console_programme_supprimer('concert', 'pas-un-uuid'); raise exception 'id illisible accepté';
  exception when raise_exception then assert sqlerrm = 'CONCERT_INCONNU', sqlerrm; end;

  -- Lecture : scanné, favori, QR du lieu (lecture seule), cœurs
  assert (select (c->>'scanne')::boolean from json_array_elements(public.console_programme()->'concerts') c
           where (c->>'id')::uuid = v_c1), 'concert scanné';
  select l into v_l from json_array_elements(public.console_programme()->'lieux') l where l->>'id' = 'scene-b64';
  assert v_l->'qr'->>'code' = 'DQ-B64SC' and (v_l->'qr'->>'scans')::int = 1 and (v_l->>'concerts')::int = 2, v_l::text;

  -- Food avec des cœurs : ni suppression, ni changement de catégorie
  begin perform public.console_programme_supprimer('lieu', 'stand-b64'); raise exception 'lieu avec cœurs supprimé';
  exception when raise_exception then assert sqlerrm = 'LIEU_A_DES_COEURS', sqlerrm; end;
  begin perform public.console_lieu_enregistrer('stand-b64', '{"categorie": "stand", "nom": "Food 6.4"}');
    raise exception 'catégorie changée malgré les cœurs';
  exception when raise_exception then assert sqlerrm = 'CATEGORIE_COEURS', sqlerrm; end;

  -- Concert non scanné avec un favori : supprimé, le favori part avec (compté)
  v := public.console_programme_supprimer('concert', v_c2::text);
  assert (v->>'favoris')::int = 1, v::text;
  assert not exists (select 1 from public.favoris_programme where creneau_id = v_c2), 'favori parti';
end $$;

-- --- Dédicaces -------------------------------------------------------------------
do $$
declare v json; v_d uuid; v_d2 uuid;
begin
  begin perform public.console_dedicace_enregistrer(null, '{"artiste_id": "artiste-b64", "lieu_id": "nulle-part",
            "debut": "2026-11-28T15:00:00+01:00", "fin": "2026-11-28T16:00:00+01:00"}');
    raise exception 'lieu fantôme accepté';
  exception when raise_exception then assert sqlerrm = 'LIEU_INCONNU', sqlerrm; end;
  v := public.console_dedicace_enregistrer(null, '{"artiste_id": "artiste-b64", "lieu_id": "stand-b64",
         "debut": "2026-11-28T15:00:00+01:00", "fin": "2026-11-28T16:00:00+01:00"}');
  v_d := (v->>'id')::uuid;
  -- Deux séances peuvent se tenir en même temps (pas de contrainte par lieu)
  v := public.console_dedicace_enregistrer(null, '{"artiste_id": "artiste-b64b", "lieu_id": "",
         "debut": "2026-11-28T15:00:00+01:00", "fin": "2026-11-28T15:30:00+01:00"}');
  v_d2 := (v->>'id')::uuid;
  assert (select lieu_id is null from public.dedicaces where id = v_d2), 'séance sans lieu';
  perform public.console_dedicace_enregistrer(v_d2, '{"artiste_id": "artiste-b64", "lieu_id": "scene-b64",
            "debut": "2026-11-28T17:00:00+01:00", "fin": "2026-11-28T17:30:00+01:00"}');
  assert (select artiste_id = 'artiste-b64' and lieu_id = 'scene-b64' from public.dedicaces where id = v_d2), 'séance modifiée';
  perform public.console_programme_supprimer('dedicace', v_d2::text);
  assert not exists (select 1 from public.dedicaces where id = v_d2), 'séance supprimée';
  perform set_config('banc.d', v_d::text, false);
end $$;

-- Son QR scanné : l'artiste ne change plus, la séance ne se supprime plus
reset role;
do $$
declare v_qr uuid; v_joueur uuid := (select id from public.players where efface_le is null order by created_at limit 1);
begin
  insert into public.qr_codes (code, label, type, xp_reward, active)
    values ('DQ-B64DD', 'Dédicace du banc 6.4', 'dedicace', 100, true) returning id into v_qr;
  update public.dedicaces set qr_code_id = v_qr where id = current_setting('banc.d')::uuid;
  insert into public.scans (player_id, qr_code_id, day) values (v_joueur, v_qr, '2026-11-28');
end $$;
set role authenticated;
do $$
declare v_d uuid := current_setting('banc.d')::uuid; v_x json;
begin
  begin perform public.console_dedicace_enregistrer(v_d, '{"artiste_id": "artiste-b64b", "lieu_id": "stand-b64",
            "debut": "2026-11-28T15:00:00+01:00", "fin": "2026-11-28T16:00:00+01:00"}');
    raise exception 'artiste d''une séance scannée changé';
  exception when raise_exception then assert sqlerrm = 'DEDICACE_DEJA_SCANNEE', sqlerrm; end;
  begin perform public.console_programme_supprimer('dedicace', v_d::text); raise exception 'séance scannée supprimée';
  exception when raise_exception then assert sqlerrm = 'DEDICACE_DEJA_SCANNEE', sqlerrm; end;
  select d into v_x from json_array_elements(public.console_programme()->'dedicaces') d where (d->>'id')::uuid = v_d;
  assert (v_x->>'scanne')::boolean and v_x->'qr'->>'code' = 'DQ-B64DD', v_x::text;
  -- artiste-b64b : vu nulle part, sans cœur → supprimable avec ses concerts
  perform public.console_programme_supprimer('artiste', 'artiste-b64b');
  assert not exists (select 1 from public.artistes where id = 'artiste-b64b'), 'artiste supprimé';
  begin perform public.console_programme_supprimer('scene', 'scene-b64'); raise exception 'quoi inventé accepté';
  exception when raise_exception then assert sqlerrm = 'QUOI_INVALIDE', sqlerrm; end;
  -- Lieu sans trace : supprimé (scène comprise)
  perform public.console_lieu_enregistrer(null, '{"id": "scene-b64-vide", "categorie": "scene", "nom": "Vide"}');
  perform public.console_programme_supprimer('lieu', 'scene-b64-vide');
  assert not exists (select 1 from public.scenes where id = 'scene-b64-vide'), 'scène vide supprimée';
end $$;
reset role;

-- Nettoyage (la base, pas la console : les traces bloquent la suppression)
delete from public.scans where qr_code_id in (select id from public.qr_codes where code in ('DQ-B64SC', 'DQ-B64DD'));
delete from public.coeurs where cible = 'stand-b64';
delete from public.qr_codes where code in ('DQ-B64SC', 'DQ-B64DD');
delete from public.artistes where id like 'artiste-b64%';
delete from public.lieux where id in ('scene-b64', 'stand-b64');

-- --- Coût : programme complet (130_programme : 8 scènes, 80 artistes, 160 concerts) -----
\c banc_domaf
\set QUIET on
\pset tuples_only on
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', false);
do $$
declare t0 timestamptz; i int; v json; v_ms numeric;
        -- Compté AVANT la mesure : un raise évalue ses arguments dans l'ordre, et
        -- un count(*) sur scans (1,16 million de lignes, politique RLS vérifiée
        -- ligne à ligne) prend plusieurs secondes : placé dans le raise, il se
        -- serait ajouté au temps de la fonction.
        v_n_scans bigint := (select count(*) from public.scans);
begin
  t0 := clock_timestamp();
  for i in 1..20 loop v := public.console_programme(); end loop;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000 / 20, 1);
  raise notice 'COÛT sur % lieux, % artistes, % concerts, % scans : console_programme % ms (% Ko)',
    json_array_length(v->'lieux'), json_array_length(v->'artistes'), json_array_length(v->'concerts'),
    v_n_scans, v_ms, round(length(v::text) / 1024.0, 1);
end $$;
reset role;

select 'PROGRAMME CONSOLE : OK';
