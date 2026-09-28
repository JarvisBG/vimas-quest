-- ----------------------------------------------------------------------------
-- Programme et plan du festival (étape 2.6) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Écrit à la main (pas d'équivalent Otaku) ; inséré tel quel dans 00_schema.sql
-- par outils/fabriquer_schema.py.
--
--   lieux              tout ce qui figure sur le plan (scènes, stands, eau…)
--   scenes             les lieux de catégorie « scene », avec leur couleur
--   artistes           fiche artiste ; actif = false tant qu'il n'est pas annoncé
--   creneaux           un concert = un artiste, une scène, un début, une fin
--   dedicaces          séances de dédicaces
--   favoris_programme  « mon programme » d'un joueur (par créneau)
--
-- Identifiants lisibles (« soleil », « st-kora », « nova-kassa ») pour les lieux
-- et les artistes : ils servent dans les liens et pèsent peu sur le réseau.
-- Heures en timestamptz : un concert de 0 h 30 appartient à la journée de jeu
-- de la veille (public.jour_de).
-- Lecture publique de ce qui est annoncé ; écriture réservée au staff.
-- Les favoris ne se lisent et ne s'écrivent que par les fonctions joueur.
-- ----------------------------------------------------------------------------

-- Empêche deux concerts de se chevaucher sur une même scène.
create extension if not exists btree_gist with schema extensions;

create table public.lieux (
  id          text primary key
              constraint lieux_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 40),
  categorie   text not null
              constraint lieux_categorie check (categorie in
                ('scene','stand','food','eau','toilettes','secours','abri','service','entree')),
  nom         text not null constraint lieux_nom check (length(trim(nom)) between 1 and 80),
  description text,
  horaires    text,
  x           integer,              -- position sur le plan dessiné (unités du plan)
  y           integer,
  pmr         boolean,              -- null = non renseigné
  qr_code_id  uuid references public.qr_codes(id) on delete set null,
  ordre       integer not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint lieux_id_categorie unique (id, categorie)
);

create table public.scenes (
  id         text primary key,
  -- Une scène est forcément un lieu de catégorie « scene » (clé composée).
  categorie  text not null default 'scene' constraint scenes_categorie check (categorie = 'scene'),
  couleur    text not null default 'nuit'
             constraint scenes_couleur check (couleur in ('sodium','vert','rose','bleu','nuit','rouge','papier')),
  ordre      integer not null default 0,
  constraint scenes_lieu_fk foreign key (id, categorie)
    references public.lieux(id, categorie) on update cascade on delete cascade
);

create table public.artistes (
  id           text primary key
               constraint artistes_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 60),
  nom          text not null constraint artistes_nom check (length(trim(nom)) between 1 and 80),
  genre        text,
  bio          text,
  photo_url    text,                -- droit à l'image : à vérifier avant publication
  tete_affiche boolean not null default false,
  actif        boolean not null default true,   -- false : pas encore annoncé
  created_at   timestamptz not null default now()
);

create table public.creneaux (
  id         uuid primary key default gen_random_uuid(),
  artiste_id text not null references public.artistes(id) on update cascade on delete cascade,
  scene_id   text not null references public.scenes(id) on update cascade,
  debut      timestamptz not null,
  fin        timestamptz not null,
  created_at timestamptz not null default now(),
  constraint creneaux_duree check (fin > debut and fin <= debut + interval '12 hours'),
  constraint creneaux_sans_chevauchement exclude using gist (
    scene_id extensions.gist_text_ops with =,
    tstzrange(debut, fin) with &&)
);
create index creneaux_debut_idx on public.creneaux (debut);
create index creneaux_artiste_idx on public.creneaux (artiste_id);

create table public.dedicaces (
  id         uuid primary key default gen_random_uuid(),
  artiste_id text not null references public.artistes(id) on update cascade on delete cascade,
  lieu_id    text references public.lieux(id) on update cascade on delete set null,
  debut      timestamptz not null,
  fin        timestamptz not null,
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dedicaces_duree check (fin > debut and fin <= debut + interval '12 hours')
);
create index dedicaces_artiste_idx on public.dedicaces (artiste_id);

create table public.favoris_programme (
  player_id  uuid not null references public.players(id) on delete cascade,
  creneau_id uuid not null references public.creneaux(id) on delete cascade,
  rappel     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (player_id, creneau_id)
);
create index favoris_programme_creneau_idx on public.favoris_programme (creneau_id);

-- --- Sécurité ----------------------------------------------------------------
ALTER table public.lieux enable row level security;
ALTER table public.scenes enable row level security;
ALTER table public.artistes enable row level security;
ALTER table public.creneaux enable row level security;
ALTER table public.dedicaces enable row level security;
ALTER table public.favoris_programme enable row level security;

CREATE policy "lecture publique" on public.lieux for select to public using (actif);
CREATE policy "lecture publique" on public.scenes for select to public using (true);
CREATE policy "lecture publique" on public.artistes for select to public using (actif);
CREATE policy "lecture publique" on public.creneaux for select to public
  using (exists (select 1 from public.artistes a where a.id = artiste_id and a.actif));
CREATE policy "lecture publique" on public.dedicaces for select to public
  using (exists (select 1 from public.artistes a where a.id = artiste_id and a.actif));

CREATE policy "ecriture staff" on public.lieux for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.scenes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.artistes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.creneaux for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.dedicaces for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- favoris_programme : aucune politique, tout passe par les fonctions ci-dessous.

-- --- Fonctions ----------------------------------------------------------------

-- Tout le programme en UNE requête (réseau du festival saturé).
-- SECURITY INVOKER : les politiques ci-dessus filtrent ce qui n'est pas annoncé.
create or replace function public.programme_public()
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'lieux', coalesce((select json_agg(json_build_object(
        'id', l.id, 'categorie', l.categorie, 'nom', l.nom, 'description', l.description,
        'horaires', l.horaires, 'x', l.x, 'y', l.y, 'pmr', l.pmr, 'qr_code_id', l.qr_code_id)
        order by l.categorie, l.ordre, l.nom) from public.lieux l), '[]'::json),
    'scenes', coalesce((select json_agg(json_build_object(
        'id', s.id, 'nom', l.nom, 'couleur', s.couleur)
        order by s.ordre, l.nom)
        from public.scenes s join public.lieux l on l.id = s.id), '[]'::json),
    'artistes', coalesce((select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'bio', a.bio,
        'photo_url', a.photo_url, 'tete_affiche', a.tete_affiche)
        order by a.nom) from public.artistes a), '[]'::json),
    'creneaux', coalesce((select json_agg(json_build_object(
        'id', c.id, 'artiste_id', c.artiste_id, 'scene_id', c.scene_id,
        'debut', c.debut, 'fin', c.fin, 'jour', public.jour_de(c.debut))
        order by c.debut) from public.creneaux c), '[]'::json),
    'dedicaces', coalesce((select json_agg(json_build_object(
        'id', d.id, 'artiste_id', d.artiste_id, 'lieu_id', d.lieu_id,
        'debut', d.debut, 'fin', d.fin, 'jour', public.jour_de(d.debut))
        order by d.debut) from public.dedicaces d), '[]'::json)
  );
$function$;

-- Ce que le programme affiche en plus pour un joueur, en UN appel (étape 4.12) :
--   favoris  concerts de son programme et rappel de chacun
--   vus      artistes vus (même règle que player_collection : scène scannée
--            pendant un de ses concerts, ou QR de sa dédicace)
--   genre    style préféré (profil), pour les suggestions de « mon programme »
create or replace function public.programme_favoris(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player_id uuid;
begin
  select s.player_id into v_player_id
  from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_player_id is null then raise exception 'SESSION_INVALIDE'; end if;

  return json_build_object(
    'favoris', coalesce((
      select json_agg(json_build_object('creneau_id', f.creneau_id, 'rappel', f.rappel)
                      order by c.debut)
      from public.favoris_programme f
      join public.creneaux c on c.id = f.creneau_id
      join public.artistes a on a.id = c.artiste_id and a.actif
      where f.player_id = v_player_id), '[]'::json),
    'vus', coalesce((
      select json_agg(distinct v.artiste_id)
      from (
        select cr.artiste_id
        from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
        where sc.player_id = v_player_id
        union
        select de.artiste_id
        from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
        where sc.player_id = v_player_id
      ) v
      join public.artistes a on a.id = v.artiste_id and a.actif), '[]'::json),
    'genre', (select pp.genre_prefere from public.player_profile pp where pp.player_id = v_player_id));
end;
$function$;

-- Ajoute ou retire un concert du programme du joueur.
-- Renvoie les favoris qui chevauchent le concert ajouté (alerte « conflit »).
create or replace function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_creneau public.creneaux%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select c.* into v_creneau
  from public.creneaux c
  join public.artistes a on a.id = c.artiste_id and a.actif
  where c.id = p_creneau_id;
  if v_creneau.id is null then raise exception 'CRENEAU_INCONNU'; end if;

  delete from public.favoris_programme
  where player_id = v_player.id and creneau_id = p_creneau_id;
  if found then
    return json_build_object('favori', false, 'chevauchements', '[]'::json);
  end if;

  if (select count(*) from public.favoris_programme where player_id = v_player.id) >= 200 then
    raise exception 'TROP_DE_FAVORIS';
  end if;

  insert into public.favoris_programme (player_id, creneau_id)
  values (v_player.id, p_creneau_id);

  return json_build_object(
    'favori', true,
    'chevauchements', coalesce((
      select json_agg(c.id order by c.debut)
      from public.favoris_programme f
      join public.creneaux c on c.id = f.creneau_id
      where f.player_id = v_player.id
        and c.id <> v_creneau.id
        and c.debut < v_creneau.fin and v_creneau.debut < c.fin), '[]'::json));
end;
$function$;

-- Active ou coupe le rappel d'un concert du programme.
create or replace function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player_id uuid;
begin
  select s.player_id into v_player_id
  from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_player_id is null then raise exception 'SESSION_INVALIDE'; end if;
  if p_rappel is null then raise exception 'VALEUR_INVALIDE'; end if;

  update public.favoris_programme set rappel = p_rappel
  where player_id = v_player_id and creneau_id = p_creneau_id;
  if not found then raise exception 'PAS_FAVORI'; end if;

  return json_build_object('creneau_id', p_creneau_id, 'rappel', p_rappel);
end;
$function$;

-- Nombre de joueurs qui ont mis chaque concert annoncé dans leur programme
-- (suggestions « populaires », console). Aucune donnée personnelle.
create or replace function public.programme_popularite()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(json_object_agg(t.creneau_id, t.n), '{}'::json)
  from (
    select f.creneau_id, count(*) as n
    from public.favoris_programme f
    join public.creneaux c on c.id = f.creneau_id
    join public.artistes a on a.id = c.artiste_id and a.actif
    group by f.creneau_id
  ) t;
$function$;

revoke all on function public.programme_public() from public, anon, authenticated;
revoke all on function public.programme_favoris(p_secret_code text) from public, anon, authenticated;
revoke all on function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid) from public, anon, authenticated;
revoke all on function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean) from public, anon, authenticated;
revoke all on function public.programme_popularite() from public, anon, authenticated;
grant execute on function public.programme_public() to anon, authenticated;
grant execute on function public.programme_favoris(p_secret_code text) to anon, authenticated;
grant execute on function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid) to anon, authenticated;
grant execute on function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean) to anon, authenticated;
grant execute on function public.programme_popularite() to anon, authenticated;
