const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = process.env.TWENTY_BASE_URL || 'https://twenty-production-0500.up.railway.app';
const API_KEY = process.env.TWENTY_API_KEY || '';

const COMPANY_ID = '4d4c981c-158e-45ee-8cbe-eda6d67a8eba';
const OPPORTUNITY_ID = '6d634f87-9c75-4b42-a0ef-ea63140fcb2a';

function gqlRequest(endpoint, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: url.hostname,
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
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Parse error: ${body.substring(0, 500)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Build department options
function buildDepartmentOptions() {
  const depts = [
    ['01', 'Ain'], ['02', 'Aisne'], ['03', 'Allier'], ['04', 'Alpes-de-Haute-Provence'], ['05', 'Hautes-Alpes'],
    ['06', 'Alpes-Maritimes'], ['07', 'Ardeche'], ['08', 'Ardennes'], ['09', 'Ariege'], ['10', 'Aube'],
    ['11', 'Aude'], ['12', 'Aveyron'], ['13', 'Bouches-du-Rhone'], ['14', 'Calvados'], ['15', 'Cantal'],
    ['16', 'Charente'], ['17', 'Charente-Maritime'], ['18', 'Cher'], ['19', 'Correze'],
    ['2A', 'Corse-du-Sud'], ['2B', 'Haute-Corse'],
    ['21', 'Cote-d-Or'], ['22', 'Cotes-d-Armor'], ['23', 'Creuse'],
    ['24', 'Dordogne'], ['25', 'Doubs'], ['26', 'Drome'], ['27', 'Eure'], ['28', 'Eure-et-Loir'], ['29', 'Finistere'],
    ['30', 'Gard'], ['31', 'Haute-Garonne'], ['32', 'Gers'], ['33', 'Gironde'], ['34', 'Herault'], ['35', 'Ille-et-Vilaine'],
    ['36', 'Indre'], ['37', 'Indre-et-Loire'], ['38', 'Isere'], ['39', 'Jura'], ['40', 'Landes'], ['41', 'Loir-et-Cher'],
    ['42', 'Loire'], ['43', 'Haute-Loire'], ['44', 'Loire-Atlantique'], ['45', 'Loiret'], ['46', 'Lot'], ['47', 'Lot-et-Garonne'],
    ['48', 'Lozere'], ['49', 'Maine-et-Loire'], ['50', 'Manche'], ['51', 'Marne'], ['52', 'Haute-Marne'], ['53', 'Mayenne'],
    ['54', 'Meurthe-et-Moselle'], ['55', 'Meuse'], ['56', 'Morbihan'], ['57', 'Moselle'], ['58', 'Nievre'], ['59', 'Nord'],
    ['60', 'Oise'], ['61', 'Orne'], ['62', 'Pas-de-Calais'], ['63', 'Puy-de-Dome'], ['64', 'Pyrenees-Atlantiques'], ['65', 'Hautes-Pyrenees'],
    ['66', 'Pyrenees-Orientales'], ['67', 'Bas-Rhin'], ['68', 'Haut-Rhin'], ['69', 'Rhone'], ['70', 'Haute-Saone'], ['71', 'Saone-et-Loire'],
    ['72', 'Sarthe'], ['73', 'Savoie'], ['74', 'Haute-Savoie'], ['75', 'Paris'], ['76', 'Seine-Maritime'], ['77', 'Seine-et-Marne'],
    ['78', 'Yvelines'], ['79', 'Deux-Sevres'], ['80', 'Somme'], ['81', 'Tarn'], ['82', 'Tarn-et-Garonne'], ['83', 'Var'],
    ['84', 'Vaucluse'], ['85', 'Vendee'], ['86', 'Vienne'], ['87', 'Haute-Vienne'], ['88', 'Vosges'], ['89', 'Yonne'],
    ['90', 'Territoire de Belfort'], ['91', 'Essonne'], ['92', 'Hauts-de-Seine'], ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'], ['95', 'Val-d-Oise'],
    ['971', 'Guadeloupe'], ['972', 'Martinique'], ['973', 'Guyane'], ['974', 'La Reunion']
  ];
  return depts.map(([num, name], i) => ({
    value: `${num}_${name.toUpperCase().replace(/[- ']/g, '_').replace(/__+/g, '_')}`,
    label: `${num} - ${name}`,
    color: 'blue',
    position: i
  }));
}

// Fields that failed - SELECT/MULTI_SELECT with options, and TEXT/DATE with isNullable=false
const FAILED_FIELDS = [
  // Company SELECT fields
  { objectId: COMPANY_ID, name: 'numeroSociete', label: 'N° Société', type: 'TEXT', isNullable: true, description: 'Identifiant unique historique du client' },
  { objectId: COMPANY_ID, name: 'departementNumero', label: 'N° Département', type: 'TEXT', isNullable: true, description: 'Code département brut pour filtres' },
  {
    objectId: COMPANY_ID, name: 'typeClient', label: 'Type de client', type: 'SELECT', isNullable: true,
    defaultValue: "'AUTRE'",
    options: [
      { value: 'ETABLISSEMENT_SCOLAIRE', label: 'Établissement scolaire', color: 'blue', position: 0 },
      { value: 'MAIRIE_COLLECTIVITE', label: 'Mairie-Collectivité', color: 'green', position: 1 },
      { value: 'ENTREPRISE_TPE_PME', label: 'Entreprise TPE-PME', color: 'orange', position: 2 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 3 }
    ]
  },
  {
    objectId: COMPANY_ID, name: 'sousType', label: 'Sous-type', type: 'SELECT', isNullable: true,
    options: [
      { value: 'COLLEGE', label: 'Collège', color: 'blue', position: 0 },
      { value: 'LYCEE', label: 'Lycée', color: 'blue', position: 1 },
      { value: 'ECOLE', label: 'École', color: 'blue', position: 2 },
      { value: 'MAIRIE', label: 'Mairie', color: 'green', position: 3 },
      { value: 'COMMUNAUTE_DE_COMMUNES', label: 'Communauté de communes', color: 'green', position: 4 },
      { value: 'EHPAD', label: 'EHPAD', color: 'purple', position: 5 },
      { value: 'ASSOCIATION', label: 'Association', color: 'yellow', position: 6 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 7 }
    ]
  },
  {
    objectId: COMPANY_ID, name: 'prospecteur', label: 'Prospecteur', type: 'SELECT', isNullable: true,
    options: [
      { value: 'ALEX', label: 'ALEX', color: 'blue', position: 0 },
      { value: 'CL', label: 'CL', color: 'green', position: 1 }
    ]
  },
  {
    objectId: COMPANY_ID, name: 'departement', label: 'Département', type: 'SELECT', isNullable: true,
    options: buildDepartmentOptions()
  },
  {
    objectId: COMPANY_ID, name: 'statutClient', label: 'Statut client', type: 'SELECT', isNullable: true,
    options: [
      { value: 'PROSPECT', label: 'Prospect', color: 'yellow', position: 0 },
      { value: 'CLIENT_ACTIF', label: 'Client actif', color: 'green', position: 1 },
      { value: 'CLIENT_INACTIF', label: 'Client inactif', color: 'gray', position: 2 },
      { value: 'PERDU', label: 'Perdu', color: 'red', position: 3 }
    ]
  },
  {
    objectId: COMPANY_ID, name: 'internat', label: 'Internat', type: 'SELECT', isNullable: true,
    options: [
      { value: 'OUI', label: 'Oui', color: 'green', position: 0 },
      { value: 'NON', label: 'Non', color: 'red', position: 1 },
      { value: 'PETIT_ETABLISSEMENT', label: 'Petit établissement', color: 'gray', position: 2 }
    ]
  },
  // Opportunity fields
  { objectId: OPPORTUNITY_ID, name: 'numeroDevis', label: 'N° Devis', type: 'TEXT', isNullable: true },
  { objectId: OPPORTUNITY_ID, name: 'dateDevis', label: 'Date devis', type: 'DATE', isNullable: true },
  {
    objectId: OPPORTUNITY_ID, name: 'prestation', label: 'Prestation', type: 'MULTI_SELECT', isNullable: true,
    options: [
      { value: 'DUERP', label: 'DUERP', color: 'blue', position: 0 },
      { value: 'PPMS', label: 'PPMS', color: 'green', position: 1 },
      { value: 'RPS', label: 'RPS', color: 'purple', position: 2 },
      { value: 'PSE', label: 'PSE', color: 'orange', position: 3 },
      { value: 'COVID', label: 'COVID', color: 'red', position: 4 },
      { value: 'RGPD', label: 'RGPD', color: 'yellow', position: 5 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 6 }
    ]
  },
  {
    objectId: OPPORTUNITY_ID, name: 'naturePrestation', label: 'Nature prestation', type: 'SELECT', isNullable: true,
    options: [
      { value: 'CREATION', label: 'Création', color: 'blue', position: 0 },
      { value: 'MISE_A_JOUR', label: 'Mise à jour', color: 'green', position: 1 },
      { value: 'CONTRAT_MAJ', label: 'Contrat MAJ', color: 'orange', position: 2 }
    ]
  },
  {
    objectId: OPPORTUNITY_ID, name: 'modalite', label: 'Modalité', type: 'SELECT', isNullable: true,
    options: [
      { value: 'SUR_SITE', label: 'Sur site', color: 'blue', position: 0 },
      { value: 'A_DISTANCE', label: 'À distance', color: 'green', position: 1 },
      { value: 'SUR_SITE_OU_A_DISTANCE', label: 'Sur site ou à distance', color: 'orange', position: 2 }
    ]
  },
  {
    objectId: OPPORTUNITY_ID, name: 'statutDevis', label: 'Statut devis', type: 'SELECT', isNullable: true,
    options: [
      { value: 'GAGNE', label: 'Gagné', color: 'green', position: 0 },
      { value: 'REFUSE', label: 'Refusé', color: 'red', position: 1 },
      { value: 'EN_ATTENTE', label: 'En attente', color: 'yellow', position: 2 }
    ]
  },
];

async function createFieldWithVariables(field) {
  const variables = {
    input: {
      field: {
        name: field.name,
        label: field.label,
        type: field.type,
        objectMetadataId: field.objectId,
        isNullable: field.isNullable,
      }
    }
  };
  if (field.description) variables.input.field.description = field.description;
  if (field.defaultValue) variables.input.field.defaultValue = field.defaultValue;
  if (field.options) variables.input.field.options = field.options;

  const mutation = `
    mutation CreateField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id name label type
      }
    }
  `;

  return gqlRequest('/metadata', mutation, variables);
}

async function getExistingFields(objectId) {
  const result = await gqlRequest('/metadata', `{
    object(id: "${objectId}") {
      fields(paging: { first: 200 }) {
        edges { node { name type isCustom } }
      }
    }
  }`);
  return new Set(result.data.object.fields.edges.map(e => e.node.name));
}

async function main() {
  console.log('=== PHASE 1 FIX : CRÉATION DES CHAMPS MANQUANTS ===\n');

  const existingCompany = await getExistingFields(COMPANY_ID);
  const existingOpp = await getExistingFields(OPPORTUNITY_ID);

  let created = 0, skipped = 0, errors = 0;

  for (const field of FAILED_FIELDS) {
    const existing = field.objectId === COMPANY_ID ? existingCompany : existingOpp;
    const objName = field.objectId === COMPANY_ID ? 'Company' : 'Opportunity';

    if (existing.has(field.name)) {
      console.log(`  SKIP: ${objName}.${field.name} (existe déjà)`);
      skipped++;
      continue;
    }

    const result = await createFieldWithVariables(field);
    if (result.data && result.data.createOneField) {
      console.log(`  OK: ${objName}.${field.name} (${field.type}) → id: ${result.data.createOneField.id}`);
      created++;
    } else {
      console.log(`  ERR: ${objName}.${field.name} → ${JSON.stringify(result.errors || result)}`);
      errors++;
    }
    await sleep(200);
  }

  console.log(`\n=== RÉSUMÉ ===`);
  console.log(`Créés: ${created} | Ignorés: ${skipped} | Erreurs: ${errors}`);
}

main().catch(console.error);
