#!/bin/bash
# Script pour mettre à jour une opportunité par son numéro de devis
#
# Usage:
#   ./update_by_numero.sh "109083-CL-26027" '{"stage":"PERDU","statutDevis":"PERDU"}'

NUMERO_DEVIS=$1
UPDATE_DATA=$2

if [ -z "$NUMERO_DEVIS" ] || [ -z "$UPDATE_DATA" ]; then
  echo "Usage: $0 <numero_devis> <json_data>"
  echo ""
  echo "Exemple:"
  echo "  $0 '109083-CL-26027' '{\"stage\":\"PERDU\",\"statutDevis\":\"PERDU\"}'"
  exit 1
fi

# Charger les variables d'environnement
source /Users/bahmanarson/projects/AMIPEQ_CRM/.env

echo "🔍 Recherche de l'opportunité: $NUMERO_DEVIS"
echo ""

# Étape 1: Trouver l'ID
ENCODED_NUMERO=$(echo -n "$NUMERO_DEVIS" | jq -sRr @uri)
RESPONSE=$(curl -s -X GET "https://twenty-production-7352.up.railway.app/rest/opportunities?filter%5BnumeroDevis%5D%5Beq%5D=$ENCODED_NUMERO" \
  -H "Authorization: Bearer $TWENTY_API_KEY" \
  -H "Content-Type: application/json")

ID=$(echo "$RESPONSE" | jq -r '.data[0].id // empty')

if [ -z "$ID" ] || [ "$ID" == "null" ]; then
  echo "❌ Opportunité non trouvée"
  exit 1
fi

echo "✅ Opportunité trouvée"
echo "   ID: $ID"
echo ""

# Étape 2: Mettre à jour
echo "📝 Mise à jour..."
UPDATE_RESPONSE=$(curl -s -X PATCH "https://twenty-production-7352.up.railway.app/rest/opportunities/$ID" \
  -H "Authorization: Bearer $TWENTY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_DATA")

# Vérifier le résultat
if echo "$UPDATE_RESPONSE" | jq -e '.data.updateOpportunity' > /dev/null 2>&1; then
  echo "✅ Mise à jour réussie"
  echo ""
  echo "Détails:"
  echo "$UPDATE_RESPONSE" | jq '.data.updateOpportunity | {name, stage, statutDevis, dateDevis, createdAt}'
else
  echo "❌ Erreur lors de la mise à jour"
  echo "$UPDATE_RESPONSE" | jq '.'
  exit 1
fi
