#!/usr/bin/env node
/**
 * Mise à jour du champ "prestation" depuis SUIVIS_CLIENTS_2026_20260413.xlsx
 *
 * Phase 1 : Met à jour le schéma TWENTY — ajoute les 13 nouvelles valeurs
 *           au MULTI_SELECT "prestation" sur l'objet Opportunity.
 * Phase 2 : Lit le fichier Excel (onglets 2025+), parse la colonne NORME
 *           avec le nouveau parser, et PATCHe chaque opportunité trouvée.
 *
 * Usage:
 *   node update_prestations_20260413.js
 *   node update_prestations_20260413.js --dry-run
 *   node update_prestations_20260413.js --skip-schema   (skip phase 1)
 *   node update_prestations_20260413.js --file "Fichiers de suivi/autre.xlsx"
 */

const xlsx    = require('xlsx');
const https   = require('https');
const minimist = require('minimist');
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { parseNorme, PRESTATION_OPTIONS } = require('./lib/parsers/norme');

const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY  = process.env.TWENTY_API_KEY || '';

const args     = minimist(process.argv.slice(2));
const DRY_RUN  = args['dry-run'] || false;
const SKIP_SCHEMA = args['skip-schema'] || false;
const EXCEL_FILE  = args.file || 'Fichiers de suivi/SUIVIS_CLIENTS_2026_20260413.xlsx';

// Column indices (0-based)
const COL_NUMERO_DEVIS = 7;  // H
const COL_NORME        = 11; // L

// ─── Metadata HTTP helper (uses /metadata endpoint) ─────────────────────────

function metadataRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL('/metadata', BASE_URL);
    const payload = JSON.stringify({ query, variables });
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors) reject(new Error(JSON.stringify(parsed.errors)));
          else resolve(parsed.data);
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Phase 1 : Update schema ─────────────────────────────────────────────────

async function getPrestationFieldId() {
  // Find opportunity object ID dynamically
  const query = `{
    objects(paging: { first: 100 }) {
      edges { node { id nameSingular } }
    }
  }`;
  const data = await metadataRequest(query);
  const edges = data?.objects?.edges || [];
  const oppObj = edges.find(e => e.node.nameSingular === 'opportunity');
  if (!oppObj) throw new Error('Object "opportunity" introuvable dans /metadata');

  const oppId = oppObj.node.id;

  // Get fields of opportunity object
  const fieldsQuery = `{
    object(id: "${oppId}") {
      fields(paging: { first: 200 }) {
        edges { node { id name type options } }
      }
    }
  }`;
  const fieldsData = await metadataRequest(fieldsQuery);
  const fieldEdges = fieldsData?.object?.fields?.edges || [];
  const field = fieldEdges.find(e => e.node.name === 'prestation');
  return field?.node || null;
}

async function updatePrestationSchema() {
  console.log('\n=== PHASE 1 : MISE À JOUR DU SCHÉMA ===\n');

  const field = await getPrestationFieldId();
  if (!field) {
    throw new Error('Champ "prestation" introuvable sur opportunity dans /metadata');
  }
  console.log(`  Field ID : ${field.id}`);
  console.log(`  Options actuelles : ${(field.options || []).map(o => o.value).join(', ')}`);

  if (DRY_RUN) {
    console.log('  [DRY-RUN] Schéma non modifié');
    return;
  }

  const mutation = `
    mutation UpdateField($input: UpdateOneFieldMetadataInput!) {
      updateOneField(input: $input) {
        id name options
      }
    }
  `;
  const result = await metadataRequest(mutation, {
    input: {
      id: field.id,
      update: { options: PRESTATION_OPTIONS },
    },
  });

  const newOptions = result?.updateOneField?.options || [];
  console.log(`  Options mises à jour (${newOptions.length}) : ${newOptions.map(o => o.value).join(', ')}`);
  console.log('  OK\n');
}

// ─── Phase 2 : Update opportunities directly via Postgres ────────────────────

const WORKSPACE_SCHEMA = 'workspace_cp9ocympgdsbsac1mrqpg02jp';
const PG_URL = 'postgres://postgres:MAEXUijNqxyTXYEEOElNhIrEvbJZVDsM@trolley.proxy.rlwy.net:57010/postgres';

async function updateOpportunities() {
  console.log('=== PHASE 2 : MISE À JOUR DES PRESTATIONS (direct DB) ===\n');

  // Connect to Postgres
  const client = new Client({ connectionString: PG_URL, ssl: false });
  await client.connect();
  console.log('  DB connectée\n');

  // Read workbook
  const wb = xlsx.readFile(EXCEL_FILE, { raw: true });
  const sheets = wb.SheetNames.filter(name => /^20(2[5-9]|[3-9]\d)$/.test(name));

  if (sheets.length === 0) {
    console.log(`  Aucun onglet annee >= 2025 dans ${EXCEL_FILE}`);
    await client.end();
    return;
  }
  console.log(`  Onglets à traiter : ${sheets.join(', ')}\n`);

  const stats = { updated: 0, alreadyOk: 0, notFound: 0, noNorme: 0, error: 0 };

  for (const sheetName of sheets) {
    const ws   = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    console.log(`  [${sheetName}] ${rows.length} lignes`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const numeroDevis = String(row[COL_NUMERO_DEVIS] || '').trim();
      const normeRaw    = String(row[COL_NORME]        || '').trim();

      if (!numeroDevis || !normeRaw) { stats.noNorme++; continue; }

      const newPrestations = parseNorme(normeRaw);

      process.stdout.write(`    ${numeroDevis.padEnd(28)} | ${normeRaw.substring(0, 25).padEnd(25)} → [${newPrestations.join(', ')}] ... `);

      try {
        // Look up current value
        const selectRes = await client.query(
          `SELECT id, prestation, "normeOriginale" FROM "${WORKSPACE_SCHEMA}"."opportunity" WHERE "numeroDevis" = $1 LIMIT 1`,
          [numeroDevis]
        );

        if (selectRes.rows.length === 0) {
          console.log('NOT FOUND');
          stats.notFound++;
          continue;
        }

        const opp = selectRes.rows[0];
        const current = [...(opp.prestation || [])].sort().join(',');
        const next    = [...newPrestations].sort().join(',');

        if (current === next && opp.normeOriginale === normeRaw) {
          console.log('déjà OK');
          stats.alreadyOk++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`[DRY-RUN] ${current || 'vide'} → ${next}`);
          stats.updated++;
          continue;
        }

        // Cast array to enum[]
        const enumArray = `{${newPrestations.join(',')}}`;
        await client.query(
          `UPDATE "${WORKSPACE_SCHEMA}"."opportunity"
           SET prestation = $1::text[]::"${WORKSPACE_SCHEMA}"."opportunity_prestation_enum"[],
               "normeOriginale" = $2,
               "updatedAt" = NOW()
           WHERE id = $3`,
          [enumArray, normeRaw, opp.id]
        );

        console.log(`OK  (${current || 'vide'} → ${next})`);
        stats.updated++;

      } catch (err) {
        console.log(`EXCEPTION: ${err.message.substring(0, 120)}`);
        stats.error++;
      }
    }
    console.log('');
  }

  await client.end();

  console.log('=== RÉSUMÉ ===');
  console.log(`  Mis à jour   : ${stats.updated}`);
  console.log(`  Déjà corrects: ${stats.alreadyOk}`);
  console.log(`  Non trouvés  : ${stats.notFound}`);
  console.log(`  Sans NORME   : ${stats.noNorme}`);
  console.log(`  Erreurs      : ${stats.error}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== UPDATE PRESTATIONS 20260413 ===');
  if (DRY_RUN) console.log('  Mode DRY-RUN activé\n');

  if (!SKIP_SCHEMA) {
    await updatePrestationSchema();
  } else {
    console.log('\n[--skip-schema] Phase 1 ignorée\n');
  }

  await updateOpportunities();
}

main().catch(err => {
  console.error('\nERREUR FATALE:', err.message);
  process.exit(1);
});
