#!/bin/bash
# railway-toggle.sh - Gestion des services AMIPEQ Commerce Plateforme
#
# USAGE:
#   ./railway-toggle.sh status
#   ./railway-toggle.sh start
#   ./railway-toggle.sh stop
#   ./railway-toggle.sh size
#   ./railway-toggle.sh size <service> <memGB> <vCPU>
#
# EXEMPLES SIZING:
#   ./railway-toggle.sh size                        # affiche les profils disponibles
#   ./railway-toggle.sh size Twenty 1 1             # 1 GB / 1 vCPU pour Twenty
#   ./railway-toggle.sh size Postgres 0.5 0.5       # 512 MB / 0.5 vCPU pour Postgres
#   ./railway-toggle.sh size all small              # applique le profil "small" à tous
#   ./railway-toggle.sh size all medium             # applique le profil "medium" à tous
#
# PRÉREQUIS:
#   export RAILWAY_TOKEN=<token>  (dans ~/.zshrc)

RAILWAY_API="https://backboard.railway.app/graphql/v2"
TOKEN_FILE="/tmp/railway_token"
ENVIRONMENT_ID="402cef1d-ce9a-423e-bb4a-469a63ea8d54"

# Services : nom|id
SERVICES=(
  "Twenty|4bb0c563-b7a0-4f98-92f8-11a491565b33"
  "Postgres-t35I|55c04ad4-9fa7-4a87-b3ee-32007158c01e"
  "Twenty-Worker|739251ed-44ea-44f1-aa64-9a86bfbd06fc"
  "Metabase|8d76c709-3237-40e4-b4f3-8abb061946dd"
  "Postgres|91e2f33f-e915-42b9-b3d4-6a367e064c4f"
  "Redis|dbdc1afe-9255-4dc0-9d04-7bf39d55a53d"
)

# Ordre de démarrage (BDD en premier)
# Metabase exclu — en serverless, se réveille automatiquement si besoin
# "Metabase|8d76c709-3237-40e4-b4f3-8abb061946dd"
START_ORDER=(
  "Postgres|91e2f33f-e915-42b9-b3d4-6a367e064c4f"
  "Postgres-t35I|55c04ad4-9fa7-4a87-b3ee-32007158c01e"
  "Redis|dbdc1afe-9255-4dc0-9d04-7bf39d55a53d"
  "Twenty|4bb0c563-b7a0-4f98-92f8-11a491565b33"
  "Twenty-Worker|739251ed-44ea-44f1-aa64-9a86bfbd06fc"
)

# Profils de sizing : service|memGB|vCPU
# small  = usage interne 1-3 users
# medium = usage normal  3-10 users
PROFILE_SMALL=(
  "Twenty|0.5|0.5"
  "Twenty-Worker|1|1"
  "Postgres|0.5|0.5"
  "Redis|0.125|0.1"
)

PROFILE_MEDIUM=(
  "Twenty|1|1"
  "Twenty-Worker|0.5|0.5"
  "Postgres|1|1"
  "Redis|0.25|0.25"
)

# --- Helpers ---
get_token() {
  if [ -n "$RAILWAY_TOKEN" ]; then
    echo "$RAILWAY_TOKEN"
  elif [ -f "$TOKEN_FILE" ]; then
    cat "$TOKEN_FILE" | tr -d '[:space:]'
  else
    echo "❌ Token introuvable. Définis RAILWAY_TOKEN ou place le token dans $TOKEN_FILE" >&2
    exit 1
  fi
}

gql() {
  local query="$1"
  local token
  token=$(get_token)
  curl -s -X POST "$RAILWAY_API" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$query\"}"
}

get_service_id() {
  local target="$1"
  for entry in "${SERVICES[@]}"; do
    local name="${entry%%|*}"
    local sid="${entry##*|}"
    if [ "$name" = "$target" ]; then
      echo "$sid"
      return
    fi
  done
}

get_active_deployment() {
  local service_id="$1"
  local result
  result=$(gql "{ deployments(input: { serviceId: \\\"$service_id\\\" }) { edges { node { id status } } } }")
  echo "$result" | grep -o '"id":"[^"]*"\|"status":"[^"]*"' | paste - - | grep 'SUCCESS\|SLEEPING\|DEPLOYING' | head -1 | grep -o '"id":"[^"]*"' | sed 's/"id":"//;s/"//'
}

apply_limit() {
  local name="$1" sid="$2" mem="$3" cpu="$4"
  result=$(gql "mutation { serviceInstanceLimitsUpdate(input: { environmentId: \\\"$ENVIRONMENT_ID\\\", serviceId: \\\"$sid\\\", memoryGB: $mem, vCPUs: $cpu }) }")
  local mem_mb
  mem_mb=$(echo "$mem * 1024" | bc | cut -d. -f1)
  if echo "$result" | grep -q '"serviceInstanceLimitsUpdate":true'; then
    printf "  ✅ %-20s %s MB / %s vCPU\n" "$name" "$mem_mb" "$cpu"
  else
    printf "  ⚠️  %-20s %s\n" "$name" "$(echo "$result" | grep -o '"message":"[^"]*"' | head -1)"
  fi
}

# --- Stop tous les services ---
stop_all() {
  echo "🔴 Arrêt de tous les services AMIPEQ..."
  for entry in "${SERVICES[@]}"; do
    name="${entry%%|*}"
    service_id="${entry##*|}"
    printf "  ↓ %-20s " "$name..."
    dep_id=$(get_active_deployment "$service_id")
    if [ -z "$dep_id" ]; then
      echo "déjà arrêté"
      continue
    fi
    result=$(gql "mutation { deploymentStop(id: \\\"$dep_id\\\") }")
    if echo "$result" | grep -q '"deploymentStop":true'; then
      echo "✅ arrêté"
    else
      echo "⚠️  $(echo "$result" | grep -o '"message":"[^"]*"' | head -1)"
    fi
  done
  echo ""
  echo "✅ Tous les services sont arrêtés."
}

# --- Start tous les services ---
start_all() {
  echo "🟢 Démarrage de tous les services AMIPEQ..."
  for entry in "${START_ORDER[@]}"; do
    name="${entry%%|*}"
    service_id="${entry##*|}"
    printf "  ↑ %-20s " "$name..."
    result=$(gql "mutation { serviceInstanceRedeploy(environmentId: \\\"$ENVIRONMENT_ID\\\", serviceId: \\\"$service_id\\\") }")
    if echo "$result" | grep -qE '"serviceInstanceRedeploy":(true|\{\})'; then
      echo "✅ relancé"
    else
      echo "⚠️  $(echo "$result" | grep -o '"message":"[^"]*"' | head -1)"
    fi
    sleep 2
  done
  echo ""
  echo "✅ Tous les services ont été relancés."
  echo "⏳ Attends ~2 min que Twenty et Metabase soient complètement opérationnels."
}

# --- Status ---
status_all() {
  echo "📊 Status des services AMIPEQ..."
  for entry in "${SERVICES[@]}"; do
    name="${entry%%|*}"
    service_id="${entry##*|}"
    result=$(gql "{ deployments(input: { serviceId: \\\"$service_id\\\" }) { edges { node { id status createdAt } } } }")
    status=$(echo "$result" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
    case "$status" in
      SUCCESS)   icon="✅" ;;
      SLEEPING)  icon="💤" ;;
      DEPLOYING) icon="🔄" ;;
      CRASHED)   icon="💥" ;;
      REMOVED)   icon="🔴" ;;
      *)         icon="❓" ;;
    esac
    printf "  %-20s %s %s\n" "$name" "$icon" "${status:-inconnu}"
  done
  echo ""
  echo "  ℹ️  postgres-volume-qS6R = volume disque (ne se stoppe pas, ne consomme pas de CPU)"
}

# --- Sizing ---
size_cmd() {
  local target="$1"
  local mem="$2"
  local cpu="$3"

  # Aucun argument : affiche les profils
  if [ -z "$target" ]; then
    echo "📐 Profils de sizing disponibles:"
    echo ""
    echo "  Profil SMALL (usage interne, 1-3 users) :"
    for entry in "${PROFILE_SMALL[@]}"; do
      local n="${entry%%|*}"; local rest="${entry#*|}"; local m="${rest%%|*}"; local c="${rest##*|}"
      local mb=$(echo "$m * 1024" | bc | cut -d. -f1)
      printf "    %-20s %s MB / %s vCPU\n" "$n" "$mb" "$c"
    done
    echo ""
    echo "  Profil MEDIUM (usage normal, 3-10 users) :"
    for entry in "${PROFILE_MEDIUM[@]}"; do
      local n="${entry%%|*}"; local rest="${entry#*|}"; local m="${rest%%|*}"; local c="${rest##*|}"
      local mb=$(echo "$m * 1024" | bc | cut -d. -f1)
      printf "    %-20s %s MB / %s vCPU\n" "$n" "$mb" "$c"
    done
    echo ""
    echo "  Usage:"
    echo "    $0 size all small              # applique le profil small"
    echo "    $0 size all medium             # applique le profil medium"
    echo "    $0 size <service> <memGB> <vCPU>  # sizing manuel"
    echo ""
    echo "  Exemples manuels:"
    echo "    $0 size Twenty 1 1             # 1 GB / 1 vCPU"
    echo "    $0 size Postgres 0.5 0.5       # 512 MB / 0.5 vCPU"
    return
  fi

  # Appliquer un profil à tous les services
  if [ "$target" = "all" ]; then
    local profile_name="$mem"
    case "$profile_name" in
      small)  profile=("${PROFILE_SMALL[@]}") ;;
      medium) profile=("${PROFILE_MEDIUM[@]}") ;;
      *)
        echo "❌ Profil inconnu: $profile_name (small | medium)"
        exit 1
        ;;
    esac
    echo "🔧 Application du profil $profile_name..."
    for entry in "${profile[@]}"; do
      local n="${entry%%|*}"; local rest="${entry#*|}"; local m="${rest%%|*}"; local c="${rest##*|}"
      local sid
      sid=$(get_service_id "$n")
      apply_limit "$n" "$sid" "$m" "$c"
    done
    echo ""
    echo "✅ Profil $profile_name appliqué."
    return
  fi

  # Sizing manuel d'un service spécifique
  if [ -z "$mem" ] || [ -z "$cpu" ]; then
    echo "❌ Usage: $0 size <service> <memGB> <vCPU>"
    echo "   Ex:    $0 size Twenty 1 1"
    exit 1
  fi

  local sid
  sid=$(get_service_id "$target")
  if [ -z "$sid" ]; then
    echo "❌ Service inconnu: $target"
    echo "   Services disponibles: Twenty, Twenty-Worker, Postgres, Postgres-t35I, Metabase, Redis"
    exit 1
  fi

  echo "🔧 Sizing $target → $(echo "$mem * 1024" | bc | cut -d. -f1) MB / $cpu vCPU..."
  apply_limit "$target" "$sid" "$mem" "$cpu"
}

# --- Help ---
show_help() {
  cat <<'EOF'
# Voir les profils
./railway-toggle.sh size

# Appliquer un profil à tous les services
./railway-toggle.sh size all small    # 1-3 users
./railway-toggle.sh size all medium   # 3-10 users

# Sizing manuel d'un service
./railway-toggle.sh size Twenty 1 1          # 1 GB / 1 vCPU
./railway-toggle.sh size Postgres 0.5 0.5    # 512 MB / 0.5 vCPU

# Autres commandes
./railway-toggle.sh status
./railway-toggle.sh stop
./railway-toggle.sh start
EOF
}

# --- Main ---
case "$1" in
  stop)          stop_all ;;
  start)         start_all ;;
  status)        status_all ;;
  size)          size_cmd "$2" "$3" "$4" ;;
  --help | -h)   show_help ;;
  *)
    show_help
    exit 1
    ;;
esac
