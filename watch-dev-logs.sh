#!/usr/bin/env bash
# Affiche en direct les journaux des 3 services (après ./restart.sh).
# Utilisation : ouvrir un terminal dédié, puis : ./watch-dev-logs.sh
# Quitter avec Ctrl+C (les serveurs continuent en arrière-plan).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/.dev-logs"

mkdir -p "${LOG_DIR}"
for f in backend.log gateway.log frontend.log; do
  [[ -f "${LOG_DIR}/${f}" ]] || touch "${LOG_DIR}/${f}"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Logs locaux (backend + gateway + frontend)"
echo "  Dossier : ${LOG_DIR}/"
echo "  Ctrl+C arrête seulement l’affichage, pas les serveurs."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

tail -n 40 -f "${LOG_DIR}/backend.log" "${LOG_DIR}/gateway.log" "${LOG_DIR}/frontend.log"
