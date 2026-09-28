-- ----------------------------------------------------------------------------
-- Collection (étape 4.5) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Quatre rayons : badges, artistes vus, stands tamponnés, reliques trouvées.
-- La player_collection d'Otaku (boss, cosplayers, reliques) est remplacée en
-- entier ; le générateur ne reprend pas son corps.
--
--   artiste vu   = QR de sa scène scanné PENDANT son concert (scans.creneau_id,
--                  noté par scan_qr), ou QR de sa séance de dédicaces ;
--   stand        = lieu « stand » ou « food » qui a un QR, scanné au moins une fois ;
--   relique      = QR de type « relique ». Tant qu'elle n'est pas trouvée, le
--                  joueur ne voit que sa rareté et son indice (ni nom ni code) ;
--   badge secret = nom et icône cachés tant qu'il n'est pas gagné (le texte
--                  est une devinette, il reste visible).
-- Une seule requête par joueur ; pas de ligne « player » (la page n'en a pas
-- besoin, le statut est surveillé ailleurs). Sert aussi au passeport (4.6).
-- ----------------------------------------------------------------------------

alter table public.scans add constraint scans_creneau_id_fkey
  foreign key (creneau_id) references public.creneaux(id) on update cascade;
create index scans_creneau_idx on public.scans (creneau_id) where creneau_id is not null;

create or replace function public.player_collection(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_joueurs numeric;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  select greatest(count(*), 1) into v_joueurs from public.players;

  return json_build_object(
    -- Étape 4.6 (passeport) : « 312ᵉ sur 1 800 », « présent 3 jours sur 4 »,
    -- missions terminées sur tout le festival (une mission refaite un autre
    -- jour compte à nouveau : quest_progress est par journée).
    'joueurs', v_joueurs,
    'jours_presents', (select count(distinct day) from public.scans where player_id = v_player.id),
    'missions', (select count(*) from public.quest_progress
                 where player_id = v_player.id and completed_at is not null),

    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id,
        'nom',   case when b.secret and pb.earned_at is null then null else b.name end,
        'icone', case when b.secret and pb.earned_at is null then null else b.icon end,
        'texte', b.description, 'rarete', b.rarete, 'forme', b.forme,
        'secret', b.secret, 'lien', b.lien,
        'pct', round(100 * coalesce(n.nb, 0) / v_joueurs),
        'obtenu', pb.earned_at)
        -- 01_reference crée tous les badges dans la même seconde : rareté, puis nom
        order by b.created_at, array_position(array['commun','rare','epique','legendaire'], b.rarete), b.name)
      from public.badges b
      left join public.player_badges pb on pb.badge_id = b.id and pb.player_id = v_player.id
      left join (select badge_id, count(*) as nb from public.player_badges group by badge_id) n
        on n.badge_id = b.id
    ), '[]'::json),

    -- Le concert affiché : le prochain (ou en cours), sinon le dernier.
    'artistes', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'photo_url', a.photo_url,
        'concert', c.concert,
        'vu', least(v.vu, d.vu), 'dedicace', (d.vu is not null)) order by c.debut, a.nom)
      from public.artistes a
      cross join lateral (
        select cr.debut, json_build_object('debut', cr.debut,
                 'scene', json_build_object('id', s.id, 'nom', l.nom, 'couleur', s.couleur)) as concert
        from public.creneaux cr
        join public.scenes s on s.id = cr.scene_id
        join public.lieux l on l.id = s.id
        where cr.artiste_id = a.id
        order by (cr.fin <= now()), case when cr.fin > now() then cr.debut end, cr.debut desc
        limit 1) c
      left join lateral (
        select min(sc.scanned_at) as vu
        from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
        where sc.player_id = v_player.id and cr.artiste_id = a.id) v on true
      left join lateral (
        select min(sc.scanned_at) as vu
        from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
        where sc.player_id = v_player.id and de.artiste_id = a.id) d on true
      where a.actif
    ), '[]'::json),

    'stands', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'nom', l.nom, 'categorie', l.categorie, 'zone', l.description,
        'vu', (select min(sc.scanned_at) from public.scans sc
               where sc.player_id = v_player.id and sc.qr_code_id = l.qr_code_id))
        order by l.ordre, l.nom)
      from public.lieux l
      where l.actif and l.categorie in ('stand', 'food') and l.qr_code_id is not null
    ), '[]'::json),

    -- Une relique éteinte reste dans la collection de ceux qui l'ont trouvée.
    'reliques', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'rarete', q.rarity, 'indice', q.hint,
        'nom', case when t.vu is not null then q.label end,
        'vu', t.vu) order by q.created_at)
      from public.qr_codes q
      left join lateral (
        select min(sc.scanned_at) as vu from public.scans sc
        where sc.player_id = v_player.id and sc.qr_code_id = q.id) t on true
      where q.type = 'relique' and (q.active or t.vu is not null)
    ), '[]'::json)
  );
end;
$function$;

grant execute on function public.player_collection(p_secret_code text) to anon, authenticated;
