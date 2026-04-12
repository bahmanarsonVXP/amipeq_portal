#!/usr/bin/env node
/**
 * Crée une question Metabase : montants en € par mois et par année (une courbe par année),
 * avec filtre optionnel par statut devis. Exclut les devis supprimés.
 * Usage: node scripts/metabase_create_question_montants_par_mois.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const https = require('https');

const BASE = (process.env.METABASE_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.METABASE_API_KEY;
const DATABASE_ID = 2; // TWINTY DATA

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

// Mois en lettres (Jan, Fév, Mar...), année, montant en euros. Depuis 2023. Filtre optionnel par statut.
const NATIVE_QUERY = `
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

// Variable optionnelle pour filtrer par statut (vide = tout afficher)
const TEMPLATE_TAGS = {
  statut_devis: {
    id: 'a1b2c3d4-e5f6-7890-abcd-statutdevis01',
    name: 'statut_devis',
    'display-name': 'Statut devis',
    type: 'text',
    required: false,
    default: null,
  },
};

const cardPayload = {
  name: 'Montants devis générés chaque mois depuis 2023',
  description: 'Montant en euros des devis par mois (axe X : Jan, Fév, Mar...) et par année (une courbe par année). Depuis 2023. Exclut les devis supprimés. Filtre optionnel : Statut devis.',
  database_id: DATABASE_ID,
  dataset_query: {
    type: 'native',
    native: {
      query: NATIVE_QUERY,
      'template-tags': TEMPLATE_TAGS,
    },
    database: DATABASE_ID,
  },
  display: 'line',
  visualization_settings: {
    'graph.dimensions': ['mois_lettre', 'annee'],
    'graph.metrics': ['montant_euros'],
    'graph.x_axis.title_text': 'Mois',
    'graph.y_axis.title_text': 'Montant (€)',
    'graph.show_values': false,
  },
};

async function main() {
  console.log('📤 Création de la question Metabase (montants devis par mois depuis 2023)...\n');
  console.log('Titre:', cardPayload.name);
  console.log('Axe X: mois_lettre (Jan, Fév, Mar...) | Axe Y: montant (€) | Une courbe par année | Depuis 2023');
  console.log('Filtre optionnel: Statut devis\n');

  const res = await request('POST', '/api/card', cardPayload);

  if (res.statusCode >= 200 && res.statusCode < 300) {
    const card = res.data;
    console.log('✅ Question créée avec succès.\n');
    console.log('  ID:', card.id);
    console.log('  Nom:', card.name);
    console.log('  URL:', `${BASE}/question/${card.id}`);
    console.log('\nDans Metabase : axe X = mois_lettre (Jan, Fév...), axe Y = montant (€), série = annee.');
    console.log('Filtre "Statut devis" : laisser vide pour tout voir, ou saisir GAGNE, PERDU, EN_ATTENTE.');
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
