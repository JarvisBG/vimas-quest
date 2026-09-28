# Extraction de la base Otaku Quest (17/09/2026)

Structure **réelle** de la prod Otaku (`krkzahdbcnutxoyxproj`), lue en lecture seule dans
l'éditeur SQL de Supabase. **Aucune donnée joueur.** Postgres 17.6.

| Fichier | Contenu |
|---|---|
| `otaku_structure_prod.sql` | **Référence lisible** assemblée à partir des CSV (ne pas exécuter tel quel) |
| `q1_tables.csv` | 35 tables (DDL des colonnes + lignes estimées) |
| `q2_contraintes.csv` | 99 contraintes : 35 PK, 8 UNIQUE, 21 CHECK, 35 FK |
| `q3_divers.csv` | extensions, index, RLS, 32 politiques, triggers, Realtime, droits |
| `q4_fonctions.csv` | 126 fonctions (13 lots de 10) |
| `requetes/` | Les 4 requêtes utilisées (ré-exécutables pour une nouvelle extraction) |

Méthode : SQL collé via `Set-Clipboard`, bouton Run, Export → Download CSV.
Les mots `create` / `alter` sont construits avec `upper()` dans les requêtes, sinon
l'éditeur Supabase croit à une création de table et propose d'« activer RLS ».

## Ce qu'on y apprend

- **RLS active sur les 35 tables.** Pas de bucket storage, pas de cron.
- **Realtime** : `players`, `announcements`, `events`, `game_state`.
- **Triggers** : 2 sur `players` (`pass_garde`, `_maj_xp_jour`) quand l'XP change.
- **Raids** = `quiz_sessions` avec `kind = 'raid'` (+ `boss_name`, `boss_image`, `boss_hp_max`,
  `raid_bonus_xp`) et `_raid_damage()` → base du blind test DOMAF.
- **Billetterie** : `tickets`, `carnets`, `billetterie_config` + rôles `staff` (`is_vendeur`, `staff_role`).
- **À écarter (étape 2.3)** : trésor (`treasure_hunts/steps/progress`, `treasure_*`,
  `admin_*_hunt`, `admin_*_step`), duels (`duels`, `admin_record_duel`, `admin_list_duels`),
  schéma `archive_yaounde` + `archive_lire`. `tournament_kings` / `roi_veille` (tournoi du jour) : à trancher.
