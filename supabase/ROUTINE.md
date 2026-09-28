# Routine du forfait gratuit Supabase — DOMAF Quest

Projet `domaf-quest` (`greawdlzcuewlcndddxq`, eu-west-3), organisation Sivraj, forfait **Free**.

## Ce que le forfait gratuit ne fait pas

| Limite | Conséquence | Parade |
|---|---|---|
| Aucune sauvegarde automatique | Une erreur = données perdues | **Sauvegarde manuelle** (ci-dessous) |
| Pause après **7 jours** sans activité | Site cassé tant que le projet dort | **Réveil** avant chaque échéance |
| 200 connexions Realtime simultanées | Au-delà, l'écran ou la console décrochent | Téléphones en polling (règle d'Otaku) |
| 500 Mo de base, 5 Go de bande passante / mois | Blocage en lecture seule | Surveiller *Usage* pendant le festival |

## Sauvegarde manuelle

Prérequis : PostgreSQL 18 installé (`pg_dump`), mot de passe de la base (celui choisi à la
création du projet ; sinon *Project Settings → Database → Reset database password*).

```bash
bash supabase/outils/sauvegarder.sh
```

- Le mot de passe est demandé deux fois (structure/données, puis comptes de l'équipe).
- Résultat : `supabase/sauvegardes/domaf_<date>_public.sql` et `…_auth.sql`,
  **hors Git** (données personnelles des joueurs). En garder une copie hors du PC.
- Restauration sur un projet neuf (à répéter d'abord sur le banc local) : `_auth.sql`
  (les comptes), puis `_public.sql` (structure + données du schéma public), puis les 4 lignes
  « Temps réel » de la fin de `00_schema.sql` (la publication n'est pas dans la sauvegarde).

Quand sauvegarder :

| Moment | Pourquoi |
|---|---|
| Après chaque grosse saisie (programme, QR, badges, blind tests) | Le travail de préparation |
| Chaque matin du festival (26 → 29/11), vers 7 h | Après la nuit de jeu |
| Juste après la clôture (30/11) | Bilan, lots, statistiques |
| Avant toute modification de structure (correctif) | Retour arrière possible |

## Réveil du projet

Automatique : `.github/workflows/reveil-supabase.yml` interroge la base tous les 3 jours
(onglet *Actions* du dépôt ; lancement à la main : `gh workflow run reveil-supabase.yml`).
En cas d'échec du workflow (e-mail de GitHub), le projet est peut-être déjà en pause :

1. Ouvrir <https://supabase.com/dashboard/project/greawdlzcuewlcndddxq>.
2. Si le projet est en pause : **Restore project** (quelques minutes).
3. Vérifier dans l'éditeur SQL : `select public.jour_jeu(), count(*) from public.staff;`
4. Ouvrir le site et la console : connexion du GM.

Échéances (au moins une activité tous les 6 jours) :

- pendant la préparation : à chaque séance de travail ;
- **semaine du 16/11/2026** : réveil + sauvegarde + test complet (site, console, écran) ;
- **25/11/2026** (veille) : réveil + sauvegarde ;
- du 26 au 29/11 : le jeu tourne, la base ne dort pas.

## Passage en Pro

À rediscuter si l'affluence attendue dépasse ~200 écrans connectés en même temps
(écran géant + consoles, les téléphones étant en polling), ou pour avoir des sauvegardes
quotidiennes automatiques pendant le festival.
