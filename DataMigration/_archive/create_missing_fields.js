#!/usr/bin/env node
const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

const COMPANY_ID = 'd7fd7751-b173-4f12-afe9-d783c3170863';
const OPP_ID = '55ef6e7d-af89-4544-9e7b-e686334c4033';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('/metadata', BASE_URL);
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildDepartmentOptions() {
  const depts = [
    ['01', 'Ain'], ['02', 'Aisne'], ['03', 'Allier'], ['04', 'Alpes-de-Haute-Provence'],
    ['05', 'Hautes-Alpes'], ['06', 'Alpes-Maritimes'], ['07', 'Ardèche'], ['08', 'Ardennes'],
    ['09', 'Ariège'], ['10', 'Aube'], ['11', 'Aude'], ['12', 'Aveyron'],
    ['13', 'Bouches-du-Rhône'], ['14', 'Calvados'], ['15', 'Cantal'], ['16', 'Charente'],
    ['17', 'Charente-Maritime'], ['18', 'Cher'], ['19', 'Corrèze'],
    ['2A', 'Corse-du-Sud'], ['2B', 'Haute-Corse'],
    ['21', 'Côte-d\'Or'], ['22', 'Côtes-d\'Armor'], ['23', 'Creuse'],
    ['24', 'Dordogne'], ['25', 'Doubs'], ['26', 'Drôme'], ['27', 'Eure'],
    ['28', 'Eure-et-Loir'], ['29', 'Finistère'],
    ['30', 'Gard'], ['31', 'Haute-Garonne'], ['32', 'Gers'], ['33', 'Gironde'],
    ['34', 'Hérault'], ['35', 'Ille-et-Vilaine'],
    ['36', 'Indre'], ['37', 'Indre-et-Loire'], ['38', 'Isère'], ['39', 'Jura'],
    ['40', 'Landes'], ['41', 'Loir-et-Cher'],
    ['42', 'Loire'], ['43', 'Haute-Loire'], ['44', 'Loire-Atlantique'], ['45', 'Loiret'],
    ['46', 'Lot'], ['47', 'Lot-et-Garonne'],
    ['48', 'Lozère'], ['49', 'Maine-et-Loire'], ['50', 'Manche'], ['51', 'Marne'],
    ['52', 'Haute-Marne'], ['53', 'Mayenne'],
    ['54', 'Meurthe-et-Moselle'], ['55', 'Meuse'], ['56', 'Morbihan'], ['57', 'Moselle'],
    ['58', 'Nièvre'], ['59', 'Nord'],
    ['60', 'Oise'], ['61', 'Orne'], ['62', 'Pas-de-Calais'], ['63', 'Puy-de-Dôme'],
    ['64', 'Pyrénées-Atlantiques'], ['65', 'Hautes-Pyrénées'],
    ['66', 'Pyrénées-Orientales'], ['67', 'Bas-Rhin'], ['68', 'Haut-Rhin'], ['69', 'Rhône'],
    ['70', 'Haute-Saône'], ['71', 'Saône-et-Loire'],
    ['72', 'Sarthe'], ['73', 'Savoie'], ['74', 'Haute-Savoie'], ['75', 'Paris'],
    ['76', 'Seine-Maritime'], ['77', 'Seine-et-Marne'],
    ['78', 'Yvelines'], ['79', 'Deux-Sèvres'], ['80', 'Somme'], ['81', 'Tarn'],
    ['82', 'Tarn-et-Garonne'], ['83', 'Var'],
    ['84', 'Vaucluse'], ['85', 'Vendée'], ['86', 'Vienne'], ['87', 'Haute-Vienne'],
    ['88', 'Vosges'], ['89', 'Yonne'],
    ['90', 'Territoire de Belfort'], ['91', 'Essonne'], ['92', 'Hauts-de-Seine'],
    ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'], ['95', 'Val-d\'Oise'],
    ['971', 'Guadeloupe'], ['972', 'Martinique'], ['973', 'Guyane'], ['974', 'La Réunion']
  ];

  return depts.map(([num, name], i) => ({
    value: `DEPT_${num}_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/__+/g, '_')}`,
    label: `${num} - ${name}`,
    color: 'blue',
    position: i
  }));
}

async function createField(objectId, field) {
  const mutation = `
    mutation CreateField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id name label type
      }
    }
  `;

  const input = { field };
  const result = await gql(mutation, { input });

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors, null, 2));
  }

  return result.data.createOneField;
}

async function main() {
  console.log('📝 Création des champs manquants...\n');

  // Company: departement, departementNumero (numeroSociete déjà créé)
  console.log('📦 Company:');

  try {
    const dept = await createField(COMPANY_ID, {
      name: 'departement',
      label: 'Département',
      type: 'SELECT',
      objectMetadataId: COMPANY_ID,
      description: 'Département du client (extraction auto depuis CP)',
      isNullable: true,
      options: buildDepartmentOptions()
    });
    console.log('  ✅ departement —', dept.id);
  } catch (err) {
    console.error('  ❌ departement —', err.message.substring(0, 300));
  }

  await sleep(300);

  try {
    const deptNum = await createField(COMPANY_ID, {
      name: 'departementNumero',
      label: 'N° Département',
      type: 'TEXT',
      objectMetadataId: COMPANY_ID,
      description: 'Numéro brut du département (ex: "13", "971")',
      isNullable: true,
    });
    console.log('  ✅ departementNumero —', deptNum.id);
  } catch (err) {
    console.error('  ❌ departementNumero —', err.message.substring(0, 300));
  }

  // Opportunity: numeroDevis, dateDevis, prestation
  console.log('\n💼 Opportunity:');

  await sleep(300);

  try {
    const numDevis = await createField(OPP_ID, {
      name: 'numeroDevis',
      label: 'N° Devis',
      type: 'TEXT',
      objectMetadataId: OPP_ID,
      description: 'Numéro unique du devis',
      isNullable: true,
    });
    console.log('  ✅ numeroDevis —', numDevis.id);
  } catch (err) {
    console.error('  ❌ numeroDevis —', err.message.substring(0, 300));
  }

  await sleep(300);

  try {
    const dateDevis = await createField(OPP_ID, {
      name: 'dateDevis',
      label: 'Date devis',
      type: 'DATE_TIME',
      objectMetadataId: OPP_ID,
      description: 'Date d\'émission du devis',
      isNullable: true,
    });
    console.log('  ✅ dateDevis —', dateDevis.id);
  } catch (err) {
    console.error('  ❌ dateDevis —', err.message.substring(0, 300));
  }

  await sleep(300);

  try {
    const presta = await createField(OPP_ID, {
      name: 'prestation',
      label: 'Prestation',
      type: 'MULTI_SELECT',
      objectMetadataId: OPP_ID,
      description: 'Type(s) de prestation(s)',
      isNullable: true,
      options: [
        { value: 'DUERP', label: 'DUERP', color: 'blue', position: 0 },
        { value: 'PPMS', label: 'PPMS', color: 'green', position: 1 },
        { value: 'RPS', label: 'RPS', color: 'purple', position: 2 },
        { value: 'PSE', label: 'PSE', color: 'orange', position: 3 },
        { value: 'COVID', label: 'COVID', color: 'red', position: 4 },
        { value: 'RGPD', label: 'RGPD', color: 'yellow', position: 5 },
        { value: 'AUTRE', label: 'Autre', color: 'gray', position: 6 }
      ]
    });
    console.log('  ✅ prestation —', presta.id);
  } catch (err) {
    console.error('  ❌ prestation —', err.message.substring(0, 300));
  }

  console.log('\n✅ Terminé !');
}

main().catch(console.error);
