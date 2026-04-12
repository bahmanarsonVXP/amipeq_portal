#!/usr/bin/env node
require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const https = require('https');
const http = require('http');

const TWENTY_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY;

if (!TWENTY_URL || !API_KEY) {
  console.error("Missing TWENTY_BASE_URL or TWENTY_API_KEY in .env");
  process.exit(1);
}

function postGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(TWENTY_URL);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ query, variables });
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: '/metadata',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function updateObjectLabel(id, singular, plural) {
  const query = `mutation UpdateOneObject($id: UUID!, $input: UpdateObjectPayload!) {
    updateOneObject(input: { id: $id, update: $input }) { id }
  }`;
  return postGraphQL(query, { id, input: { labelSingular: singular, labelPlural: plural } });
}

async function updateFieldLabel(id, label) {
  const query = `mutation UpdateOneField($id: UUID!, $input: UpdateFieldInput!) {
    updateOneField(input: { id: $id, update: $input }) { id }
  }`;
  return postGraphQL(query, { id, input: { label } });
}

async function main() {
  console.log("📖 Lecture du fichier twenty_metadata_fr.ods...");
  try { require.resolve('xlsx'); } catch(e) { console.error("Missing xlsx"); process.exit(1); }
  
  const xlsx = require('xlsx');
  const workbook = xlsx.readFile('twenty_metadata_fr.ods');
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
  
  const header = rows[0].map(c => String(c).trim());
  const colType = header.indexOf('Type');
  const colTechName = header.indexOf('Nom technique');
  const colLabelFR = header.indexOf('Label FR (à modifier)');
  
  const targets = { objects: {}, fields: {} };
  
  for (let i = 1; i < rows.length; i++) {
    const type = String(rows[i][colType]).trim();
    const name = String(rows[i][colTechName]).trim();
    const fr = String(rows[i][colLabelFR]).trim();
    if (!fr) continue;
    
    if (type === 'OBJET') {
        targets.objects[name.split('/')[0].trim()] = fr;
    } else if (type === 'champ') {
        targets.fields[name] = fr;
    }
  }
  
  console.log("🔍 Récupération des IDs actuels depuis le CRM...");
  
  let allObjects = [];
  let hasNextPage = true;
  let afterCursor = null;

  while (hasNextPage) {
    const cursorArg = afterCursor ? `, after: "${afterCursor}"` : '';
    const query = `query { objects(paging: {first: 50${cursorArg}}) { edges { node { id nameSingular labelSingular namePlural labelPlural fields(paging: {first: 100}) { edges { node { id name label isSystem } } } } } pageInfo { hasNextPage endCursor } } }`;
    const res = await postGraphQL(query);
    if(res.errors) throw new Error(JSON.stringify(res.errors));
    allObjects.push(...res.data.objects.edges.map(e => e.node));
    hasNextPage = res.data.objects.pageInfo.hasNextPage;
    afterCursor = res.data.objects.pageInfo.endCursor;
  }

  const updates = { objects: [], fields: [] };
  
  for (const obj of allObjects) {
      const targetObjFr = targets.objects[obj.nameSingular];
      if (targetObjFr) {
          const parts = targetObjFr.split('/');
          const expectedSingular = parts[0].trim();
          const expectedPlural = (parts[1] || parts[0] + 's').trim();
          
          if (obj.labelSingular !== expectedSingular || obj.labelPlural !== expectedPlural) {
              updates.objects.push({ id: obj.id, singular: expectedSingular, plural: expectedPlural, name: obj.nameSingular });
          }
      }
      
      for (const edge of obj.fields.edges) {
          const field = edge.node;
          const targetFieldFr = targets.fields[field.name];
          if (targetFieldFr && field.label !== targetFieldFr && !field.isSystem) {
              updates.fields.push({ id: field.id, label: targetFieldFr, name: `${obj.nameSingular}.${field.name}` });
          }
      }
  }
  
  console.log(`📊 À traduire : ${updates.objects.length} objets et ${updates.fields.length} champs.`);
  
  let successObj = 0, errorObj = 0;
  for (const u of updates.objects) {
      console.log(`  Mise à jour Objet [${u.name}] -> ${u.singular} / ${u.plural}`);
      const res = await updateObjectLabel(u.id, u.singular, u.plural);
      if (res.errors) { console.error(`   ❌ Erreur:`, res.errors[0].message); errorObj++; }
      else { successObj++; }
      await sleep(100);
  }
  
  let successField = 0, errorField = 0;
  for (const u of updates.fields) {
      console.log(`  Mise à jour Champ [${u.name}] -> ${u.label}`);
      const res = await updateFieldLabel(u.id, u.label);
      if (res.errors) { console.error(`   ❌ Erreur:`, res.errors[0].message); errorField++; }
      else { successField++; }
      await sleep(100);
  }
  
  console.log(`\n✅ Terminé ! Objets: ${successObj} OK, ${errorObj} ERR | Champs: ${successField} OK, ${errorField} ERR`);
}

main().catch(console.error);
