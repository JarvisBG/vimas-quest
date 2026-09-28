# Banque de questions — Vimas Quest (reprise du DOMAF, adaptée le 29/09/2026)

> **Validé par Jarvis le 19/09/2026** (S29 bières retirée, transport une seule fois, tirage au sort final validé). Rayer, corriger, ajouter directement dans ce fichier.
> Règles : une question = **un seul tapotement** (liste fermée, jamais de texte libre dans le coffre).
> L'ordre des réponses est **mélangé** à l'affichage, sauf pour les échelles et les tranches (marquées « ordre fixe »).
> Le dernier choix « autre » ou « aucun » reste toujours en bas.

Légende :
- **Fiche** : posée à l'inscription (on peut passer) ; si elle est passée, elle revient **en premier** dans le coffre du scan.
- **Scan** : posée dans le coffre après un scan réussi, n'importe quand.
- **Soir** : posée dans le coffre **après 18 h** (festival de jour ; démo : `coffreConfig.soirDebut`, base : `micro_config.soir_debut` à régler en étape 8), seulement si le joueur a scanné ce jour-là (reprend le sondage du soir).

---

## A. Fiche fan (inscription) — 7 écrans

| # | Question | Réponses | Base |
|---|---|---|---|
| F1 | Tu as quel âge ? | 13-15 · 16-18 · 19-24 · 25-30 · 31-40 · 41 et plus *(ordre fixe)* | existe (31+ à découper en 31-40 / 41+) |
| F2 | Tu es… | Un homme · Une femme | existe |
| F3 | Tu habites où ? | 20 quartiers de Yaoundé + « un autre quartier » + « une autre ville » *(ordre fixe, déjà trié)* | existe |
| F4 | Ta musique, c'est surtout… | Afrobeats · Makossa · Bikutsi · Coupé-décalé · Rap / Hip-hop · R&B / Soul · Gospel · Reggae / Dancehall · Rumba / Ndombolo · Jazz · Électro · Zouk / Kompa · Autre | existe |
| F5 | Dans la vie, tu es… | Élève · Étudiant · Salarié · À mon compte / commerçant · En recherche d'emploi · Autre | nouveau |
| F6 | Tu vas à combien de concerts par an ? | Aucun, c'est mon premier · 1 ou 2 · 3 à 5 · Plus de 5 *(ordre fixe)* | nouveau |
| F7 | Ton numéro de téléphone | champ numéro (+237) · case « Vimas Production peut me contacter » · case « Les partenaires du VIMAS FEST peuvent me contacter » (**jamais pré-cochées**) — **seulement si F1 ≥ 19-24** | table `player_contact` existe |

Accroche du F7 : « **Ne perds jamais ta carte** (le stand la retrouve avec ton numéro) **+ participe au tirage au sort final** ».

---

## B. Coffre du scan — venue (6, déjà en base)

| # | Question | Réponses |
|---|---|---|
| S1 | Tu es venu comment aujourd'hui ? | À pied · Moto-taxi · Taxi · Voiture personnelle · Bus |
| S2 | Tu as connu le VIMAS FEST comment ? | Un ami · Facebook / Instagram · TikTok · WhatsApp · Radio / télé · Une affiche · Autrement |
| S3 | Tu es venu surtout pour… | Les concerts · La mode et les stands · La danse · Accompagner quelqu'un · Tout le festival *(1re édition : remplace « C'est ton combientième DOMAF ? »)* |
| S4 | Tu es venu avec qui ? | Seul · Avec des amis · En couple · En famille · Avec des collègues |
| S5 | Tu penses dépenser combien sur place ? | ~~(doublon avec Soir « dépense »)~~ → **retirée** |
| S6 | Tu écoutes ta musique surtout où ? | Appli de streaming · YouTube · TikTok · Radio · En concert |

## C. Coffre du scan — écoute

| # | Question | Réponses |
|---|---|---|
| S7 | Ton appli de musique principale ? | Boomplay · Audiomack · Spotify · YouTube Music · Apple Music · Deezer · Aucune |
| S8 | Tu paies un abonnement musique ? | Oui · Non, la version gratuite me suffit · Non, je n'utilise pas d'appli |
| S9 | Tu écoutes de la musique combien de temps par jour ? | Moins d'1 h · 1 à 3 h · 3 à 5 h · Plus de 5 h *(ordre fixe)* |
| S10 | Tu écoutes surtout… | Des artistes camerounais · Des artistes africains · Des artistes internationaux · Un peu de tout |
| S11 | La radio, tu l'écoutes ? | Tous les jours · De temps en temps · Jamais *(ordre fixe)* |
| S12 | Tu écoutes la musique sur quoi ? | Téléphone · Écouteurs Bluetooth · Enceinte · Télé · Voiture |

## D. Coffre du scan — goûts

| # | Question | Réponses |
|---|---|---|
| S13 | Ton 2e genre préféré ? | même liste que F4 |
| S14 | Tu découvres les nouveaux artistes surtout par… | TikTok · Instagram · YouTube · La radio · Les amis · Les concerts |
| S15 | Tu as déjà acheté un morceau ou un album ? | Oui, en ligne · Oui, un CD · Jamais |
| S16 | Tu suis des artistes sur les réseaux ? | Oui, beaucoup · Quelques-uns · Non |
| S17 | Tu préfères… | Les grandes stars · Les nouveaux talents · Les deux |
| S18 | Tu fais toi-même de la musique ou de la danse ? | Oui, c'est mon métier · Oui, pour le plaisir · Non |

## E. Coffre du scan — sorties et dépenses

| # | Question | Réponses |
|---|---|---|
| S19 | Tu sors (maquis, boîte, concert) combien de fois par mois ? | Jamais · 1 à 2 fois · 3 à 5 fois · Plus de 5 fois *(ordre fixe)* |
| S20 | Ton budget sorties par mois ? | Moins de 10 000 · 10 000 à 25 000 · 25 000 à 50 000 · Plus de 50 000 FCFA *(ordre fixe)* |
| S21 | Tes billets de concert, tu les achètes… | En ligne · Sur place · Chez un revendeur · On me les offre |
| S22 | Tu paies surtout avec… | MTN Mobile Money · Orange Money · Espèces · Carte bancaire |
| S23 | Un concert à 5 000 FCFA, c'est… | Pas cher · Correct · Trop cher *(ordre fixe)* |

## F. Coffre du scan — partenaires (à ajuster selon les interlocuteurs)

| # | Question | Réponses |
|---|---|---|
| S24 | Ton opérateur mobile principal ? | MTN · Orange · Camtel / Blue · Nexttel |
| S25 | Ton forfait internet, tu l'achètes… | Chaque jour · Chaque semaine · Chaque mois *(ordre fixe)* |
| S26 | Ton téléphone, c'est… | Android · iPhone · Téléphone simple |
| S27 | Le réseau social que tu ouvres le plus ? | WhatsApp · TikTok · Facebook · Instagram · Snapchat · X |
| S28 | Au festival, tu bois plutôt… | Bière · Soda · Jus · Eau · Énergisant · Rien |
| S30 | Tu manges quoi au festival ? | Grillades / soya · Plats locaux · Fast-food · Rien, je mange avant |

## G. Coffre du scan — profil

| # | Question | Réponses |
|---|---|---|
| S31 | Tu vis à Yaoundé depuis… | Toujours · Plus de 5 ans · Moins de 5 ans · Je n'y vis pas *(ordre fixe)* |
| S32 | À la maison, tu parles surtout… | Français · Anglais · Pidgin · Une langue locale |
| S33 | Tu as des enfants ? | Oui · Non |

## H. Coffre de fin de journée (sondage du soir fondu, après 18 h)

| # | Question | Réponses | D'où |
|---|---|---|---|
| N1 | Ta journée, tu la notes comment ? | Décevante · Moyenne · Bien · Très bien · Inoubliable *(ordre fixe)* | `note` |
| N2 | Ton concert préféré aujourd'hui ? | artistes qui ont joué ce jour-là | `concert` |
| N3 | Ce qui t'a le plus plu aujourd'hui ? | La musique · L'ambiance · Le jeu Vimas Quest · La nourriture · L'organisation · Les rencontres | `plus` (3 choix → **1 seul**) |
| N4 | L'attente à l'entrée ? | Rapide · Correcte · Trop longue *(ordre fixe)* | `attente` éclatée |
| N5 | L'attente au bar ? | idem | `attente` |
| N6 | L'attente aux food-trucks ? | idem | `attente` |
| N7 | Les toilettes ? | Propres et rapides · Correctes · À revoir *(ordre fixe)* | `attente` |
| N8 | Combien as-tu dépensé aujourd'hui (sans le billet) ? | Rien · Moins de 2 000 · 2 000 à 5 000 · 5 000 à 10 000 · Plus de 10 000 FCFA *(ordre fixe)* | `depense` |
| N9 | Ce qu'on doit améliorer en priorité ? | Plus de stands · Moins d'attente · Plus d'activités · Plus de place · La nourriture · Rien, c'était bien | `ameliorer` (**1 seul**) |
| N10 | Conseillerais-tu Vimas Quest à un ami ? | 0 à 10 *(ordre fixe)* | `jeu` |
| N11 | Tu reviendras l'an prochain ? | Oui, sûr · Peut-être · Non *(ordre fixe)* | `revenir` |
| — | ~~Un mot pour l'équipe~~ | texte libre → **retirée** du coffre (pas en un tapotement) | `mot` |

Les questions « du jour » (N1 à N9) sont reposées **chaque soir** où le joueur est venu ; N10 et N11 une seule fois.
S1 et S4 (transport, avec qui) : posées **une seule fois** (décision du 19/09).

---

**Total** : 7 questions de fiche + 31 au scan + 11 le soir = **49**. Un joueur actif (10 à 15 scans par jour) en voit la plupart sur les 2 jours du VIMAS FEST.
**Quand la banque est vide**, le coffre s'ouvre sans question.
