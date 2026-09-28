-- ============================================================================
-- Banc d'essai LOCAL : l'écran Joueurs de la console (étape 6.2) —
-- console_joueurs (liste paginée), console_joueur (fiche), code de reprise
-- tracé, bonus sans malus, effacement au stand ; droits et coût.
-- Se joue APRÈS 180_console.sql (5 000 joueurs, 200 000 événements).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Un membre du staff qui n'est pas GM
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a003', 'lea@test.local')
  on conflict do nothing;
insert into public.staff (user_id, display_name, role)
  values ('00000000-0000-0000-0000-00000000a003', 'Léa', 'staff') on conflict do nothing;

-- Le joueur à effacer : pseudo court, ticket payé, roi d'un jour, un message
-- où son pseudo apparaît aussi DANS un mot (« Zoom »)
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp table t_zo as select public.create_player('Zo', 'soleil') as v;
reset role;
grant select on t_zo to anon, authenticated;
insert into public.carnets (id, numero, vendeur_nom, nb_tickets)
  values ('00000000-0000-0000-0000-0000000c6a01', 998, 'Banc 6.2', 1);
insert into public.tickets (carnet_id, code, rang, utilise_par, utilise_le, jour)
select '00000000-0000-0000-0000-0000000c6a01', 'TKTZO001', 1, (v->'player'->>'id')::uuid, now(), public.jour_jeu()
  from t_zo;
insert into public.events (type, player_id, payload)
select 'quete', (v->'player'->>'id')::uuid,
       '{"message": "Zo a terminé la mission « Zoom sur Zo » (+60 XP)", "xp": 60}'::jsonb from t_zo;
insert into public.player_contact (player_id, telephone, consent)
select (v->'player'->>'id')::uuid, '+237600000000', true from t_zo;
insert into public.tournament_kings (jour, pseudo, points) values (public.jour_jeu() - 3, 'Zo', 1234);
-- La mission staff du scénario a été désactivée par un banc précédent
update public.quests set active = true where title = 'Aide un bénévole';

-- --- Droits -----------------------------------------------------------------
set role anon;
do $$ begin
  perform public.console_joueurs();
  raise exception 'anonyme accepté (liste)';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.admin_effacer_joueur((select (z.v->'player'->>'id')::uuid from t_zo z), 'Zo');
  raise exception 'anonyme accepté (effacement)';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);   -- le vendeur
do $$
declare f text;
begin
  foreach f in array array['console_joueurs()', 'console_joueur(''00000000-0000-0000-0000-0000000e0001'')',
                           'admin_get_reconnect_code(''00000000-0000-0000-0000-0000000e0001'')'] loop
    begin
      execute 'select public.' || f;
      raise exception 'vendeur accepté : %', f;
    exception when raise_exception then
      assert sqlerrm = 'ACCES_REFUSE', f || ' : ' || sqlerrm;
    end;
  end loop;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', false);   -- Léa, staff
do $$
declare v_id uuid := (select (z.v->'player'->>'id')::uuid from t_zo z);
begin
  perform public.console_joueurs();                         -- le staff voit la liste
  perform public.admin_effacer_joueur(v_id, 'Zo');
  raise exception 'staff accepté pour un effacement';
exception when raise_exception then
  assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;

-- --- La liste ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);   -- le GM
do $$
declare v json; v2 json; n int; t text;
begin
  v := public.console_joueurs();
  assert json_array_length(v->'joueurs') = 50, 'page de 50 : ' || json_array_length(v->'joueurs');
  assert (v->>'total')::int = (select count(*) from public.players where efface_le is null), 'total';
  assert (v->'joueurs'->0->>'xp')::int >= (v->'joueurs'->49->>'xp')::int, 'tri par XP';
  assert (v->'joueurs'->0->>'xp')::int = (select max(xp) from public.players), 'premier = plus d''XP';
  assert v->'joueurs'->0->>'jours_joues' is not null and v->'joueurs'->0->>'actions_jour' is not null
     and v->'joueurs'->0->>'ticket_jour' is not null, 'colonnes';

  v2 := public.console_joueurs(null, null, null, 1);
  assert v2->'joueurs'->0->>'id' <> v->'joueurs'->0->>'id', 'page 2';
  assert (v2->'joueurs'->0->>'xp')::int <= (v->'joueurs'->49->>'xp')::int, 'page 2 après page 1';

  v := public.console_joueurs(null, null, null, 999);
  assert json_array_length(v->'joueurs') = 0 and (v->>'total')::int > 0, 'au-delà de la fin : ' || (v->>'total');

  -- Recherche : partielle, sans casse, par identifiant ; « % » pris à la lettre
  v := public.console_joueurs('murroi');
  assert exists (select 1 from json_array_elements(v->'joueurs') j where j->>'pseudo' = 'MurRoi'), 'recherche';
  v := public.console_joueurs('00000000-0000-0000-0000-0000000E0001');
  assert (v->>'total')::int = 1 and v->'joueurs'->0->>'pseudo' = 'MurRoi', 'par identifiant';
  v := public.console_joueurs('%');
  assert (v->>'total')::int = (select count(*) from public.players where pseudo like '%\%%'), '% à la lettre';

  -- Filtres
  v := public.console_joueurs(null, 'exclus');
  assert (v->>'total')::int = (select count(*) from public.players where status = 'exclu' and efface_le is null), 'exclus';
  assert not exists (select 1 from json_array_elements(v->'joueurs') j where j->>'statut' <> 'exclu'), 'que des exclus';
  v := public.console_joueurs(null, 'joue');
  assert (v->>'total')::int = (v->'resume'->>'joue_jour')::int
     + (select count(*) from public.players where status = 'exclu' and efface_le is null
         and jour = public.jour_jeu() and xp_jour > 0), 'ont joué';
  n := (public.console_joueurs(null, 'ticket')->>'total')::int + (public.console_joueurs(null, 'sans_ticket')->>'total')::int;
  assert n = (public.console_joueurs()->>'total')::int, 'ticket + sans ticket = tous';
  v := public.console_joueurs(null, null, 'Fan');
  assert not exists (select 1 from json_array_elements(v->'joueurs') j where j->>'rang' <> 'Fan'), 'rang';
  begin
    perform public.console_joueurs(null, 'nimporte');
    raise exception 'filtre inconnu accepté';
  exception when raise_exception then assert sqlerrm = 'FILTRE_INVALIDE', sqlerrm;
  end;
end $$;

-- --- La fiche, le code, le bonus --------------------------------------------
do $$
declare v json; v_id uuid := (select (z.v->'player'->>'id')::uuid from t_zo z); c text; t text;
begin
  v := public.console_joueur('00000000-0000-0000-0000-0000000e0001');
  assert v->'joueur'->>'pseudo' = 'MurRoi' and (v->>'place')::int >= 1, 'fiche : ' || (v->'joueur')::text;
  assert json_array_length(v->'badges') = (select count(*) from public.badges), 'catalogue des badges';
  assert exists (select 1 from json_array_elements(v->'missions') m where m->>'titre' = 'Aide un bénévole'), 'missions staff';
  assert json_array_length(v->'faits') <= 12, 'faits';

  -- Code de reprise : lu, et tracé (qui, pour qui)
  c := public.admin_get_reconnect_code(v_id);
  assert c = (select z.v->>'secret_code' from t_zo z), 'code';
  v := public.console_joueur(v_id);
  assert json_array_length(v->'codes_lus') = 1 and v->'codes_lus'->0->>'par' = 'GM', 'trace : ' || (v->'codes_lus')::text;
  assert (v->>'ticket_jour')::boolean and (v->>'jours_tickets')::int = 1, 'ticket du jour';

  -- Bonus : jamais de malus, 5 000 au plus, le donneur écrit
  foreach t in array array['-5', '0', '5001'] loop
    begin
      perform public.admin_award_bonus(v_id, t::int, 'essai');
      raise exception 'bonus % accepté', t;
    exception when raise_exception then assert sqlerrm = 'BONUS_INVALIDE', t || ' : ' || sqlerrm;
    end;
  end loop;
  v := public.admin_award_bonus(v_id, 100, '  Danse  ');
  assert (v->>'xp')::int = 100 and (v->>'jetons')::int = 10, 'bonus : ' || v::text;
  assert (select payload->>'par' = 'GM' and payload->>'reason' = 'Danse' from public.events
           where player_id = v_id and type = 'bonus' order by created_at desc limit 1), 'par / motif';
end $$;

-- --- Effacement --------------------------------------------------------------
do $$
declare v json; v_id uuid := (select (z.v->'player'->>'id')::uuid from t_zo z); v_code text := (select z.v->>'secret_code' from t_zo z);
        v_anon text;
begin
  begin
    perform public.admin_effacer_joueur(v_id, 'Zoe');
    raise exception 'mauvaise confirmation acceptée';
  exception when raise_exception then assert sqlerrm = 'CONFIRMATION_INVALIDE', sqlerrm;
  end;

  v := public.admin_effacer_joueur(v_id, ' zo ');
  v_anon := v->>'pseudo';
  -- Vérifications dans les tables : hors rôle (secrets, tickets, journal n'ont
  -- aucune politique de lecture)
  reset role;
  assert v_anon like 'Effacé-%' and char_length(v_anon) <= 16, 'pseudo anonyme : ' || v_anon;
  assert (select status = 'exclu' and efface_le is not null and pseudo = v_anon from public.players where id = v_id), 'ligne anonyme';
  assert not exists (select 1 from public.player_secrets where player_id = v_id), 'code supprimé';
  assert not exists (select 1 from public.player_contact where player_id = v_id), 'téléphone supprimé';
  -- Le ticket payé reste payé
  assert (select utilise_par = v_id from public.tickets where code = 'TKTZO001'), 'ticket toujours utilisé';
  -- Journal public : pseudo retiré en mot entier seulement
  assert not exists (select 1 from public.events where player_id = v_id and payload->>'message' ~ '(^|[^[:alnum:]_])Zo($|[^[:alnum:]_])'),
    'pseudo resté dans le journal';
  assert exists (select 1 from public.events where player_id = v_id
                 and payload->>'message' = 'Un joueur a terminé la mission « Zoom sur Un joueur » (+60 XP)'),
    'message : ' || (select string_agg(payload->>'message', ' | ') from public.events where player_id = v_id and type = 'quete');
  assert (select pseudo from public.tournament_kings where jour = public.jour_jeu() - 3) = v_anon, 'roi anonymisé';
  assert (select count(*) from public.console_journal where joueur_id = v_id and action = 'effacement') = 1, 'journal';
  assert (select par_nom = 'GM' and detail->>'xp' is not null from public.console_journal
           where joueur_id = v_id and action = 'effacement'), 'journal : qui';
  assert (select count(*) from public.console_journal where joueur_id = v_id and action = 'code_lu') = 1, 'trace du code gardée';
  set local role authenticated;

  -- Plus rien ne le touche
  assert (public.console_joueurs(v_anon)->>'total')::int = 0, 'absent de la liste';
  begin perform public.console_joueur(v_id); raise exception 'fiche d''un effacé';
  exception when raise_exception then assert sqlerrm = 'JOUEUR_INCONNU', sqlerrm; end;
  begin perform public.admin_set_status(v_id, 'actif'); raise exception 'effacé réintégré';
  exception when raise_exception then assert sqlerrm = 'JOUEUR_INCONNU', sqlerrm; end;
  begin perform public.admin_rename_player(v_id, 'Revenant'); raise exception 'effacé renommé';
  exception when raise_exception then assert sqlerrm = 'JOUEUR_INCONNU', sqlerrm; end;
  begin perform public.admin_award_bonus(v_id, 10); raise exception 'bonus à un effacé';
  exception when raise_exception then assert sqlerrm = 'JOUEUR_INCONNU', sqlerrm; end;
  begin perform public.admin_effacer_joueur(v_id, v_anon); raise exception 'effacé deux fois';
  exception when raise_exception then assert sqlerrm = 'JOUEUR_INCONNU', sqlerrm; end;
  assert (public.console_accueil()->'chiffres'->>'exclus')::int
       = (select count(*) from public.players where status = 'exclu' and efface_le is null), 'exclus du tableau de bord';

  set local role anon;
  begin perform public.login_with_code(v_code); raise exception 'reprise par code après effacement';
  exception when raise_exception then assert sqlerrm <> 'reprise par code après effacement', sqlerrm; end;
end $$;

-- --- Coût : moyenne de 100 appels --------------------------------------------
do $$
declare t0 timestamptz; i int; v json; v_ms numeric;
        -- Comptés avant la mesure : dans un raise, ils sont évalués avant
        -- l'expression de durée et s'ajouteraient au temps de la fonction.
        v_n_joueurs bigint := (select count(*) from public.players);
        v_n_events bigint := (select count(*) from public.events);
begin
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_joueurs(); end loop;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2);
  raise notice 'COÛT sur % joueurs, % événements : console_joueurs % ms (% octets)',
    v_n_joueurs, v_n_events, v_ms, length(v::text);
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_joueurs(null, 'sans_ticket', null, 3); end loop;
  raise notice 'COÛT : console_joueurs(sans ticket, page 4) % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2);
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_joueurs('mur'); end loop;
  raise notice 'COÛT : console_joueurs(recherche) % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2);
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_joueur('00000000-0000-0000-0000-0000000e0001'); end loop;
  raise notice 'COÛT : console_joueur % ms (% octets)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2), length(v::text);
end $$;
reset role;

select 'JOUEURS : OK';
