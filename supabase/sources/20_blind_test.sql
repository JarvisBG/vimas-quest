-- ----------------------------------------------------------------------------
-- Blind test (étape 2.7) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Les colonnes (categorie, reponse, anecdote, audio_url, audio_debut,
-- pochette_url) sont ajoutées à quiz_questions par le générateur, qui complète
-- aussi quiz_state, quiz_board, admin_quiz_live, admin_list_quiz_questions et
-- admin_duplicate_quiz_session. Les fonctions Otaku de création et de
-- modification d'une question ne changent pas : ce qui est propre au blind
-- test se règle ici, question par question.
--
-- ⚠️ audio_url est lisible par tous PENDANT la question (l'écran géant est une
--    page publique) : le nom du fichier ne doit rien dire de la réponse
--    (ex. « bt/2026-11-27/q07.mp3 », jamais « nova-kassa-lumiere.mp3 »).
-- ----------------------------------------------------------------------------

create or replace function public.admin_blind_question(
  p_id uuid,
  p_categorie text,
  p_reponse text,
  p_anecdote text,
  p_audio_url text,
  p_audio_debut integer,
  p_pochette_url text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_q public.quiz_questions%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(p_audio_debut, 0) not between 0 and 3600 then raise exception 'DEBUT_INVALIDE'; end if;
  if length(p_categorie) > 40 or length(p_reponse) > 160 or length(p_anecdote) > 400 then
    raise exception 'TEXTE_TROP_LONG';
  end if;

  begin
    update public.quiz_questions set
      categorie    = nullif(trim(p_categorie), ''),
      reponse      = nullif(trim(p_reponse), ''),
      anecdote     = nullif(trim(p_anecdote), ''),
      audio_url    = nullif(trim(p_audio_url), ''),
      audio_debut  = coalesce(p_audio_debut, 0),
      pochette_url = nullif(trim(p_pochette_url), '')
    where id = p_id
    returning * into v_q;
  exception when check_violation then
    raise exception 'ADRESSE_INVALIDE';
  end;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;
  return row_to_json(v_q);
end;
$function$;

revoke all on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) from public, anon, authenticated;
grant execute on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) to authenticated;
