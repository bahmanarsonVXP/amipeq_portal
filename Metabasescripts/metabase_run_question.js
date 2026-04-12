#!/usr/bin/env node
/**
 * Exécute une question Metabase par ID et affiche le résultat.
 * Usage: node scripts/metabase_run_question.js [cardId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;
const CARD_ID = parseInt(process.argv[2] || '38', 10);

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

async function main() {
  console.log('▶ Exécution question Metabase #' + CARD_ID + '...\n');
  const res = await request('POST', `/api/card/${CARD_ID}/query`, { ignore_cache: false });
  const ok = res.statusCode === 200 || res.statusCode === 202;
  if (!ok) {
    console.error('❌ Erreur', res.statusCode, res.data?.message || res.data?.error || res.data);
    process.exit(1);
  }
  const rows = res.data?.data?.rows || res.data?.rows || [];
  const cols = res.data?.data?.cols || res.data?.data?.results_metadata?.columns || [];
  const colNames = cols.length ? cols.map((c) => c.name || c.display_name) : ['annee', 'statut_devis', 'montant_euros'];
  console.log('Colonnes:', colNames.join(', '));
  console.log('Lignes:', rows.length);
  if (rows.length > 0) {
    console.log('\nAperçu:');
    rows.slice(0, 12).forEach((row, i) => console.log(' ', i + 1, row));
  }
  console.log('\n✅ OK');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
