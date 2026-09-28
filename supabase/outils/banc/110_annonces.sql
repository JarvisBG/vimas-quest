-- ============================================================================
-- Banc d'essai LOCAL : les annonces (étape 4.10) — admin_publier_annonce,
-- admin_fermer_annonce, lecture publique des téléphones, alerte de la carte.
-- Se joue APRÈS 100_coeurs.sql.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

delete from public.announcements;
-- 2 000 annonces anciennes (plus de 48 h) : les téléphones ne doivent pas les lire
insert into public.announcements (message, type, created_at)
select 'Ancienne ' || g, 'info', now() - interval '3 days' - make_interval(mins => g) from generate_series(1, 2000) g;
analyze public.announcements;
-- Un joueur pour lire la carte (créé par 100_coeurs.sql)
select set_config('banc.code', (select s.secret_code from public.player_secrets s
  join public.players p on p.id = s.player_id where p.pseudo = 'Coeur_1'), false);

-- La console : le GM publie, le vendeur non
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json;
begin
  v := public.admin_publier_annonce('Risque d''orage vers 23h', ' Abris ouverts près du Dock. ', 'danger', 'meteo',
                                    'plan.html?lieu=abri-1', 'Voir les abris', now() + interval '2 hours');
  assert v->>'message' = 'Abris ouverts près du Dock.' and v->>'categorie' = 'meteo' and v->>'lien' = 'plan.html?lieu=abri-1', 'orage : ' || v::text;
  perform set_config('banc.orage', v->>'id', false);
  v := public.admin_publier_annonce('Défi éclair', 'Scanne le Dock avant 21h.', 'alerte', 'jeu', 'missions.html#m6', 'Voir le défi');
  v := public.admin_publier_annonce(null, 'Point d''eau ouvert.');   -- titre facultatif, catégorie pratique
  assert v->>'categorie' = 'pratique' and v->>'titre' is null, 'sans titre : ' || v::text;
  perform public.admin_create_announcement('Message à l''ancienne (Otaku)', 'info');

  begin perform public.admin_publier_annonce('Pub', 'x', 'info', 'pratique', 'https://arnaque.example/', 'Clique');
    raise exception 'lien extérieur accepté';
  exception when others then assert sqlerrm like '%announcements_lien%', sqlerrm; end;
  begin perform public.admin_publier_annonce('X', 'x', 'info', 'pratique', 'javascript:alert(1)//.html', null);
    raise exception 'lien javascript accepté';
  exception when others then assert sqlerrm like '%announcements_lien%', sqlerrm; end;
  begin perform public.admin_publier_annonce('X', 'x', 'info', 'fete');
    raise exception 'catégorie inventée acceptée';
  exception when others then assert sqlerrm like '%announcements_categorie%', sqlerrm; end;
  begin perform public.admin_publier_annonce('X', 'x', 'info', 'pratique', null, 'Libellé sans lien');
    raise exception 'libellé sans lien accepté';
  exception when others then assert sqlerrm like '%announcements_lien_libelle%', sqlerrm; end;
  begin perform public.admin_publier_annonce('X', 'x', 'info', 'pratique', null, null, now() - interval '1 minute');
    raise exception 'fin passée acceptée';
  exception when others then assert sqlerrm = 'FIN_PASSEE', sqlerrm; end;
  begin perform public.admin_publier_annonce('X', '  ', 'info');
    raise exception 'message vide accepté';
  exception when others then assert sqlerrm = 'MESSAGE_VIDE', sqlerrm; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);
do $$
begin
  begin perform public.admin_publier_annonce('X', 'x'); raise exception 'vendeur publie';
  exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm; end;
  begin perform public.admin_fermer_annonce(current_setting('banc.orage')::uuid); raise exception 'vendeur ferme';
  exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm; end;
end $$;

-- Le téléphone : la requête de App.api.annonces (serveur.js), comme PostgREST
set role anon;
do $$
declare n int; t0 timestamptz; i int; ms numeric;
begin
  select count(*) into n from (
    select id, titre, message, type, categorie, lien, lien_libelle, fin, created_at
    from public.announcements where created_at >= now() - interval '48 hours'
    order by created_at desc limit 30) x;
  assert n = 4, 'annonces récentes : ' || n;
  -- L'alerte de la carte : l'orage (danger, pas encore fini)
  assert public.player_home(current_setting('banc.code'))->'annonce'->>'titre' = 'Risque d''orage vers 23h',
    'alerte carte : ' || coalesce(public.player_home(current_setting('banc.code'))->>'annonce', 'null');
  t0 := clock_timestamp();
  for i in 1..500 loop
    perform count(*) from (select id, titre, message, type, categorie, lien, lien_libelle, fin, created_at
      from public.announcements where created_at >= now() - interval '48 hours' order by created_at desc limit 30) x;
  end loop;
  ms := extract(epoch from clock_timestamp() - t0) * 1000 / 500;
  raise notice 'COÛT sur 2 004 annonces : lecture des téléphones % ms', round(ms, 3);
end $$;

-- Fermer l'orage : il quitte la carte mais reste lisible (« Anciennes »)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json;
begin
  v := public.admin_fermer_annonce(current_setting('banc.orage')::uuid);
  assert (v->>'fin')::timestamptz <= now(), 'fermée : ' || v::text;
  begin perform public.admin_fermer_annonce(current_setting('banc.orage')::uuid); raise exception 'fermée deux fois';
  exception when others then assert sqlerrm = 'ANNONCE_INCONNUE', sqlerrm; end;
end $$;
set role anon;
do $$
begin
  assert public.player_home(current_setting('banc.code'))->'annonce'->>'titre' = 'Défi éclair',
    'la carte passe à l''alerte suivante : ' || coalesce(public.player_home(current_setting('banc.code'))->>'annonce', 'null');
  assert exists (select 1 from public.announcements where id = current_setting('banc.orage')::uuid), 'fermée = toujours lisible';
end $$;
reset role;

select 'ANNONCES : OK';
