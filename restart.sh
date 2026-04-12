#!/usr/bin/env bash
# Arrête les serveurs sur les ports du stack local, puis démarre frontend, gateway et backend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTS=(3000 8787 4000)
LOG_DIR="${ROOT}/.dev-logs"

kill_port() {
  local port=$1
  local pids
  pids="$(lsof -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Arrêt du port ${port} (PID: ${pids})"
    kill -TERM ${pids} 2>/dev/null || true
    sleep 0.5
    pids="$(lsof -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      kill -KILL ${pids} 2>/dev/null || true
    fi
  fi
}

echo "=== Libération des ports ${PORTS[*]} ==="
for port in "${PORTS[@]}"; do
  kill_port "${port}"
done

mkdir -p "${LOG_DIR}"

echo "=== Démarrage backend :4000 ==="
(
  cd "${ROOT}/backend"
  exec npm run dev
) >"${LOG_DIR}/backend.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/backend.log"

sleep 0.3

echo "=== Démarrage gateway :8787 ==="
(
  cd "${ROOT}/gateway"
  exec npm run dev
) >"${LOG_DIR}/gateway.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/gateway.log"

sleep 0.3

echo "=== Démarrage frontend :3000 ==="
(
  cd "${ROOT}/frontend"
  exec npm run dev
) >"${LOG_DIR}/frontend.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/frontend.log"

echo ""
echo "Services lancés. Journaux : ${LOG_DIR}/"
echo "  tail -f ${LOG_DIR}/backend.log ${LOG_DIR}/gateway.log ${LOG_DIR}/frontend.log"
echo ""
echo "Site (frontend) : http://localhost:3000"
echo "Gateway API     : http://localhost:8787"
echo "Backend         : http://localhost:4000"
echo ""
echo "Pour arrêter : relancer ce script ou tuer les ports ${PORTS[*]} (voir kill_port ci-dessus)."
