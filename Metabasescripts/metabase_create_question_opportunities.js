#!/usr/bin/env node
/**
 * Crée une question Metabase : montants par année (createdAt) et statut devis,
 * hors opportunités supprimées (deletedAt IS NULL), montants en micro → euros.
 * Usage: node scripts/metabase_create_question_opportunities.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;
const DATABASE_ID = 2; // TWINTY DATA (id from test_metabase_api.js)

if (!BASE || !API_KEY) {
  console.error('❌ Définir METABASE_BASE_URL et METABASE_API_KEY dans .env');
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
      const data = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(data);
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

// SQL: année depuis createdAt (timestamp), montant en micro → euros, groupé par année + statut_devis, exclut deleted
// Twenty en PostgreSQL: colonnes camelCase entre guillemets, amount = "amountAmountMicros" (micros)
const NATIVE_QUERY = `
SELECT
  EXTRACT(YEAR FROM "createdAt")::integer AS annee,
  "statutDevis" AS statut_devis,
  SUM(COALESCE("amountAmountMicros", 0)) / 1000000.0 AS montant_euros
FROM opportunity
WHERE "deletedAt" IS NULL
GROUP BY EXTRACT(YEAR FROM "createdAt"), "statutDevis"
ORDER BY annee, statut_devis
`.trim();

const cardPayload = {
  name: 'Montants par année et statut devis (Opportunités)',
  description: 'Somme des montants (amount) par année de création (createdAt) et par statut devis. Exclut les opportunités supprimées (deletedAt non null). Montants convertis de micro en euros.',
  database_id: DATABASE_ID,
  dataset_query: {
    type: 'native',
    native: {
      query: NATIVE_QUERY,
      'template-tags': {},
    },
    database: DATABASE_ID,
  },
  visualization_settings: {
    'table.pivot_column': 'statut_devis',
    'table.cell_column': 'montant_euros',
  },
  display: 'table',
};

async function main() {
  console.log('📤 Création de la question dans Metabase...\n');
  console.log('Titre:', cardPayload.name);
  console.log('Base (database_id):', DATABASE_ID, '(TWINTY DATA)');
  console.log('Requête SQL (extrait):', NATIVE_QUERY.slice(0, 120) + '...\n');

  const res = await request('POST', '/api/card', cardPayload);

  if (res.statusCode >= 200 && res.statusCode < 300) {
    const card = res.data;
    console.log('✅ Question créée avec succès.\n');
    console.log('  ID:', card.id);
    console.log('  Nom:', card.name);
    console.log('  URL:', `${BASE}/question/${card.id}`);
    console.log('\nTester avec: node scripts/metabase_run_question.js', card.id);
    console.log('Vous pouvez l’ouvrir dans Metabase et l’ajouter à un dashboard.');
    return;
  }

  console.log('❌ Erreur', res.statusCode);
  if (typeof res.data === 'object') {
    console.log(res.data.message || res.data.errors || JSON.stringify(res.data, null, 2));
  } else {
    console.log(res.data);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
