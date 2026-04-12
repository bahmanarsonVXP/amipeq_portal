require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const https = require('https');
const http = require('http');

const TWENTY_URL = process.env.TWENTY_BASE_URL.replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY;

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
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
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

async function main() {
  console.log("Lecture du fichier ODS...");
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
        const parts = name.split('/');
        targets.objects[parts[0].trim()] = fr;
    } else if (type === 'champ') {
        targets.fields[name] = fr;
    }
  }
  
  console.log("Récupération des objets actuels...");
  const objRes = await postGraphQL(`query { objects(paging: {first: 100}) { edges { node { id nameSingular labelSingular fields(paging: {first: 100}) { edges { node { name label isSystem } } } } } } }`);
  
  let remainingObjects = 0;
  let remainingFields = 0;
  
  console.log("\n--- ÉLÉMENTS RESTANT À TRADUIRE ---");
  for (const edge of objRes.data.objects.edges) {
      const obj = edge.node;
      const targetObjFr = targets.objects[obj.nameSingular];
      if (targetObjFr) {
          const expectedSingular = targetObjFr.split('/')[0].trim();
          if (obj.labelSingular !== expectedSingular) {
              console.log(`[OBJET] ${obj.nameSingular}: Actuel = "${obj.labelSingular}", Attendu = "${expectedSingular}"`);
              remainingObjects++;
          }
      }
      
      for (const fEdge of obj.fields.edges) {
          const field = fEdge.node;
          const targetFieldFr = targets.fields[field.name];
          if (targetFieldFr && field.label !== targetFieldFr && !field.isSystem) {
              console.log(`  [CHAMP] ${obj.nameSingular}.${field.name}: Actuel = "${field.label}", Attendu = "${targetFieldFr}"`);
              remainingFields++;
          }
      }
  }
  
  console.log(`\nRésumé: ${remainingObjects} objets et ${remainingFields} champs valides (non-système) attendent encore leur traduction.`);
}
main().catch(console.error);
