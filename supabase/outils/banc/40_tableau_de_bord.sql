-- ============================================================================
-- Banc d'essai LOCAL : player_home, la carte du joueur en un appel (étape 4.2).
-- Se joue APRÈS 20_programme.sql (réutilise ses artistes et créneaux).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

update public.billetterie_config set actif = false where id = 1;
update public.game_state set roulette_cost = 30 where id = 1;
-- Une vieille alerte (ignorée), une info récente (ignorée), une alerte récente
insert into public.announcements (message, type, created_at) values
  ('Vieille alerte', 'danger', now() - interval '4 hours'),
  ('Simple info',    'info',   now() - interval '5 minutes'),
  ('Orage : abritez-vous', 'alerte', now() - interval '10 minutes');

set role anon;
do $$
declare
  v json; v_code text; v_c uuid; v_a uuid;
begin
  v := public.create_player('Carte', 'soleil');
  v_code := v->>'secret_code';

  v := public.player_home(v_code);
  assert (v->>'classement_general')::int >= 1, 'classement général';
  assert (v->>'scans_jour')::int = 0, 'scans du jour';
  assert (v->>'roulette_cost')::int = 30, 'coût de la roue';
  assert v->'annonce'->>'message' = 'Orage : abritez-vous', 'annonce : ' || coalesce(v->>'annonce', 'null');
  assert (v->'quests'->0)::jsonb ? 'requires_staff', 'requires_staff dans les missions';

  -- (20_programme.sql a supprimé Nova Kassa : restent Pixel Griot au Dock
  -- à 23 h 30 et sur la scène renommée « grande-scene » à 0 h 30.)
  -- Sans favori : le prochain concert tout court
  assert v->'prochain_concert'->'artiste'->>'nom' = 'Pixel Griot', 'prochain : ' || (v->>'prochain_concert');
  assert not (v->'prochain_concert'->>'favori')::boolean, 'pas favori';
  assert v->'prochain_concert'->'scene'->>'nom' = 'Le Dock', 'scène';
  assert v->'prochain_concert'->'scene'->>'couleur' = 'rose', 'couleur';

  -- Avec un favori plus tard dans la nuit : c'est lui qui passe devant
  select (c->>'id')::uuid into v_c from json_array_elements(public.programme_public()->'creneaux') c
   where c->>'artiste_id' = 'pixel-griot' order by c->>'debut' desc limit 1;
  perform public.programme_basculer_favori(v_code, v_c);
  v := public.player_home(v_code);
  assert v->'prochain_concert'->>'creneau_id' = v_c::text, 'favori prioritaire : ' || (v->>'prochain_concert');
  assert (v->'prochain_concert'->>'favori')::boolean, 'favori marqué';

  -- Un code inconnu ne révèle rien
  begin perform public.player_home('XXXX-00000'); raise exception 'code inconnu accepté';
  exception when others then assert sqlerrm = 'SESSION_INVALIDE', sqlerrm; end;
end $$;
reset role;

-- Plus d'alerte récente : annonce = null ; artiste retiré : jamais proposé
-- (plus aucun artiste annoncé → prochain_concert = null)
delete from public.announcements where type = 'alerte';
update public.artistes set actif = false where id = 'pixel-griot';
do $$
declare v json;
begin
  v := public.player_home((select s.secret_code from public.player_secrets s
                            join public.players p on p.id = s.player_id where p.pseudo = 'Carte'));
  assert json_typeof(v->'annonce') = 'null', 'annonce expirée : ' || (v->>'annonce');
  assert json_typeof(v->'prochain_concert') = 'null', 'artiste retiré proposé : ' || (v->>'prochain_concert');
end $$;
update public.artistes set actif = true where id = 'pixel-griot';

select 'TABLEAU DE BORD : OK';
