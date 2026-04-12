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

// Build department SELECT options
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

// Company fields
const COMPANY_FIELDS = [
  { name: 'numeroSociete', label: 'N° Société', type: 'TEXT', isNullable: false, description: 'Identifiant unique historique du client' },
  {
    name: 'typeClient', label: 'Type de client', type: 'SELECT', isNullable: false,
    defaultValue: "'AUTRE'",
    options: [
      { value: 'ETABLISSEMENT_SCOLAIRE', label: 'Établissement scolaire', color: 'blue', position: 0 },
      { value: 'MAIRIE_COLLECTIVITE', label: 'Mairie-Collectivité', color: 'green', position: 1 },
      { value: 'ENTREPRISE_TPE_PME', label: 'Entreprise TPE-PME', color: 'orange', position: 2 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 3 }
    ]
  },
  {
    name: 'sousType', label: 'Sous-type', type: 'SELECT', isNullable: true,
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
    name: 'prospecteur', label: 'Prospecteur', type: 'SELECT', isNullable: true,
    options: [
      { value: 'ALEX', label: 'ALEX', color: 'blue', position: 0 },
      { value: 'CL', label: 'CL', color: 'green', position: 1 }
    ]
  },
  {
    name: 'departement', label: 'Département', type: 'SELECT', isNullable: false,
    options: buildDepartmentOptions()
  },
  { name: 'departementNumero', label: 'N° Département', type: 'TEXT', isNullable: false, description: 'Code département brut pour filtres' },
  { name: 'nombreSites', label: 'Nombre de sites', type: 'NUMBER', isNullable: true },
  { name: 'activite', label: 'Activité', type: 'TEXT', isNullable: true },
  { name: 'tarifApplicable', label: 'Tarif applicable', type: 'TEXT', isNullable: true },
  {
    name: 'statutClient', label: 'Statut client', type: 'SELECT', isNullable: true,
    options: [
      { value: 'PROSPECT', label: 'Prospect', color: 'yellow', position: 0 },
      { value: 'CLIENT_ACTIF', label: 'Client actif', color: 'green', position: 1 },
      { value: 'CLIENT_INACTIF', label: 'Client inactif', color: 'gray', position: 2 },
      { value: 'PERDU', label: 'Perdu', color: 'red', position: 3 }
    ]
  },
  { name: 'nombreEleves', label: "Nombre d'élèves", type: 'NUMBER', isNullable: true },
  { name: 'capacite', label: 'Capacité', type: 'NUMBER', isNullable: true },
  { name: 'restaurantScolaire', label: 'Restaurant scolaire', type: 'BOOLEAN', isNullable: true },
  {
    name: 'internat', label: 'Internat', type: 'SELECT', isNullable: true,
    options: [
      { value: 'OUI', label: 'Oui', color: 'green', position: 0 },
      { value: 'NON', label: 'Non', color: 'red', position: 1 },
      { value: 'PETIT_ETABLISSEMENT', label: 'Petit établissement', color: 'gray', position: 2 }
    ]
  },
  { name: 'installationsSportives', label: 'Installations sportives', type: 'TEXT', isNullable: true },
  { name: 'ateliers', label: 'Ateliers', type: 'BOOLEAN', isNullable: true },
  { name: 'batiments', label: 'Bâtiments', type: 'TEXT', isNullable: true },
  { name: 'nombreHabitants', label: "Nombre d'habitants", type: 'NUMBER', isNullable: true },
  { name: 'nombreSalaries', label: 'Nombre de salariés', type: 'NUMBER', isNullable: true },
  { name: 'equipements', label: 'Équipements', type: 'TEXT', isNullable: true, description: 'Liste libre des équipements' },
];

// Opportunity fields
const OPPORTUNITY_FIELDS = [
  { name: 'numeroDevis', label: 'N° Devis', type: 'TEXT', isNullable: false },
  { name: 'dateDevis', label: 'Date devis', type: 'DATE', isNullable: false },
  {
    name: 'prestation', label: 'Prestation', type: 'MULTI_SELECT', isNullable: false,
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
    name: 'naturePrestation', label: 'Nature prestation', type: 'SELECT', isNullable: true,
    options: [
      { value: 'CREATION', label: 'Création', color: 'blue', position: 0 },
      { value: 'MISE_A_JOUR', label: 'Mise à jour', color: 'green', position: 1 },
      { value: 'CONTRAT_MAJ', label: 'Contrat MAJ', color: 'orange', position: 2 }
    ]
  },
  {
    name: 'modalite', label: 'Modalité', type: 'SELECT', isNullable: true,
    options: [
      { value: 'SUR_SITE', label: 'Sur site', color: 'blue', position: 0 },
      { value: 'A_DISTANCE', label: 'À distance', color: 'green', position: 1 },
      { value: 'SUR_SITE_OU_A_DISTANCE', label: 'Sur site ou à distance', color: 'orange', position: 2 }
    ]
  },
  { name: 'montantRemise', label: 'Montant remisé', type: 'CURRENCY', isNullable: true },
  { name: 'tauxRemise', label: 'Taux de remise (%)', type: 'NUMBER', isNullable: true },
  {
    name: 'statutDevis', label: 'Statut devis', type: 'SELECT', isNullable: false,
    options: [
      { value: 'GAGNE', label: 'Gagné', color: 'green', position: 0 },
      { value: 'REFUSE', label: 'Refusé', color: 'red', position: 1 },
      { value: 'EN_ATTENTE', label: 'En attente', color: 'yellow', position: 2 }
    ]
  },
  { name: 'dateRelance', label: 'Date relance', type: 'DATE', isNullable: true },
  { name: 'dateEnvoiDocs', label: 'Date envoi docs', type: 'DATE', isNullable: true },
  { name: 'anneeDevis', label: 'Année devis', type: 'NUMBER', isNullable: true },
  { name: 'normeOriginale', label: 'Norme originale', type: 'TEXT', isNullable: true, description: 'Valeur brute Excel conservée pour traçabilité' },
];

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

async function createField(objectId, field) {
  const input = {
    name: field.name,
    label: field.label,
    type: field.type,
    objectMetadataId: objectId,
    isNullable: field.isNullable,
  };
  if (field.description) input.description = field.description;
  if (field.defaultValue) input.defaultValue = field.defaultValue;
  if (field.options) input.options = field.options;

  const optionsJson = field.options ? `, options: ${JSON.stringify(field.options)}` : '';
  const defaultJson = field.defaultValue ? `, defaultValue: ${JSON.stringify(field.defaultValue)}` : '';
  const descJson = field.description ? `, description: ${JSON.stringify(field.description)}` : '';

  const mutation = `
    mutation {
      createOneField(input: {
        field: {
          name: ${JSON.stringify(field.name)}
          label: ${JSON.stringify(field.label)}
          type: ${field.type}
          objectMetadataId: "${objectId}"
          isNullable: ${field.isNullable}
          ${field.description ? `description: ${JSON.stringify(field.description)}` : ''}
          ${field.defaultValue ? `defaultValue: ${JSON.stringify(field.defaultValue)}` : ''}
          ${field.options ? `options: ${JSON.stringify(field.options)}` : ''}
        }
      }) {
        id name label type
      }
    }
  `;

  return gqlRequest('/metadata', mutation);
}

async function main() {
  console.log('=== PHASE 1 : CRÉATION DES CHAMPS PERSONNALISÉS ===\n');

  // Check existing fields
  const existingCompanyFields = await getExistingFields(COMPANY_ID);
  const existingOpportunityFields = await getExistingFields(OPPORTUNITY_ID);

  let created = 0, skipped = 0, errors = 0;

  // Create Company fields
  console.log('--- COMPANY FIELDS ---');
  for (const field of COMPANY_FIELDS) {
    if (existingCompanyFields.has(field.name)) {
      console.log(`  SKIP: ${field.name} (existe déjà)`);
      skipped++;
      continue;
    }
    const result = await createField(COMPANY_ID, field);
    if (result.data && result.data.createOneField) {
      console.log(`  OK: ${field.name} (${field.type}) → id: ${result.data.createOneField.id}`);
      created++;
    } else {
      console.log(`  ERR: ${field.name} → ${JSON.stringify(result.errors || result)}`);
      errors++;
    }
    await sleep(150);
  }

  // Create Opportunity fields
  console.log('\n--- OPPORTUNITY FIELDS ---');
  for (const field of OPPORTUNITY_FIELDS) {
    if (existingOpportunityFields.has(field.name)) {
      console.log(`  SKIP: ${field.name} (existe déjà)`);
      skipped++;
      continue;
    }
    const result = await createField(OPPORTUNITY_ID, field);
    if (result.data && result.data.createOneField) {
      console.log(`  OK: ${field.name} (${field.type}) → id: ${result.data.createOneField.id}`);
      created++;
    } else {
      console.log(`  ERR: ${field.name} → ${JSON.stringify(result.errors || result)}`);
      errors++;
    }
    await sleep(150);
  }

  console.log(`\n=== RÉSUMÉ PHASE 1 ===`);
  console.log(`Créés: ${created} | Ignorés (existants): ${skipped} | Erreurs: ${errors}`);
}

main().catch(console.error);
