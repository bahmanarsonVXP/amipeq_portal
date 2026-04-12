#!/usr/bin/env node
/**
 * Met à jour la requête SQL d'une carte Metabase par ID.
 * Usage: node scripts/metabase_update_card_query.js <cardId> "<new SQL query>"
 * Exemple: node scripts/metabase_update_card_query.js 38 "SELECT ..."
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;
const CARD_ID = process.argv[2];
const NEW_QUERY = process.argv[3];

if (!BASE || !API_KEY || !CARD_ID) {
  console.error('Usage: node scripts/metabase_update_card_query.js <cardId> "<query>"');
  process.exit(1);
}

const url = new URL(BASE);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    };
    if (body) {
      opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    const req = https.request(opts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(responseBody) });
        } catch {
          resolve({ statusCode: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const UPDATED_QUERY = `
SELECT
  EXTRACT(YEAR FROM "createdAt")::integer AS annee,
  "statutDevis" AS statut_devis,
  SUM(COALESCE("amountAmountMicros", 0)) / 1000000.0 AS montant_euros
FROM opportunity
WHERE "deletedAt" IS NULL
GROUP BY EXTRACT(YEAR FROM "createdAt"), "statutDevis"
ORDER BY annee, statut_devis
`.trim();

async function main() {
  const getRes = await request('GET', `/api/card/${CARD_ID}`);
  if (getRes.statusCode !== 200) {
    console.error('❌ Impossible de récupérer la carte:', getRes.statusCode, getRes.data);
    process.exit(1);
  }
  const card = getRes.data;
  if (!card.dataset_query) {
    console.error('❌ Pas de dataset_query');
    process.exit(1);
  }
  const queryToUse = NEW_QUERY || UPDATED_QUERY;
  // Structure récente Metabase: stages[0].native (string)
  if (card.dataset_query.stages && card.dataset_query.stages[0] && card.dataset_query.stages[0]['lib/type'] === 'mbql.stage/native') {
    card.dataset_query.stages[0].native = queryToUse;
  } else if (card.dataset_query.type === 'native' && card.dataset_query.native) {
    card.dataset_query.native.query = queryToUse;
  } else {
    console.error('❌ Carte non native SQL. structure:', JSON.stringify(card.dataset_query).slice(0, 200));
    process.exit(1);
  }
  const putRes = await request('PUT', `/api/card/${CARD_ID}`, card);
  if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
    console.log('✅ Carte', CARD_ID, 'mise à jour.');
    return;
  }
  console.error('❌ Erreur PUT', putRes.statusCode, putRes.data);
  process.exit(1);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
