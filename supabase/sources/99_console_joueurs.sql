-- ----------------------------------------------------------------------------
-- Console : écran Joueurs (étape 6.2) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- console_joueurs(recherche, filtre, rang, page) : 50 joueurs par page, triés
--   par XP. Remplace admin_liste_joueurs d'Otaku (tous les joueurs d'un coup,
--   5 sous-requêtes et jour_jeu() pour CHAQUE ligne, filtrage à la frappe).
--   Les détails coûteux (actions du jour, journées jouées) ne sont calculés
--   que pour les 50 lignes affichées.
-- console_joueur(id) : toute la fiche en un appel (Otaku : 4 appels).
-- admin_get_reconnect_code : chaque lecture du code est tracée dans
--   console_journal (qui, quand), table sans aucune politique : ni les
--   téléphones ni l'écran géant ne la voient (events est public).
-- admin_award_bonus : de 1 à 5 000 XP, jamais de malus (décision du 18/09) ;
--   le nom de celui qui donne part dans le journal (payload.par).
-- admin_effacer_joueur : GM seul. Le joueur n'est PAS supprimé : son ticket
--   payé repasserait « libre » (tickets.utilise_par → null) et la caisse
--   baisserait. On retire son identité (pseudo anonyme, code secret,
--   téléphone), on anonymise ses messages dans le journal public et le roi
--   du jour ; le reste (scans, réponses, cœurs) devient anonyme.
-- Réservées au staff et au GM (pas aux vendeurs : leur espace, étape 6.7).
-- ----------------------------------------------------------------------------

create table public.console_journal (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  par        uuid,                              -- auth.users (compte staff)
  par_nom    text not null,
  action     text not null,
  joueur_id  uuid references public.players(id) on delete set null,
  detail     jsonb,
  constraint console_journal_action check (action in ('code_lu', 'effacement'))
);
create index console_journal_joueur_idx on public.console_journal (joueur_id, at desc);
-- Aucune politique : lue et écrite seulement par les fonctions ci-dessous.
alter table public.console_journal enable row level security;
revoke all on sequence public.console_journal_id_seq from public, anon, authenticated;

create or replace function public._staff_nom()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select display_name from public.staff where user_id = auth.uid()), 'Équipe');
$function$;

-- ---------------------------------------------------------------------------
-- La liste
-- ---------------------------------------------------------------------------
create or replace function public.console_joueurs(p_recherche text default null, p_filtre text default null,
                                                  p_rang text default null, p_page integer default 0)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour   date := public.jour_jeu();           -- UNE fois (voir _classement)
  v_debut  timestamptz := public._debut_jour_jeu();
  v_mur    boolean := coalesce((select actif from public.billetterie_config where id = 1), false);
  v_filtre text := coalesce(nullif(p_filtre, ''), 'tous');
  v_rang   text := nullif(p_rang, '');
  v_q      text := left(nullif(trim(coalesce(p_recherche, '')), ''), 40);
  v_motif  text;
  v_tel    text;                                -- recherche par numéro (6.3 bis)
  v_page   int := least(greatest(coalesce(p_page, 0), 0), 1000);
  v_par    constant int := 50;
  v_total  int;
  v_lignes json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_filtre not in ('tous', 'actifs', 'exclus', 'ticket', 'sans_ticket', 'joue', 'pas_joue') then
    raise exception 'FILTRE_INVALIDE';
  end if;
  -- « 50% » cherche 50 %, pas « 50 suivi de n'importe quoi »
  v_motif := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  -- « 6 99 12 34 56 » ou « +237 699… » : le joueur qui a perdu son code
  v_tel := regexp_replace(coalesce(v_q, ''), '[^0-9]', '', 'g');
  if left(v_tel, 3) = '237' and length(v_tel) = 12 then v_tel := substr(v_tel, 4); end if;
  if v_tel !~ '^6[0-9]{8}$' then v_tel := null; end if;

  with choisis as (
    select p.id, p.xp, p.created_at
    from public.players p
    where p.efface_le is null
      and (v_q is null or p.pseudo ilike v_motif or p.id::text = lower(v_q)
           or p.id in (select k.player_id from public.player_contact k where k.telephone = v_tel))
      and (v_rang is null or p.rank = v_rang)
      and case v_filtre
            when 'actifs'   then p.status = 'actif'
            when 'exclus'   then p.status = 'exclu'
            when 'joue'     then p.jour = v_jour and p.xp_jour > 0
            when 'pas_joue' then not (p.jour = v_jour and p.xp_jour > 0)
            when 'ticket'   then not v_mur or exists (select 1 from public.tickets k
                                                       where k.utilise_par = p.id and k.jour = v_jour)
            when 'sans_ticket' then v_mur and not exists (select 1 from public.tickets k
                                                           where k.utilise_par = p.id and k.jour = v_jour)
            else true end
  ),
  page as (
    select c.id, count(*) over () as total
    from choisis c
    order by c.xp desc, c.created_at
    limit v_par offset v_page * v_par
  )
  select max(pg.total),
         json_agg(json_build_object(
           'id', p.id, 'pseudo', p.pseudo, 'avatar', p.archetype, 'xp', p.xp, 'jetons', p.jetons,
           'niveau', p.level, 'rang', p.rank, 'statut', p.status, 'inscrit', p.created_at,
           'xp_jour', case when p.jour = v_jour then p.xp_jour else 0 end,
           'ticket_jour', not v_mur or exists (select 1 from public.tickets k
                                                where k.utilise_par = p.id and k.jour = v_jour),
           'actions_jour', (select count(*) from public.events e
                             where e.player_id = p.id and e.created_at >= v_debut),
           -- journée de jeu écrite en clair (jour_de ligne par ligne = lent)
           'jours_joues', (select count(distinct ((e.created_at at time zone 'Africa/Douala') - interval '6 hours')::date)
                            from public.events e where e.player_id = p.id))
           order by p.xp desc, p.created_at)
    into v_total, v_lignes
  from page pg join public.players p on p.id = pg.id;

  -- Page au-delà de la fin : le total reste utile à l'écran
  if v_total is null then
    select count(*) into v_total from (
      select 1 from public.players p
      where p.efface_le is null
        and (v_q is null or p.pseudo ilike v_motif or p.id::text = lower(v_q)
           or p.id in (select k.player_id from public.player_contact k where k.telephone = v_tel))
        and (v_rang is null or p.rank = v_rang)
        and case v_filtre
              when 'actifs'   then p.status = 'actif'
              when 'exclus'   then p.status = 'exclu'
              when 'joue'     then p.jour = v_jour and p.xp_jour > 0
              when 'pas_joue' then not (p.jour = v_jour and p.xp_jour > 0)
              when 'ticket'   then not v_mur or exists (select 1 from public.tickets k
                                                         where k.utilise_par = p.id and k.jour = v_jour)
              when 'sans_ticket' then v_mur and not exists (select 1 from public.tickets k
                                                             where k.utilise_par = p.id and k.jour = v_jour)
              else true end) x;
  end if;

  return json_build_object(
    'jour', v_jour,
    'billetterie', v_mur,
    'page', v_page,
    'par_page', v_par,
    'total', v_total,
    'joueurs', coalesce(v_lignes, '[]'::json),
    'resume', json_build_object(
      'joueurs', (select count(*) from public.players where efface_le is null),
      'exclus',  (select count(*) from public.players where status = 'exclu' and efface_le is null),
      'joue_jour', (select count(*) from public.players
                    where status = 'actif' and jour = v_jour and xp_jour > 0),
      'tickets_jour', (select count(distinct utilise_par) from public.tickets
                       where jour = v_jour and utilise_par is not null)));
end;
$function$;

-- ---------------------------------------------------------------------------
-- La fiche
-- ---------------------------------------------------------------------------
create or replace function public.console_joueur(p_player_id uuid)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour  date := public.jour_jeu();
  v_debut timestamptz := public._debut_jour_jeu();
  v_mur   boolean := coalesce((select actif from public.billetterie_config where id = 1), false);
  v_p     public.players%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_p from public.players where id = p_player_id;
  if v_p.id is null or v_p.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;

  return json_build_object(
    'jour', v_jour,
    'billetterie', v_mur,
    'joueur', json_build_object(
      'id', v_p.id, 'pseudo', v_p.pseudo, 'avatar', v_p.archetype, 'xp', v_p.xp, 'jetons', v_p.jetons,
      'niveau', v_p.level, 'rang', v_p.rank, 'statut', v_p.status, 'inscrit', v_p.created_at,
      'xp_jour', case when v_p.jour = v_jour then v_p.xp_jour else 0 end),
    -- Place au classement général (index players_classement_general_idx)
    'place', case when v_p.status = 'actif' then 1 + (
      select count(*) from public.players q
      where q.status = 'actif' and (q.xp > v_p.xp or (q.xp = v_p.xp and q.created_at < v_p.created_at))) end,
    'ticket_jour', not v_mur or exists (select 1 from public.tickets k
                                         where k.utilise_par = v_p.id and k.jour = v_jour),
    'jours_tickets', (select count(distinct jour) from public.tickets
                      where utilise_par = v_p.id and jour is not null),
    'jours_joues', (select count(distinct ((e.created_at at time zone 'Africa/Douala') - interval '6 hours')::date)
                    from public.events e where e.player_id = v_p.id),
    'actions_jour', (select count(*) from public.events e
                     where e.player_id = v_p.id and e.created_at >= v_debut),
    'genre', (select genre_prefere from public.player_profile where player_id = v_p.id),
    -- Numéro : les 4 derniers chiffres seulement (le joueur dit le sien, le
    -- staff compare) ; recherche par numéro complet dans console_joueurs
    'telephone', (select json_build_object('fin', right(k.telephone, 4), 'domaf', k.consent,
                                           'partenaires', k.partenaires)
                  from public.player_contact k where k.player_id = v_p.id),

    -- Missions validées par le staff : consigne à faire respecter, faite aujourd'hui ?
    'missions', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'titre', q.title, 'consigne', q.description, 'xp', q.xp_reward,
        'categorie', q.categorie, 'badge', b.name, 'validee', qp.completed_at)
        order by q.priorite desc, q.created_at)
      from public.quests q
      left join public.badges b on b.id = q.badge_id
      left join public.quest_progress qp
        on qp.quest_id = q.id and qp.player_id = v_p.id and qp.jour = v_jour
      where q.counter = 'manuel' and q.active), '[]'::json),

    -- Tout le catalogue, possédés en tête : la remise manuelle choisit dedans
    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id, 'nom', b.name, 'icone', b.icon, 'rarete', b.rarete, 'secret', b.secret,
        'systeme', public._is_system_badge(b.name), 'obtenu', pb.earned_at)
        order by pb.earned_at is null, pb.earned_at desc,
                 array_position(array['commun','rare','epique','legendaire'], b.rarete), b.name)
      from public.badges b
      left join public.player_badges pb on pb.badge_id = b.id and pb.player_id = v_p.id), '[]'::json),

    'faits', coalesce((
      select json_agg(json_build_object('type', e.type, 'at', e.created_at, 'message', e.payload->>'message',
                                        'xp', (e.payload->>'xp')::int)
                      order by e.created_at desc)
      from (select type, created_at, payload from public.events
            where player_id = v_p.id and type <> 'level_up'
            order by created_at desc limit 12) e), '[]'::json),

    'codes_lus', coalesce((
      select json_agg(json_build_object('par', j.par_nom, 'at', j.at) order by j.at desc)
      from (select par_nom, at from public.console_journal
            where joueur_id = v_p.id and action = 'code_lu'
            order by at desc limit 5) j), '[]'::json)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Code de reprise : lu à la demande, et chaque lecture est tracée
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_reconnect_code(p_player_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_code text;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select secret_code into v_code from public.player_secrets where player_id = p_player_id;
  if v_code is null then raise exception 'JOUEUR_INCONNU'; end if;
  insert into public.console_journal (par, par_nom, action, joueur_id)
  values (auth.uid(), public._staff_nom(), 'code_lu', p_player_id);
  return v_code;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Bonus : de 1 à 5 000 XP, jamais de malus ; qui donne est écrit
-- ---------------------------------------------------------------------------
create or replace function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player    public.players%rowtype;
  v_old_level int;
  v_par       text := public._staff_nom();
  v_motif     text := left(nullif(trim(coalesce(p_reason, '')), ''), 80);
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  -- L'XP ne baisse jamais (règle d'Otaku, tenue en base depuis le 18/09)
  if p_xp is null or p_xp < 1 or p_xp > 5000 then raise exception 'BONUS_INVALIDE'; end if;

  select * into v_player from public.players where id = p_player_id for update;
  if v_player.id is null or v_player.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;

  v_old_level := public.level_for_xp(v_player.xp);

  -- Porte de secours du GM (REGLES.md §15.4) : le bonus passe sans ticket du
  -- jour. Le « true » limite le drapeau à cette transaction.
  perform set_config('dq.pass_bypass', '1', true);

  update public.players set
    xp     = xp + p_xp,
    jetons = jetons + p_xp / 10,
    level  = public.level_for_xp(xp + p_xp),
    rank   = public.rank_for_level(public.level_for_xp(xp + p_xp))
  where id = p_player_id
  returning * into v_player;

  insert into public.events (type, player_id, payload)
  values ('bonus', p_player_id, jsonb_build_object(
    'message', 'Le Game Master accorde +' || p_xp || ' XP à ' || v_player.pseudo
               || coalesce(' — ' || v_motif, ''),
    'xp', p_xp, 'reason', v_motif, 'par', v_par));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', p_player_id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level', v_player.level, 'old_level', v_old_level));
  end if;

  return row_to_json(v_player);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Effacement au stand (GM seul) : identité retirée, ligne gardée anonyme
-- ---------------------------------------------------------------------------
create or replace function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_p     public.players%rowtype;
  v_anon  text;
  v_motif text;
  v_n     int := 6;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_p from public.players where id = p_player_id for update;
  if v_p.id is null or v_p.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;
  -- Le GM retape le pseudo : on n'efface pas le mauvais joueur d'un clic
  if lower(trim(coalesce(p_confirmation, ''))) <> lower(v_p.pseudo) then
    raise exception 'CONFIRMATION_INVALIDE';
  end if;

  -- Nouveau pseudo : « Effacé-3FA2C1 » (16 caractères au plus, unique)
  loop
    v_anon := 'Effacé-' || upper(left(replace(v_p.id::text, '-', ''), v_n));
    exit when not exists (select 1 from public.players where lower(pseudo) = lower(v_anon));
    v_n := v_n + 1;
  end loop;

  -- Le pseudo dans les messages publics du journal, seulement en mot entier
  -- (« Al » ne doit pas abîmer « Alpha »)
  v_motif := '(^|[^[:alnum:]_])'
          || regexp_replace(v_p.pseudo, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
          || '($|[^[:alnum:]_])';
  update public.events
     set payload = jsonb_set(payload, '{message}',
                             to_jsonb(regexp_replace(payload->>'message', v_motif, '\1Un joueur\2', 'g')))
   where player_id = p_player_id and payload ? 'message';

  update public.tournament_kings set pseudo = v_anon where pseudo = v_p.pseudo;

  delete from public.player_secrets where player_id = p_player_id;   -- plus de reprise possible
  delete from public.player_contact where player_id = p_player_id;   -- numéro de téléphone

  update public.players
     set pseudo = v_anon, status = 'exclu', efface_le = now()
   where id = p_player_id;

  insert into public.console_journal (par, par_nom, action, joueur_id, detail)
  values (auth.uid(), public._staff_nom(), 'effacement', p_player_id,
          jsonb_build_object('xp', v_p.xp, 'inscrit', v_p.created_at));

  return json_build_object('pseudo', v_anon);
end;
$function$;

revoke all on function public._staff_nom() from public, anon, authenticated;
revoke all on function public.console_joueurs(p_recherche text, p_filtre text, p_rang text, p_page integer) from public, anon, authenticated;
grant execute on function public.console_joueurs(p_recherche text, p_filtre text, p_rang text, p_page integer) to authenticated;
revoke all on function public.console_joueur(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.console_joueur(p_player_id uuid) to authenticated;
revoke all on function public.admin_get_reconnect_code(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.admin_get_reconnect_code(p_player_id uuid) to authenticated;
revoke all on function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text) from public, anon, authenticated;
grant execute on function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text) to authenticated;
revoke all on function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text) from public, anon, authenticated;
grant execute on function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text) to authenticated;
