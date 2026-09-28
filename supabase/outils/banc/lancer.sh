#!/usr/bin/env bash
# Banc d'essai local : recrée une base vierge, applique le schéma, joue le scénario.
# Prérequis : un PostgreSQL local qui écoute sur le port $PORT (défaut 54329).
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL="${PSQL:-/c/Program Files/PostgreSQL/18/bin/psql.exe}"
PORT="${PORT:-54329}"
q() { "$PSQL" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
q -d postgres -c "drop database if exists banc_domaf with (force);" -c "create database banc_domaf;"
q -d banc_domaf -f outils/banc/00_imiter_supabase.sql 2>&1 | grep -v -i "wal_level" || true
q -d banc_domaf -f 00_schema.sql
q -d banc_domaf -f 01_reference.sql
q -d banc_domaf -f 01_reference.sql   # rejouable
# Le coffre du scan (6.3 bis) retient l'XP : éteint pour les scénarios écrits
# avant lui, rallumé par 210_collecte.sql
q -d banc_domaf -c "update public.micro_config set actif = false where id = 1;"
q -d banc_domaf -f outils/banc/10_scenario.sql
q -d banc_domaf -f outils/banc/20_programme.sql
q -d banc_domaf -f outils/banc/30_blind_test.sql
q -d banc_domaf -f outils/banc/40_tableau_de_bord.sql
q -d banc_domaf -f outils/banc/50_scanner.sql
q -d banc_domaf -f outils/banc/60_missions.sql
q -d banc_domaf -f outils/banc/70_collection.sql
q -d banc_domaf -f outils/banc/80_classement.sql
q -d banc_domaf -f outils/banc/90_roue.sql
q -d banc_domaf -f outils/banc/100_coeurs.sql
q -d banc_domaf -f outils/banc/110_annonces.sql
q -d banc_domaf -f outils/banc/130_programme.sql
q -d banc_domaf -f outils/banc/140_regles.sql
q -d banc_domaf -f outils/banc/150_blind_joueur.sql
q -d banc_domaf -f outils/banc/160_mur.sql
q -d banc_domaf -f outils/banc/170_ecran_blind.sql
q -d banc_domaf -f outils/banc/180_console.sql
q -d banc_domaf -f outils/banc/190_joueurs.sql
q -d banc_domaf -f outils/banc/200_contenu.sql
q -d banc_domaf -f outils/banc/210_collecte.sql
q -d banc_domaf -f outils/banc/220_programme_console.sql
