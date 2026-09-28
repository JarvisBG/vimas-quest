-- ============================================================================
-- Banc d'essai LOCAL : missions (étape 4.4) — catégorie et heure de validation.
-- Se joue APRÈS 50_scanner.sql (réutilise le joueur « Scanneur » et le GM).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

select set_config('banc.code', (select s.secret_code from public.player_secrets s
  join public.players p on p.id = s.player_id where p.pseudo = 'Scanneur'), false) is not null;
select set_config('banc.quete', (select id::text from public.quests where title = 'Tournée des scènes' and active), false) is not null;

-- Le GM range la mission dans une catégorie
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false) is not null;
do $$
declare
  v json;
  m jsonb := '{"titre": "Tournée des scènes", "consigne": "Scanne une scène", "compteur": "scan_scene",
               "objectif": 1, "xp": 40}';
begin
  perform public.console_mission_enregistrer(current_setting('banc.quete')::uuid, m || '{"categorie": " Exploration "}');
  assert (select categorie from public.quests where id = current_setting('banc.quete')::uuid) = 'exploration', 'catégorie';
  begin perform public.console_mission_enregistrer(current_setting('banc.quete')::uuid, m || '{"categorie": "shopping"}');
    raise exception 'catégorie inventée acceptée';
  exception when others then assert sqlerrm = 'CATEGORIE_INVALIDE', sqlerrm; end;
  begin perform public.console_mission_enregistrer(gen_random_uuid(), m || '{"categorie": "musique"}');
    raise exception 'mission inconnue acceptée';
  exception when others then assert sqlerrm = 'QUETE_INCONNUE', sqlerrm; end;
  assert (select count(*) from json_array_elements(public.console_missions()->'missions') q
           where q->>'categorie' = 'exploration') = 1, 'console_missions : catégorie';
end $$;

-- Un compte connecté qui n'est pas du staff : refusé
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0ff', false) is not null;
do $$
begin
  perform public.console_mission_enregistrer(current_setting('banc.quete')::uuid, '{"titre": "Intrus", "xp": 1, "objectif": 1}');
  raise exception 'intrus accepté';
exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;
reset role;

-- Le joueur voit la catégorie et l'heure de validation (mission terminée au banc 50)
set role anon;
do $$
declare q json;
begin
  select x into q from json_array_elements(public.player_home(current_setting('banc.code'))->'quests') x
   where x->>'title' = 'Tournée des scènes';
  assert q->>'categorie' = 'exploration', 'player_home catégorie : ' || q::text;
  assert (q->>'completed')::boolean and q->>'completed_at' is not null, 'heure de validation : ' || q::text;
end $$;
reset role;

select 'MISSIONS : OK';
