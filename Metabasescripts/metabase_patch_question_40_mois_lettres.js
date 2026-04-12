#!/usr/bin/env node
/**
 * Met à jour la question 40 (montants par mois) : mois en lettres (Jan, Fév...), depuis 2023, axe X = mois_lettre.
 * Usage: node scripts/metabase_patch_question_40_mois_lettres.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;
const CARD_ID = 40;

if (!BASE || !API_KEY) {
  console.error('❌ METABASE_BASE_URL et METABASE_API_KEY requis dans .env');
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
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(b) });
        } catch {
          resolve({ statusCode: res.statusCode, data: b });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const NEW_QUERY = `
SELECT
  TO_CHAR(
    make_date(
      EXTRACT(YEAR FROM "createdAt")::integer,
      EXTRACT(MONTH FROM "createdAt")::integer,
      1
    ),
    'Mon'
  ) AS mois_lettre,
  EXTRACT(MONTH FROM "createdAt")::integer AS mois,
  EXTRACT(YEAR FROM "createdAt")::integer AS annee,
  SUM(COALESCE("amountAmountMicros", 0)) / 1000000.0 AS montant_euros
FROM opportunity
WHERE "deletedAt" IS NULL
  AND EXTRACT(YEAR FROM "createdAt") >= 2023
[[ AND "statutDevis" = {{statut_devis}} ]]
GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
ORDER BY annee, mois
`.trim();

async function main() {
  const getRes = await request('GET', `/api/card/${CARD_ID}`);
  if (getRes.statusCode !== 200) {
    console.error('❌ Impossible de récupérer la carte:', getRes.statusCode);
    process.exit(1);
  }
  const card = getRes.data;
  if (!card.dataset_query) {
    console.error('❌ Pas de dataset_query');
    process.exit(1);
  }

  if (card.dataset_query.stages?.[0]?.['lib/type'] === 'mbql.stage/native') {
    card.dataset_query.stages[0].native = NEW_QUERY;
  } else if (card.dataset_query.type === 'native' && card.dataset_query.native) {
    card.dataset_query.native.query = NEW_QUERY;
  } else {
    console.error('❌ Carte non native SQL');
    process.exit(1);
  }

  card.name = 'Montants devis générés chaque mois depuis 2023';
  card.description = 'Montant en euros des devis par mois (axe X : Jan, Fév, Mar...) et par année (une courbe par année). Depuis 2023. Exclut les devis supprimés. Filtre optionnel : Statut devis.';
  card.visualization_settings = card.visualization_settings || {};
  card.visualization_settings['graph.dimensions'] = ['mois_lettre', 'annee'];
  card.visualization_settings['graph.metrics'] = ['montant_euros'];
  card.visualization_settings['graph.x_axis.title_text'] = 'Mois';
  card.visualization_settings['graph.y_axis.title_text'] = 'Montant (€)';

  const putRes = await request('PUT', `/api/card/${CARD_ID}`, card);
  if (putRes.statusCode >= 200 && putRes.statusCode < 300) {
    console.log('✅ Question', CARD_ID, 'mise à jour : mois en lettres, depuis 2023, axe X = mois_lettre.');
    console.log('   Nom:', card.name);
    return;
  }
  console.error('❌ Erreur PUT', putRes.statusCode, putRes.data);
  process.exit(1);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
