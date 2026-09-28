-- ============================================================================
-- Banc d'essai LOCAL : le scanner (étape 4.3) — scan_qr et ticket_utiliser.
-- Se joue APRÈS 40_tableau_de_bord.sql.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Décor : missions isolées, deux scènes, un QR éteint, un carnet de tickets
update public.billetterie_config set actif = false where id = 1;
update public.game_state set phase = 'EXPLORATION' where id = 1;
update public.quests set active = false;
insert into public.quests (title, type, counter, goal_count, xp_reward) values
  ('Tournée des scènes', 'standard', 'scan_scene', 2, 100),
  ('Mission cachée',     'secrete',  'scan_any',   2, 40);
insert into public.qr_codes (code, label, type, xp_reward, active) values
  ('DQ-SCEN01', 'Scène Soleil', 'scene', 30, true),
  ('DQ-SCEN02', 'Le Dock',      'scene', 30, true),
  ('DQ-ETEINT', 'QR éteint',    'stand', 20, false);
insert into public.carnets (id, numero, vendeur_nom, nb_tickets)
  values ('00000000-0000-0000-0000-0000000c4a01', 999, 'Banc', 2);
insert into public.tickets (carnet_id, code, rang) values
  ('00000000-0000-0000-0000-0000000c4a01', 'TKTBANC1', 1),
  ('00000000-0000-0000-0000-0000000c4a01', 'TKTBANC2', 2);

set role anon;
do $$
declare
  v json; v_code text; q json;
begin
  v := public.create_player('Scanneur', 'soleil');
  v_code := v->>'secret_code';

  -- 1er scan : la mission avance (1/2), la mission secrète reste invisible
  v := public.scan_qr(v_code, 'dq-scen01');
  assert (v->>'xp_gagne')::int = 30, 'xp 1er scan : ' || (v->>'xp_gagne');
  assert json_array_length(v->'quetes') = 1, 'quetes 1er scan : ' || (v->>'quetes');
  q := v->'quetes'->0;
  assert q->>'titre' = 'Tournée des scènes' and (q->>'fait')::int = 1 and (q->>'objectif')::int = 2
     and not (q->>'terminee')::boolean and (q->>'xp')::int = 100, 'avancée : ' || q::text;

  -- Même QR le même jour : refusé
  begin perform public.scan_qr(v_code, 'DQ-SCEN01'); raise exception 'doublon accepté';
  exception when others then assert sqlerrm = 'DEJA_SCANNE', sqlerrm; end;

  -- 2e scène : les deux missions se terminent, la secrète apparaît enfin
  v := public.scan_qr(v_code, 'DQ-SCEN02');
  assert (v->>'xp_gagne')::int = 30 + 100 + 40, 'xp 2e scan : ' || (v->>'xp_gagne');
  assert json_array_length(v->'quetes') = 2, 'quetes 2e scan : ' || (v->>'quetes');
  assert (select bool_and((x->>'terminee')::boolean) from json_array_elements(v->'quetes') x), 'terminées';
  assert (select count(*) from json_array_elements(v->'quetes') x where x->>'titre' = 'Mission cachée') = 1, 'secrète terminée visible';

  begin perform public.scan_qr(v_code, 'DQ-NIMPORTE'); raise exception 'QR inconnu accepté';
  exception when others then assert sqlerrm = 'QR_INCONNU', sqlerrm; end;
  begin perform public.scan_qr(v_code, 'DQ-ETEINT'); raise exception 'QR éteint accepté';
  exception when others then assert sqlerrm = 'QR_INACTIF', sqlerrm; end;

  -- Billetterie coupée : le ticket n'est pas demandé
  v := public.ticket_utiliser(v_code, 'TKTBANC1');
  assert (v->>'gratuit')::boolean, 'billetterie coupée : ' || v::text;
end $$;
reset role;

-- Billetterie ouverte : sans ticket du jour, aucun gain possible
update public.billetterie_config set actif = true where id = 1;
insert into public.qr_codes (code, label, type, xp_reward) values ('DQ-STAND1', 'Stand Kora', 'stand', 20);
-- anon ne lit pas player_secrets : le code du joueur est lu avant de changer de rôle
select set_config('banc.code', (select s.secret_code from public.player_secrets s
  join public.players p on p.id = s.player_id where p.pseudo = 'Scanneur'), false) is not null;
set role anon;
do $$
declare v json; v_code text;
begin
  v_code := current_setting('banc.code');
  begin perform public.scan_qr(v_code, 'DQ-STAND1'); raise exception 'scan sans ticket accepté';
  exception when others then assert sqlerrm = 'PASS_REQUIS', sqlerrm; end;

  begin perform public.ticket_utiliser(v_code, 'PASBON00'); raise exception 'ticket inconnu accepté';
  exception when others then assert sqlerrm = 'TICKET_INCONNU', sqlerrm; end;

  v := public.ticket_utiliser(v_code, 'tkt-banc1');           -- tirets et minuscules tolérés
  assert (v->>'ok')::boolean and v->>'deja' is null, 'ticket : ' || v::text;
  v := public.ticket_utiliser(v_code, 'TKTBANC2');
  assert (v->>'deja')::boolean, 'journée déjà ouverte : ' || v::text;

  v := public.scan_qr(v_code, 'DQ-STAND1');
  assert (v->>'xp_gagne')::int = 20, 'scan avec ticket';
end $$;
reset role;
update public.billetterie_config set actif = false where id = 1;

-- Phase blind test en cours : les scans sont refusés
update public.game_state set phase = 'RAID' where id = 1;
set role anon;
do $$
begin
  perform public.scan_qr(current_setting('banc.code'), 'DQ-SCEN01');
  raise exception 'scan pendant le blind test accepté';
exception when others then assert sqlerrm = 'PHASE_RAID', sqlerrm;
end $$;
reset role;
update public.game_state set phase = 'EXPLORATION' where id = 1;

select 'SCANNER : OK';
