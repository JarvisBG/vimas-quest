-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.3) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- scan_qr (copiée de 00_schema.sql) renvoie en plus « quetes » : pour chaque
-- mission que le scan fait avancer, titre, avancée, objectif, XP, terminée.
-- Une mission secrète n'y figure qu'une fois terminée.
-- Les droits ne changent pas (même signature). Rejouable.
-- ============================================================================
begin;

create or replace function public.scan_qr(p_secret_code text, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player   public.players%rowtype;
  v_qr       public.qr_codes%rowtype;
  v_phase    text;
  v_total_xp int := 0;
  v_badge    text;
  v_new_badges text[] := '{}';
  v_completed  text[] := '{}';
  v_old_level int;
  v_count    int;
  v_prog     int;
  v_deja_collection boolean;
  v_quetes   json[] := '{}';
  r          record;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  -- REGLES.md §6 : en RAID les quêtes standard sont verrouillées,
  -- en CLOTURE le jeu est figé. La bannière du téléphone prévient,
  -- ICI on refuse vraiment (anti-triche).
  select phase into v_phase from public.game_state where id = 1;
  if v_phase = 'RAID'    then raise exception 'PHASE_RAID';    end if;
  if v_phase = 'CLOTURE' then raise exception 'PHASE_CLOTURE'; end if;

  select * into v_qr from public.qr_codes where code = upper(trim(p_code));
  if v_qr.id is null then raise exception 'QR_INCONNU'; end if;
  if not v_qr.active then raise exception 'QR_INACTIF'; end if;

  -- (a) G2 : plus d'exception de type, tout se rejoue chaque jour.
  perform 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id and day = public.jour_jeu();
  if found then raise exception 'DEJA_SCANNE'; end if;

  -- (b) G6 : ce QR avait-il déjà été trouvé un jour précédent ?
  select exists(
    select 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id
  ) into v_deja_collection;

  insert into public.scans (player_id, qr_code_id) values (v_player.id, v_qr.id);
  v_total_xp := v_qr.xp_reward;

  if v_qr.badge_id is not null then
    v_badge := public._award_badge(v_player.id, v_player.pseudo,
                 (select name from public.badges where id = v_qr.badge_id));
    v_new_badges := array_append(v_new_badges, v_badge);
  end if;

  -- Badges DOMAF attribués par le scan (liste = _is_system_badge).
  select count(*) into v_count from public.scans where player_id = v_player.id;
  if v_count = 1 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Première note'));
  end if;

  if v_qr.type in ('cache', 'dedicace') then
    select count(distinct s.qr_code_id) into v_count
    from public.scans s join public.qr_codes q on q.id = s.qr_code_id
    where s.player_id = v_player.id and q.type = v_qr.type;
    if v_count = 1 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo,
          case v_qr.type when 'cache' then 'Fouineur' else 'Autographe' end));
    end if;
  elsif v_qr.type = 'stand' then
    select count(distinct s.qr_code_id) into v_count
    from public.scans s join public.qr_codes q on q.id = s.qr_code_id
    where s.player_id = v_player.id and q.type = 'stand';
    if v_count = 5 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo, 'Curieux'));
    end if;
  end if;

  -- (c) G3 : progression du jour, par type de scan OU quête précise.
  for r in
    select * from public.quests
    where active = true
      and (counter in ('scan_any', 'scan_' || v_qr.type) or id = v_qr.quest_id)
  loop
    v_prog := null;
    insert into public.quest_progress (player_id, quest_id, progress, jour)
    values (v_player.id, r.id, 1, public.jour_jeu())
    on conflict (player_id, quest_id, jour) do update
      set progress = quest_progress.progress + 1
      where quest_progress.completed_at is null
    returning progress into v_prog;

    if v_prog is not null and (r.type <> 'secrete' or v_prog >= r.goal_count) then
      v_quetes := v_quetes || json_build_object(
        'titre', r.title, 'fait', least(v_prog, r.goal_count), 'objectif', r.goal_count,
        'xp', r.xp_reward, 'terminee', v_prog >= r.goal_count);
    end if;

    if v_prog is not null and v_prog >= r.goal_count then
      update public.quest_progress set completed_at = now()
      where player_id = v_player.id and quest_id = r.id and jour = public.jour_jeu() and completed_at is null;
      if found then
        v_total_xp  := v_total_xp + r.xp_reward;
        v_completed := array_append(v_completed, r.title);
        insert into public.events (type, player_id, payload)
        values ('quete', v_player.id, jsonb_build_object(
          'message', v_player.pseudo || ' a terminé la mission « ' || r.title || ' » (+' || r.xp_reward || ' XP)',
          'quest', r.title, 'xp', r.xp_reward));
        if r.badge_id is not null then
          v_new_badges := array_append(v_new_badges,
            public._award_badge(v_player.id, v_player.pseudo,
              (select name from public.badges where id = r.badge_id)));
        end if;
      end if;
    end if;
  end loop;

  v_old_level := public.level_for_xp(v_player.xp);
  update public.players
  set xp     = xp + v_total_xp,
      jetons = jetons + (v_total_xp / 10),
      level  = public.level_for_xp(xp + v_total_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_total_xp))
  where id = v_player.id
  returning * into v_player;

  insert into public.events (type, player_id, payload)
  values ('scan', v_player.id, jsonb_build_object(
    'message',  v_player.pseudo || ' a trouvé « ' || v_qr.label || ' » (+' || v_qr.xp_reward || ' XP)',
    'label',    v_qr.label, 'qr_type', v_qr.type, 'xp', v_qr.xp_reward,
    'character', v_qr.character_name, 'anime', v_qr.anime, 'rarity', v_qr.rarity));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', v_player.id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level',   v_player.level, 'old_level', v_old_level));
  end if;

  return json_build_object(
    'qr', json_build_object(
      'label', v_qr.label, 'type', v_qr.type, 'rarity', v_qr.rarity,
      'character_name', v_qr.character_name, 'anime', v_qr.anime, 'hint', v_qr.hint),
    'xp_gagne', v_total_xp, 'jetons_gagnes', v_total_xp / 10,
    'deja_collection', v_deja_collection, 'jour_label', public.jour_festival_label(),
    'nouveaux_badges', to_json(array_remove(v_new_badges, null)),
    'quetes_terminees', to_json(v_completed),
    'quetes', to_json(v_quetes),
    'niveau_precedent', v_old_level, 'nouveau_niveau', v_player.level,
    'player', row_to_json(v_player));
end;
$function$
;

commit;
