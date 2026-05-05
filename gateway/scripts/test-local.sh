#!/usr/bin/env bash
# Tests santé + comportement JWT du gateway local.
# Prérequis : wrangler dev (ou worker) sur GATEWAY_URL (défaut http://127.0.0.1:8787)
# Pour le test JWT complet : SUPABASE_JWT_SECRET identique à celui utilisé par wrangler (.dev.vars / secrets).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${GATEWAY_URL:-http://127.0.0.1:8787}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

fail=0

echo "=== 1. Health GET $BASE/health ==="
resp="$(curl -sS -w "\n%{http_code}" "$BASE/health" || echo "000")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d')"
echo "HTTP $code"
echo "$body"
if [ "$code" != "200" ]; then
  echo "ECHEC: attendu HTTP 200"
  fail=1
else
  echo "OK"
fi
echo ""

echo "=== 2. API sans Bearer GET $BASE/api/opportunities (attendu 401) ==="
resp="$(curl -sS -w "\n%{http_code}" "$BASE/api/opportunities" || echo "000")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d')"
echo "HTTP $code"
echo "$body"
if [ "$code" != "401" ]; then
  echo "ECHEC: attendu HTTP 401 sans JWT"
  fail=1
else
  echo "OK"
fi
echo ""

echo "=== 3. API avec Bearer invalide (attendu 401) ==="
resp="$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer invalid.token.here" "$BASE/api/me" || echo "000")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d')"
echo "HTTP $code"
echo "$body"
if [ "$code" != "401" ]; then
  echo "ECHEC: attendu HTTP 401 pour token invalide"
  fail=1
else
  echo "OK"
fi
echo ""

if [ -z "${SUPABASE_JWT_SECRET:-}" ]; then
  echo "=== 4. JWT valide (SKIP) ==="
  echo "SUPABASE_JWT_SECRET non défini — impossible de signer un JWT de test."
  echo "Ajoutez SUPABASE_JWT_SECRET dans gateway/.env (ou export) puis relancez."
  exit "$fail"
fi

echo "=== 4. API avec JWT de test GET $BASE/api/me (attendu 200) ==="
TOKEN="$(node "$ROOT/scripts/sign-test-jwt.mjs")"
resp="$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/me" || echo "000")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d')"
echo "HTTP $code"
echo "$body"
if [ "$code" != "200" ]; then
  echo "ECHEC: le secret utilisé pour signer doit être le même que SUPABASE_JWT_SECRET du worker (wrangler)."
  fail=1
else
  echo "OK"
fi
echo ""

echo "=== 5. API opportunités avec JWT GET $BASE/api/opportunities ==="
resp="$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/opportunities" || echo "000")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d' | head -c 800)"
echo "HTTP $code"
echo "$body"
if [ "$code" = "401" ]; then
  echo "ECHEC: le JWT devrait être accepté (pas 401)."
  fail=1
elif [ "$code" = "200" ]; then
  echo "OK — liste Twenty renvoyée."
elif [ "$code" = "500" ]; then
  echo "ATTENTION: JWT accepté, mais Twenty a renvoyé 500 (TWENTY_API_KEY, URL, ou schéma GraphQL)."
else
  echo "ATTENTION: code HTTP inattendu (auth OK si ce n'est pas 401)."
fi

exit "$fail"
