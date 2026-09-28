-- ----------------------------------------------------------------------------
-- Mur de l'écran géant (étape 5.1) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- mur_direct() : TOUT le mur en un appel, relu à chaque signal du temps réel
-- (nouvel événement, annonce, phase du jeu), au plus une fois toutes les 5 s.
--   · top      : tournoi du jour (XP gagnés depuis 6 h), 10 premiers, sur
--                l'index players_classement_jour_idx (décision du 18/09 : le
--                mur n'affiche QUE le jour) ; roi_veille à côté ;
--   · compteurs: joueurs actifs, joueurs du jour, scans de la journée de jeu
--                (index scans_jour_idx : Otaku comptait tous les scans) ;
--   · exploits : 8 derniers — relique trouvée, badge (nom caché si secret),
--                mission, objet ou badge gagné à la roue, CHANGEMENT DE RANG
--                (pas chaque niveau). Jamais : scènes, stands, exclusions,
--                phases, profils. Joueurs exclus masqués ;
--   · annonces : 48 h, pas encore finies (fermée = fin passée), 10 au plus.
-- Remplace live_board / leaderboard_view pour le mur (tri ligne par ligne
-- sur _points_jour : 152 ms au banc sur 5 000 joueurs).
-- Publique : rien que l'écran géant ne montre déjà (pseudo, avatar, XP).
-- ----------------------------------------------------------------------------

create index if not exists scans_jour_idx on public.scans (day);
-- Les exploits candidats seulement : les scans de scènes et de stands (le gros
-- du journal) ne sont jamais relus.
create index if not exists events_mur_idx on public.events (created_at desc)
  where type in ('badge', 'quete', 'roulette', 'level_up')
     or (type = 'scan' and payload->>'qr_type' = 'relique');

create or replace function public.mur_direct()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour date := public.jour_jeu();   -- UNE fois (voir _classement)
begin
  return json_build_object(
    'jour',         v_jour,
    'phase',        (select g.phase from public.game_state g where g.id = 1),
    'roi_veille',   public.roi_veille(),
    'joueurs',      (select count(*) from public.players where status = 'actif'),
    'joueurs_jour', (select count(*) from public.players
                     where status = 'actif' and jour = v_jour and xp_jour > 0),
    'scans_jour',   (select count(*) from public.scans where day = v_jour),

    'top', coalesce((
      select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype, 'points', t.xp_jour,
                                        'xp', t.xp, 'place', t.place) order by t.xp_jour desc, t.created_at)
      from (select x.*, (rank() over (order by x.xp_jour desc))::int as place
            from (select pseudo, archetype, xp, xp_jour, created_at from public.players
                  where status = 'actif' and jour = v_jour and xp_jour > 0
                  order by xp_jour desc, created_at limit 10) x) t), '[]'::json),

    'exploits', coalesce((
      select json_agg(json_build_object('id', e.id, 'type', e.genre, 'at', e.created_at,
                                        'pseudo', e.pseudo, 'avatar', e.archetype,
                                        'nom', e.nom, 'detail', e.detail) order by e.created_at desc)
      from (
        select c.id, c.created_at, p.pseudo, p.archetype,
               case c.type when 'scan' then 'relique' when 'quete' then 'mission'
                           when 'roulette' then 'roue' when 'level_up' then 'rang' else c.type end as genre,
               case c.type
                 when 'scan'     then c.payload->>'label'
                 when 'badge'    then case when b.secret then null else c.payload->>'badge' end
                 when 'quete'    then c.payload->>'quest'
                 when 'roulette' then c.payload->>'prize'
                 else public.rank_for_level((c.payload->>'level')::int) end as nom,
               case c.type
                 when 'scan'     then c.payload->>'rarity'
                 when 'badge'    then coalesce(b.rarete, 'commun')
                 when 'quete'    then c.payload->>'xp'
                 when 'roulette' then c.payload->>'kind'
                 else null end as detail
        from (select id, type, payload, created_at, player_id from public.events
              where type in ('badge', 'quete', 'roulette', 'level_up')
                 or (type = 'scan' and payload->>'qr_type' = 'relique')
              order by created_at desc limit 50) c
        join public.players p on p.id = c.player_id and p.status = 'actif'
        left join public.badges b on c.type = 'badge' and b.name = c.payload->>'badge'
        -- Un niveau de plus ne s'affiche que s'il change le rang ('old_level'
        -- manque dans le journal de la roue : un seul niveau d'écart supposé)
        where c.type <> 'level_up'
           or public.rank_for_level((c.payload->>'level')::int)
              <> public.rank_for_level(coalesce((c.payload->>'old_level')::int, (c.payload->>'level')::int - 1))
        order by c.created_at desc limit 8) e), '[]'::json),

    'annonces', coalesce((
      select json_agg(json_build_object('id', a.id, 'titre', a.titre, 'message', a.message, 'type', a.type,
                                        'categorie', a.categorie, 'fin', a.fin, 'created_at', a.created_at)
                      order by a.created_at desc)
      from (select id, titre, message, type, categorie, fin, created_at from public.announcements
            where created_at >= now() - interval '48 hours' and (fin is null or fin > now())
            order by created_at desc limit 10) a), '[]'::json)
  );
end;
$function$;

revoke all on function public.mur_direct() from public, anon, authenticated;
grant execute on function public.mur_direct() to anon, authenticated;
