-- ============================================================================
-- Banc d'essai LOCAL : le programme côté joueur (étape 4.12) — programme_favoris
-- (favoris + artistes vus + style préféré) et coût de programme_public sur un
-- programme de taille réelle.
-- Se joue APRÈS 110_annonces.sql (réutilise le décor de 100_coeurs.sql : cdc-1
-- en concert, dédicace de cdc-3 en cours).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

set role anon;
do $$
declare v json; v_code text; v_cr uuid;
begin
  v := public.create_player('Prog_1', 'soleil');
  v_code := v->>'secret_code';
  perform set_config('banc.code', v_code, false);

  -- Rien vu, pas de style : réponse complète quand même
  v := public.programme_favoris(v_code);
  assert json_array_length(v->'favoris') = 0 and json_array_length(v->'vus') = 0
     and v->>'genre' is null, 'joueur neuf : ' || v::text;

  perform public.fiche_enregistrer(v_code, '{"genre_prefere": "makossa"}');
  perform public.scan_qr(v_code, 'DQ-SCCDC');     -- concert de cdc-1 en cours
  perform public.scan_qr(v_code, 'DQ-DECDC');     -- dédicace de cdc-3
  select id into v_cr from public.creneaux where artiste_id = 'cdc-2';
  perform public.programme_basculer_favori(v_code, v_cr);

  v := public.programme_favoris(v_code);
  assert v->>'genre' = 'makossa', 'style : ' || v::text;
  assert json_array_length(v->'vus') = 2
     and (v->'vus')::jsonb @> '["cdc-1", "cdc-3"]'::jsonb, 'vus : ' || v::text;
  assert json_array_length(v->'favoris') = 1 and v->'favoris'->0->>'creneau_id' = v_cr::text,
    'favoris : ' || v::text;
end $$;
reset role;

-- Artiste masqué : il disparaît aussi des « vus »
update public.artistes set actif = false where id = 'cdc-3';
set role anon;
do $$
declare v json;
begin
  v := public.programme_favoris(current_setting('banc.code'));
  assert json_array_length(v->'vus') = 1 and v->'vus'->>0 = 'cdc-1', 'vus masqué : ' || v::text;
end $$;
reset role;
update public.artistes set actif = true where id = 'cdc-3';

-- --- Coût sur un programme de taille réelle --------------------------------
-- 8 scènes, 80 artistes (bio de 250 caractères), 160 concerts sur 4 jours,
-- 20 dédicaces, 60 lieux.
insert into public.lieux (id, categorie, nom, description, x, y)
select 'bs' || g, 'scene', 'Scène banc ' || g, 'Près de l''entrée ' || g, g * 90, g * 40
from generate_series(1, 8) g;
insert into public.scenes (id, couleur, ordre)
select 'bs' || g, (array['sodium','vert','rose','bleu','nuit','rouge','papier','sodium'])[g], g
from generate_series(1, 8) g;
insert into public.lieux (id, categorie, nom, description, horaires, x, y)
select 'bl' || g, (array['stand','food','eau','toilettes','secours'])[1 + g % 5], 'Lieu banc ' || g,
       'Allée ' || g, '17 h – 3 h', g * 13, g * 7
from generate_series(1, 52) g;
insert into public.artistes (id, nom, genre, bio, photo_url, tete_affiche)
select 'ba' || g, 'Artiste banc ' || g, 'Makossa nouvelle vague', repeat('Une bio de festival. ', 12),
       case when g % 3 = 0 then 'assets/photos/ba' || g || '.webp' end, g % 10 = 0
from generate_series(1, 80) g;
-- 5 concerts par scène et par jour, de 18 h à 3 h (1 h 30 + 15 min de changement)
insert into public.creneaux (artiste_id, scene_id, debut, fin)
select 'ba' || (1 + ((s - 1) * 20 + (j - 1) * 5 + k - 1) % 80), 'bs' || s,
       timestamptz '2026-11-26 18:00+01' + (j - 1) * interval '1 day' + (k - 1) * interval '105 minutes',
       timestamptz '2026-11-26 19:30+01' + (j - 1) * interval '1 day' + (k - 1) * interval '105 minutes'
from generate_series(1, 8) s, generate_series(1, 4) j, generate_series(1, 5) k;
insert into public.dedicaces (artiste_id, lieu_id, debut, fin)
select 'ba' || (g * 4), 'bl1', timestamptz '2026-11-26 17:00+01' + (g % 4) * interval '1 day' + (g / 4) * interval '10 minutes',
       timestamptz '2026-11-26 17:10+01' + (g % 4) * interval '1 day' + (g / 4) * interval '10 minutes'
from generate_series(1, 20) g;

set role anon;
do $$
declare t0 timestamptz; i int; v json; v_code text := current_setting('banc.code');
begin
  -- 12 favoris pour le joueur
  for v in select json_build_object('id', c.id) from public.creneaux c
           where c.artiste_id like 'ba%' order by c.debut limit 12 loop
    perform public.programme_basculer_favori(v_code, (v->>'id')::uuid);
  end loop;

  v := public.programme_public();
  raise notice 'TAILLE : programme_public % Ko (% concerts, % artistes, % lieux)',
    round(octet_length(v::text) / 1024.0, 1), json_array_length(v->'creneaux'),
    json_array_length(v->'artistes'), json_array_length(v->'lieux');

  t0 := clock_timestamp();
  for i in 1..100 loop v := public.programme_public(); end loop;
  raise notice 'COÛT : programme_public % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2);

  t0 := clock_timestamp();
  for i in 1..200 loop v := public.programme_favoris(v_code); end loop;
  raise notice 'COÛT : programme_favoris % ms (% favoris)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2),
    json_array_length(v->'favoris');
end $$;
reset role;

select 'PROGRAMME JOUEUR : OK';
