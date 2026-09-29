# Recette — étape 11 (Vimas Quest)

> Commencée le 29/09/2026. Cochez au fur et à mesure ; notez tout défaut en bas avec la page,
> le téléphone et l'heure.

## A. Déjà vérifié (Claude, sans toucher la base en ligne)

### Anti-triche et sécurité : lecture de l'audit attendu (`supabase/outils/audit_attendu.csv`)
- [x] **RLS activée sur les 42 tables.** La clé publique garde les droits Supabase par défaut
  (`anon=SIUD`), mais **aucune politique d'écriture n'est ouverte à `anon`** : un visiteur ne peut
  écrire directement dans aucune table (XP, jetons, scans, roue, tickets…).
- [x] Les écritures directes sont réservées au personnel connecté (`is_staff()` / `is_gm()`) :
  programme (lieux, scènes, artistes, créneaux, dédicaces), réglages (cœurs, micro, profil, contact, billetterie).
- [x] Les **48 fonctions ouvertes à `anon`** sont soit des lectures publiques (programme, mur, classement,
  palmarès…), soit des actions de joueur qui **exigent `p_secret_code`** (scan, coffre, roue, blind test,
  cœurs, fiche, favoris, ticket). Aucune fonction `admin_*` n'est ouverte à `anon`.
- [x] `player_secrets` (codes secrets) : aucune politique, donc illisible par le public. `players` est lisible
  (pseudo, XP, rang : nécessaire au classement), mais ne contient ni téléphone ni code secret.
- [x] Fiche fan (`player_profile`, `player_contact`) : lisible par le personnel seulement.

**Limite :** c'est l'état *attendu*. Pour confirmer que la base en ligne y est identique, Jarvis colle
`supabase/outils/audit_base.sql` (lecture seule) dans l'éditeur SQL de Supabase et compare le résultat à
`audit_attendu.csv`. Les sondes d'écriture avec la clé publique contre la base en ligne n'ont pas été
lancées : elles demandent l'accord explicite de Jarvis.

### Base en ligne, lecture avec la clé publique (29/09, accord de Jarvis)
- [x] **Lisibles** (18, attendu) : announcements (3), artistes (12), badges (15), billetterie_config,
  coeur_config, contact_config, creneaux (12), dedicaces (3), game_state, lieux (16), micro_config,
  micro_questions (42), profil_config, quests (11), roulette_prizes (11), scenes (2).
- [x] **Rien de visible** : player_secrets, qr_codes (les codes des QR restent secrets), quiz_questions
  (les réponses du blind test restent secrètes), player_profile, player_contact, tickets, carnets, coffres,
  scans, roulette_spins, staff, console_journal… Conforme à l'audit.
- [x] players, events, quest_progress et player_badges sont publics mais vides : aucun joueur en base à ce jour.
- [x] **Audit de la base en ligne** (`audit_base.sql` lancé par Jarvis le 29/09, export CSV) : 244 lignes,
  **conforme** à `audit_attendu.csv`. Mêmes 42 tables, 40 politiques, 152 fonctions, mêmes droits `anon` et
  `authenticated`. Seul écart : le contenu de 6 fonctions réécrites par le correctif de l'étape 8
  (`_code_secret_tirage`, `_collecte_soir`, `_is_system_badge`, `jour_festival_label`, `profil_options`,
  `scan_qr`), car la référence datait d'avant ce correctif. `audit_attendu.csv` a été mis à jour ; il
  correspond désormais à la base en ligne. **L'anti-triche est donc confirmé en ligne.**
- [ ] Sondes d'écriture avec la clé publique : bloquées par le mode automatique de Claude Code. Elles ne sont
  plus indispensables, puisque l'audit en ligne confirme qu'aucune politique d'écriture n'est ouverte à `anon`.

### Charge (forfait gratuit : 200 connexions temps réel)
- [x] **Les téléphones n'ouvrent aucune connexion temps réel.** Seuls les écrans géants (mur, blind test) et
  la console en ouvrent (`ecran-mur.js`, `ecran-blind.js`, `console.js`). Il en faut environ 3 à 10 pour
  tout le festival : on reste très loin de la limite de 200.
- [x] Blind test sur téléphone : lecture de `quiz_state` en différé, sans temps réel (aucune lecture pendant la
  question ; une seule à la fin du chrono, étalée sur 1 s ; ~3 s pendant la révélation ; 1/min hors manche).
  300 joueurs ≈ 100 requêtes/s en pointe pendant la révélation : à vérifier au test de charge (D).

## B0. Parcours joueur sur le site en ligne, dans Chrome sur PC (Claude, 29/09 vers 7 h)

Joueur d'essai **`EssaiRecette1`** créé sur la vraie base (à effacer avant la démo avec les autres `Essai%`).
- [x] Inscription : pseudo, pochette, règles ; code secret affiché ; case « j'ai noté mon code » obligatoire
- [x] Fiche fan : 6 questions pour un 13-15 ans (pas de question téléphone pour un mineur), quartiers de Yaoundé ;
  **+170 XP** annoncés = 6 × 20 + 50 ✔
- [x] Scan de la Grande Scène `DQ-VSCGRD` : +80 XP, +8 jetons, coffre à question (+10 XP) ✔
- [x] Tableau de bord : 260 XP = 170 + 80 + 10 ✔, 26 jetons, 3 badges, 1ᵉʳ, blind test « dans 9 h 45 » (17 h) ✔
- [x] Même QR scanné une deuxième fois : écran « Déjà scanné aujourd'hui », propre, sans gain ✔
- [x] Stand `DQ-VSTQST` (+20 +10 XP, +3 jetons) et food-truck `DQ-VFDYAS` ✔ ; questions des coffres adaptées à Vimas
- [x] Roue : 31 jetons → un tour à 30 → « Sticker Vimas Quest », bon de retrait « avant dimanche 21h30 »,
  lot listé dans « Mes lots », lieu de retrait au Stand Vimas Quest ✔
- [x] Programme (sam. 26 / dim. 27, 2 scènes), favori ajouté → « Mon programme » le montre, suggestions « dans ton style » ✔
- [x] Plan : enceinte du Majestic, 2 scènes, 4 stands, 2 food-trucks, points d'eau, toilettes, bouton Urgence ✔
- [x] Coups de cœur : artistes verrouillés tant que le concert n'est pas vu ✔ ; stand voté (+10 XP) puis cœur retiré ;
  les XP ne se regagnent pas en revotant (« encore 2 fois » après donner + retirer) ✔
- [x] Contenu d'essai corrigé et **appliqué en ligne** (accord de Jarvis) : `supabase/correctifs/2026-09-29_vimas-11-contenu.sql`.
  Styles tirés de la liste du profil pour que la console les accepte (Mboa Brass Band → Jazz, Lady Soca → Zouk / Kompa,
  Défilé Wax & Roots → non précisé) ; « Brasserie du Port » (nom DOMAF) → « Buvette du Majestic » (lieu + QR `DQ-VSTBAR`).
  Vérifié sur le programme en ligne.
- [x] Écran géant accessible **hors compte GM** (demande de Jarvis, comme le portail d'Otaku) : lien « Écran géant » dans le
  pied de l'accueil ; « Mur en direct » et « Blind test » sous le formulaire de connexion de la console. En ligne (v8).
- [x] Collection (5/36 : 3 badges, 2 stands) et classement (315 XP = 260 + 30 + 25 ✔)
- Corrigé dans le dépôt (pas encore en ligne) : « 1 joueurs » → accord au singulier (`classement.js`, `blind-test.js`).
- Remarques (mineures, non corrigées) : le pseudo proposé au hasard peut être « nocturne » (ex. `BasseMinuit57`)
  alors que le festival est de jour ; sur PC, la barre du bas cache la fin de la phrase sous le bouton de la roue.

## B. Parcours festivalier sur vrais téléphones (Jarvis)

Lien : https://festival-quest.jarvismboummeu28.workers.dev — 2 ou 3 téléphones (un Android d'entrée de
gamme si possible), QR d'essai `DQ-V…` imprimés depuis la console → Étiquettes.

- [ ] Installation (« Ajouter à l'écran d'accueil ») ; l'icône et le nom Vimas s'affichent
- [ ] Inscription (pseudo, archétype, ticket) ; le code secret s'affiche et se note
- [ ] Reconnexion sur un autre téléphone avec le code secret
- [ ] Scanner : un QR de stand, un QR de coffre (question), un QR déjà scanné (refus propre)
- [ ] Missions : une mission validée ; l'XP monte dans le tableau de bord
- [ ] Roue : un tour gagné avec les jetons ; lot affiché dans la collection
- [ ] Coups de cœur : donner puis retirer
- [ ] Programme : ajouter un favori ; « Mon programme » le montre
- [ ] Plan : le Majestic s'affiche, les lieux sont bien placés
- [ ] Classement : on s'y trouve ; recherche d'un pseudo
- [ ] **Réseau dégradé** (Chrome → mode 3G lente, ou un vrai réseau faible) : pages lisibles, pas de double scan
- [ ] **Hors ligne** (mode avion) : page « hors ligne », puis reprise normale au retour du réseau
- [ ] Bandeau « Maquette de démonstration » visible sur chaque page

## C. Écran géant, blind test, console (Jarvis)

- [ ] Mur (`/ecran/`) sur un PC branché à une télé, pendant que 2 téléphones jouent : les scans et la roue
  apparaissent, le classement bouge
- [ ] Blind test de bout en bout : régie (console) → écran blind test → réponses sur 2 téléphones → scores
- [ ] Console, rôle **GM** : annonce publiée (visible sur le mur), roue et lots, carnets, statistiques
- [ ] Console, rôle **staff** : noter ce qu'il voit et ce qui lui est refusé, et comparer avec ce qu'on attend
- [ ] Console, rôle **vendeur** : **créer d'abord un compte vendeur d'essai** (Supabase → Authentication →
  Add user, puis une ligne dans la table `staff` : `user_id` = son identifiant, `role` = `vendeur`) ; vendre un ticket en cherchant le
  joueur par son pseudo ; vérifier qu'il n'a accès ni à la roue ni au blind test

## D. Test de charge (plus tard, avec l'accord de Jarvis)
- [ ] Simuler environ 200 joueurs (inscription + scans + lecture du blind test) sur une copie de la base ou
  hors des heures de démo, puis effacer les joueurs d'essai (`Essai%`)

## Défauts relevés

| Date | Page / téléphone | Défaut | Corrigé |
|---|---|---|---|
| | | | |
