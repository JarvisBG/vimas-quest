#!/usr/bin/env bash
# ============================================================================
# Sauvegarde manuelle de la base DOMAF Quest (forfait gratuit = aucune
# sauvegarde automatique). Voir supabase/ROUTINE.md.
#
#   bash supabase/outils/sauvegarder.sh
#
# Le mot de passe de la base est demandé par pg_dump : il n'est jamais écrit
# dans un fichier ni dans l'historique. Les sauvegardes vont dans
# supabase/sauvegardes/ (hors Git : elles contiennent des données de joueurs).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PG_DUMP="${PG_DUMP:-/c/Program Files/PostgreSQL/18/bin/pg_dump.exe}"
# Chaîne « Session pooler » (IPv4) : Supabase → Connect → Direct → Session pooler.
# Sans le mot de passe. Hôte relevé le 17/09/2026 (à revérifier en cas d'échec).
HOTE="${DOMAF_PG_HOTE:-aws-1-eu-west-3.pooler.supabase.com}"
UTILISATEUR="postgres.greawdlzcuewlcndddxq"

mkdir -p sauvegardes
horodatage="$(date +%Y-%m-%d_%Hh%M)"
commun=(--host="$HOTE" --port=5432 --username="$UTILISATEUR" --dbname=postgres
        --no-owner --no-privileges --password)

echo "1/2 Structure + données du schéma public…"
"$PG_DUMP" "${commun[@]}" --schema=public \
  --file="sauvegardes/domaf_${horodatage}_public.sql"

echo "2/2 Comptes de l'équipe (auth.users, pour recréer le lien avec public.staff)…"
"$PG_DUMP" "${commun[@]}" --data-only --table=auth.users --table=auth.identities \
  --file="sauvegardes/domaf_${horodatage}_auth.sql"

ls -l sauvegardes/domaf_"${horodatage}"_*
echo "Sauvegarde terminée. La copier aussi hors de ce PC (clé USB, Drive privé)."
