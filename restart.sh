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

# Tuer les processus esbuild orphelins laissés par wrangler
pkill -f "gateway/node_modules/@esbuild" 2>/dev/null || true
pkill -f "frontend/node_modules/@esbuild" 2>/dev/null || true

mkdir -p "${LOG_DIR}"

echo "=== Démarrage backend :4000 ==="
(
  cd "${ROOT}/backend"
  exec npm run dev
) >"${LOG_DIR}/backend.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/backend.log"

# Attendre que le backend soit prêt avant de lancer le gateway
sleep 4

echo "=== Démarrage gateway :8787 ==="
(
  cd "${ROOT}/gateway"
  exec npm run dev
) >"${LOG_DIR}/gateway.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/gateway.log"

# Attendre que le gateway (workerd) soit prêt avant de lancer le frontend
sleep 6

echo "=== Démarrage frontend :3000 ==="
(
  cd "${ROOT}/frontend"
  exec npm run dev
) >"${LOG_DIR}/frontend.log" 2>&1 &
echo "  PID $!  →  tail -f ${LOG_DIR}/frontend.log"

echo ""
echo "Services lancés en arrière-plan. Les sorties ne s’affichent PAS ici :"
echo "  → tout est écrit dans : ${LOG_DIR}/"
echo ""
echo "Pour VOIR les erreurs et le flux en direct :"
echo "  1) Ouvre un NOUVEAU terminal (fenêtre ou onglet)"
echo "  2) cd \"${ROOT}\""
echo "  3) ./watch-dev-logs.sh"
echo ""
echo "Ou à la main :"
echo "  tail -f ${LOG_DIR}/gateway.log"
echo ""
echo "Site (frontend) : http://localhost:3000"
echo "Gateway API     : http://localhost:8787"
echo "Backend         : http://localhost:4000"
echo ""
echo "Pour arrêter les serveurs : relancer ce script ou libérer les ports ${PORTS[*]}."
