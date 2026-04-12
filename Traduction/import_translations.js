#!/usr/bin/env node
/**
 * Twenty CRM — Import des traductions depuis le TSV modifié
 * 
 * Usage:
 *   node import_translations.js <TWENTY_URL> <API_KEY> [fichier.tsv]
 * 
 * Exemple:
 *   node import_translations.js https://twenty-production-0500.up.railway.app "eyJhbG..." twenty_metadata_fr.tsv
 * 
 * Lit la colonne "Label FR" du TSV et renomme les objets/champs via l'API Metadata GraphQL.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const TWENTY_URL = (process.argv[2] || process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.argv[3] || process.env.TWENTY_API_KEY;
const TSV_FILE = process.argv[4] || 'twenty_metadata_fr.tsv';

if (!TWENTY_URL || !API_KEY) {
  console.error('Usage: node import_translations.js [TWENTY_URL] [API_KEY] [fichier.tsv]');
  console.error('Or set TWENTY_BASE_URL and TWENTY_API_KEY in ../.env');
  process.exit(1);
}

function postGraphQL(url, token, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ query, variables });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: '/metadata',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`HTTP request error: ${err.message}`));
    });
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateObjectLabel(objectId, labelSingular, labelPlural) {
  const query = `
    mutation UpdateOneObject($idToUpdate: UUID!, $input: UpdateObjectPayload!) {
      updateOneObject(input: { id: $idToUpdate, update: $input }) {
        id
        labelSingular
        labelPlural
      }
    }
  `;
  const variables = {
    idToUpdate: objectId,
    input: { labelSingular, labelPlural }
  };
  return postGraphQL(TWENTY_URL, API_KEY, query, variables);
}

async function updateFieldLabel(fieldId, label) {
  const query = `
    mutation UpdateOneField($idToUpdate: UUID!, $input: UpdateFieldInput!) {
      updateOneField(input: { id: $idToUpdate, update: $input }) {
        id
        label
      }
    }
  `;
  const variables = {
    idToUpdate: fieldId,
    input: { label }
  };
  try {
    return await postGraphQL(TWENTY_URL, API_KEY, query, variables);
  } catch (err) {
    throw new Error(`GraphQL error: ${err.message} (URL: ${TWENTY_URL}, Field: ${fieldId})`);
  }
}

async function main() {
  console.log('📖 Lecture du fichier', TSV_FILE, '...\n');

  if (!fs.existsSync(TSV_FILE)) {
    console.error(`❌ Fichier non trouvé: ${TSV_FILE}`);
    process.exit(1);
  }

  let rows;
  try {
    // Read TSV file as UTF-8 to preserve accented characters
    const content = fs.readFileSync(TSV_FILE, 'utf-8');
    rows = content.split('\n').map(line => line.split('\t'));
  } catch (err) {
    console.error(`❌ Erreur de lecture du fichier: ${err.message}`);
    process.exit(1);
  }

  // Enlever les lignes vides à la fin
  while (rows.length > 0 && rows[rows.length - 1].join('').trim() === '') {
    rows.pop();
  }

  if (rows.length === 0) {
    console.error('❌ Le fichier est vide.');
    process.exit(1);
  }

  // Parse header (flexible matching for encoding issues)
  const header = rows[0].map(c => String(c).trim());

  const findColumn = (patterns) => {
    for (let i = 0; i < header.length; i++) {
      const col = header[i];
      if (patterns.some(p => col.includes(p) || p.includes(col))) {
        return i;
      }
    }
    return -1;
  };

  const colType = findColumn(['Type']);
  const colObjectId = findColumn(['Objet ID']);
  const colFieldId = findColumn(['Champ ID']);
  const colTechName = findColumn(['Nom technique']);
  const colLabelEN = findColumn(['Label actuel', '(EN)']);
  const colLabelFR = findColumn(['Label FR', 'modifier']);

  if (colLabelFR === -1) {
    console.error('❌ Colonne "Label FR" non trouvée dans le fichier');
    console.error('   En-tête disponible:', header);
    process.exit(1);
  }

  const objectUpdates = [];
  const fieldUpdates = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const safeStr = (idx) => (cols[idx] !== undefined && cols[idx] !== null) ? String(cols[idx]).trim() : '';

    const type = safeStr(colType);
    const objectId = safeStr(colObjectId);
    const fieldId = safeStr(colFieldId);
    const techName = safeStr(colTechName);
    const labelEN = safeStr(colLabelEN);
    const labelFR = safeStr(colLabelFR);

    if (!labelFR) continue; // Skip empty translations

    if (type === 'OBJET') {
      // Parse "Singulier / Pluriel" format
      const parts = labelFR.split('/').map(s => s.trim());
      const singular = parts[0];
      const plural = parts[1] || parts[0] + 's';

      // Check if translation differs from current
      const currentParts = labelEN.split('/').map(s => s.trim());
      if (singular !== currentParts[0] || plural !== currentParts[1]) {
        objectUpdates.push({ objectId, singular, plural, techName, labelEN });
      }
    } else if (type.trim() === 'champ' && fieldId) {
      // Check if translation differs from current
      if (labelFR !== labelEN) {
        fieldUpdates.push({ fieldId, label: labelFR, objectId, techName, labelEN });
      }
    }
  }

  console.log(`📊 Modifications détectées:`);
  console.log(`   - ${objectUpdates.length} objets à renommer`);
  console.log(`   - ${fieldUpdates.length} champs à renommer`);
  console.log('');

  if (objectUpdates.length === 0 && fieldUpdates.length === 0) {
    console.log('✅ Rien à modifier. Vérifie que la colonne "Label FR" contient des traductions.');
    return;
  }

  // --- DRY RUN: show what will change ---
  console.log('📋 Aperçu des modifications:\n');

  console.log('OBJETS:');
  for (const u of objectUpdates) {
    console.log(`  ${u.labelEN}  →  ${u.singular} / ${u.plural}`);
  }

  console.log('\nCHAMPS:');
  for (const u of fieldUpdates) {
    console.log(`  ${u.labelEN}  →  ${u.label}  (${u.techName})`);
  }

  // Ask confirmation
  console.log(`\n⚠️  Appuie sur Entrée pour appliquer, ou Ctrl+C pour annuler...`);
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // --- Apply object updates ---
  let successObj = 0, errorObj = 0;
  for (const u of objectUpdates) {
    try {
      const result = await updateObjectLabel(u.objectId, u.singular, u.plural);
      if (result.errors) {
        console.error(`  ❌ Objet "${u.techName}": ${result.errors[0].message}`);
        errorObj++;
      } else {
        console.log(`  ✅ Objet: ${u.labelEN} → ${u.singular} / ${u.plural}`);
        successObj++;
      }
      await sleep(100); // Rate limiting
    } catch (err) {
      console.error(`  ❌ Objet "${u.techName}": ${err.message}`);
      if (process.env.DEBUG) console.error(`     Stack: ${err.stack}`);
      errorObj++;
    }
  }

  // --- Apply field updates ---
  let successField = 0, errorField = 0;
  for (const u of fieldUpdates) {
    try {
      const result = await updateFieldLabel(u.fieldId, u.label);
      if (result.errors) {
        console.error(`  ❌ Champ "${u.techName}": ${result.errors[0].message}`);
        errorField++;
      } else {
        console.log(`  ✅ Champ: ${u.labelEN} → ${u.label}`);
        successField++;
      }
      await sleep(100);
    } catch (err) {
      console.error(`  ❌ Champ "${u.techName}": ${err.message}`);
      errorField++;
    }
  }

  console.log(`\n🏁 Terminé!`);
  console.log(`   Objets: ${successObj} OK, ${errorObj} erreurs`);
  console.log(`   Champs: ${successField} OK, ${errorField} erreurs`);

  if (errorObj + errorField > 0) {
    console.log(`\n⚠️  Certaines modifications ont échoué. Vérifie les erreurs ci-dessus.`);
    console.log(`   Les champs système ne sont parfois pas modifiables.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
