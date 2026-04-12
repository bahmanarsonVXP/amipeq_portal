#!/usr/bin/env node
/**
 * Création de tous les champs customs pour AMIPEQ
 *
 * Company: 19 champs
 * Opportunity: 12 champs
 */

const https = require('https');
const fs = require('fs');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE_URL = (process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.TWENTY_API_KEY || '';

if (!BASE_URL || !API_KEY) {
  console.error('❌ TWENTY_BASE_URL et TWENTY_API_KEY requis dans .env');
  process.exit(1);
}

console.log('🔗 Instance:', BASE_URL);

function gqlRequest(endpoint, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
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
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// DÉPARTEMENT - 97 options
// ============================================================================
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

// ============================================================================
// DÉFINITION DES CHAMPS
// ============================================================================

const COMPANY_FIELDS = [
  {
    name: 'numeroSociete',
    label: 'N° Société',
    type: 'NUMBER',
    description: 'Identifiant unique historique du client',
    isNullable: false,
  },
  {
    name: 'departement',
    label: 'Département',
    type: 'SELECT',
    description: 'Département du client (extraction auto depuis CP)',
    isNullable: false,
    options: buildDepartmentOptions()
  },
  {
    name: 'departementNumero',
    label: 'N° Département',
    type: 'TEXT',
    description: 'Numéro brut du département (ex: "13", "971")',
    isNullable: false,
  },
  {
    name: 'typeClient',
    label: 'Type de client',
    type: 'SELECT',
    description: 'Catégorie principale du client',
    isNullable: false,
    defaultValue: "'AUTRE'",
    options: [
      { value: 'ETABLISSEMENT_SCOLAIRE', label: 'Établissement scolaire', color: 'blue', position: 0 },
      { value: 'MAIRIE_COLLECTIVITE', label: 'Mairie-Collectivité', color: 'green', position: 1 },
      { value: 'ENTREPRISE_TPE_PME', label: 'Entreprise TPE-PME', color: 'orange', position: 2 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 3 }
    ]
  },
  {
    name: 'sousType',
    label: 'Sous-type',
    type: 'SELECT',
    description: 'Précision sur le type de client',
    isNullable: true,
    options: [
      { value: 'COLLEGE', label: 'Collège', color: 'blue', position: 0 },
      { value: 'LYCEE', label: 'Lycée', color: 'blue', position: 1 },
      { value: 'ECOLE', label: 'École', color: 'blue', position: 2 },
      { value: 'MAIRIE', label: 'Mairie', color: 'green', position: 3 },
      { value: 'COMMUNAUTE_COMMUNES', label: 'Communauté de communes', color: 'green', position: 4 },
      { value: 'EHPAD', label: 'EHPAD', color: 'purple', position: 5 },
      { value: 'ASSOCIATION', label: 'Association', color: 'orange', position: 6 },
      { value: 'AUTRE', label: 'Autre', color: 'gray', position: 7 }
    ]
  },
  {
    name: 'prospecteur',
    label: 'Prospecteur',
    type: 'SELECT',
    description: 'Commercial en charge de la prospection',
    isNullable: true,
    options: [
      { value: 'ALEX', label: 'ALEX', color: 'blue', position: 0 },
      { value: 'CL', label: 'CL', color: 'green', position: 1 }
    ]
  },
  {
    name: 'nombreSites',
    label: 'Nombre de sites',
    type: 'NUMBER',
    description: 'Nombre de sites/établissements',
    isNullable: true,
  },
  {
    name: 'activite',
    label: 'Activité',
    type: 'TEXT',
    description: 'Secteur d\'activité',
    isNullable: true,
  },
  {
    name: 'tarifApplicable',
    label: 'Tarif applicable',
    type: 'TEXT',
    description: 'Grille tarifaire applicable',
    isNullable: true,
  },
  {
    name: 'statutClient',
    label: 'Statut client',
    type: 'SELECT',
    description: 'Statut commercial du client',
    isNullable: true,
    options: [
      { value: 'PROSPECT', label: 'Prospect', color: 'yellow', position: 0 },
      { value: 'CLIENT_ACTIF', label: 'Client actif', color: 'green', position: 1 },
      { value: 'CLIENT_INACTIF', label: 'Client inactif', color: 'gray', position: 2 },
      { value: 'PERDU', label: 'Perdu', color: 'red', position: 3 }
    ]
  },
  {
    name: 'nombreEleves',
    label: 'Nombre d\'élèves',
    type: 'NUMBER',
    description: 'Effectif élèves (établissements scolaires)',
    isNullable: true,
  },
  {
    name: 'capacite',
    label: 'Capacité',
    type: 'NUMBER',
    description: 'Capacité d\'accueil',
    isNullable: true,
  },
  {
    name: 'restaurantScolaire',
    label: 'Restaurant scolaire',
    type: 'BOOLEAN',
    description: 'Présence d\'un restaurant scolaire',
    isNullable: true,
  },
  {
    name: 'internat',
    label: 'Internat',
    type: 'SELECT',
    description: 'Type d\'internat',
    isNullable: true,
    options: [
      { value: 'OUI', label: 'Oui', color: 'green', position: 0 },
      { value: 'NON', label: 'Non', color: 'gray', position: 1 },
      { value: 'PETIT_ETABLISSEMENT', label: 'Petit établissement', color: 'blue', position: 2 }
    ]
  },
  {
    name: 'installationsSportives',
    label: 'Installations sportives',
    type: 'TEXT',
    description: 'Liste des installations sportives',
    isNullable: true,
  },
  {
    name: 'ateliers',
    label: 'Ateliers',
    type: 'BOOLEAN',
    description: 'Présence d\'ateliers',
    isNullable: true,
  },
  {
    name: 'batiments',
    label: 'Bâtiments',
    type: 'TEXT',
    description: 'Description des bâtiments',
    isNullable: true,
  },
  {
    name: 'nombreHabitants',
    label: 'Nombre d\'habitants',
    type: 'NUMBER',
    description: 'Population (mairies)',
    isNullable: true,
  },
  {
    name: 'nombreSalaries',
    label: 'Nombre de salariés',
    type: 'NUMBER',
    description: 'Effectif salarié',
    isNullable: true,
  },
  {
    name: 'equipements',
    label: 'Équipements',
    type: 'TEXT',
    description: 'Liste des équipements (format libre)',
    isNullable: true,
  }
];

const OPPORTUNITY_FIELDS = [
  {
    name: 'numeroDevis',
    label: 'N° Devis',
    type: 'TEXT',
    description: 'Numéro unique du devis',
    isNullable: false,
  },
  {
    name: 'dateDevis',
    label: 'Date devis',
    type: 'DATE_TIME',
    description: 'Date d\'émission du devis',
    isNullable: false,
  },
  {
    name: 'prestation',
    label: 'Prestation',
    type: 'MULTI_SELECT',
    description: 'Type(s) de prestation(s)',
    isNullable: false,
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
    name: 'naturePrestation',
    label: 'Nature prestation',
    type: 'SELECT',
    description: 'Type de prestation (création, MAJ, contrat)',
    isNullable: true,
    options: [
      { value: 'CREATION', label: 'Création', color: 'green', position: 0 },
      { value: 'MISE_A_JOUR', label: 'Mise à jour', color: 'blue', position: 1 },
      { value: 'CONTRAT_MAJ', label: 'Contrat MAJ', color: 'purple', position: 2 }
    ]
  },
  {
    name: 'modalite',
    label: 'Modalité',
    type: 'SELECT',
    description: 'Modalité d\'intervention',
    isNullable: true,
    options: [
      { value: 'SUR_SITE', label: 'Sur site', color: 'green', position: 0 },
      { value: 'A_DISTANCE', label: 'À distance', color: 'blue', position: 1 },
      { value: 'SUR_SITE_OU_A_DISTANCE', label: 'Sur site ou à distance', color: 'purple', position: 2 }
    ]
  },
  {
    name: 'montantRemise',
    label: 'Montant remisé',
    type: 'CURRENCY',
    description: 'Montant après remise',
    isNullable: true,
  },
  {
    name: 'tauxRemise',
    label: 'Taux remise (%)',
    type: 'NUMBER',
    description: 'Pourcentage de remise appliquée',
    isNullable: true,
  },
  {
    name: 'statutDevis',
    label: 'Statut devis',
    type: 'SELECT',
    description: 'Statut du devis (extrait de la couleur Excel)',
    isNullable: false,
    defaultValue: "'EN_ATTENTE'",
    options: [
      { value: 'GAGNE', label: 'Gagné', color: 'green', position: 0 },
      { value: 'REFUSE', label: 'Refusé', color: 'red', position: 1 },
      { value: 'EN_ATTENTE', label: 'En attente', color: 'yellow', position: 2 }
    ]
  },
  {
    name: 'dateRelance',
    label: 'Date relance',
    type: 'DATE_TIME',
    description: 'Date de relance prévue',
    isNullable: true,
  },
  {
    name: 'dateEnvoiDocs',
    label: 'Date envoi docs',
    type: 'DATE_TIME',
    description: 'Date d\'envoi des documents',
    isNullable: true,
  },
  {
    name: 'anneeDevis',
    label: 'Année devis',
    type: 'NUMBER',
    description: 'Année du devis (2023-2026)',
    isNullable: true,
  },
  {
    name: 'normeOriginale',
    label: 'Norme originale',
    type: 'TEXT',
    description: 'Valeur NORME brute depuis Excel (traçabilité)',
    isNullable: true,
  }
];

// ============================================================================
// MAIN
// ============================================================================

async function getObjectIds() {
  console.log('\n📋 Récupération des IDs objets...');

  const query = `
    query {
      objects(paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            labelSingular
          }
        }
      }
    }
  `;

  const result = await gqlRequest('/metadata', query);

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
  }

  const objects = result.data.objects.edges;
  const company = objects.find(o => o.node.nameSingular === 'company');
  const opportunity = objects.find(o => o.node.nameSingular === 'opportunity');

  if (!company || !opportunity) {
    throw new Error('Objets company/opportunity non trouvés');
  }

  console.log(`  ✅ Company: ${company.node.id}`);
  console.log(`  ✅ Opportunity: ${opportunity.node.id}`);

  return {
    companyId: company.node.id,
    opportunityId: opportunity.node.id
  };
}

async function getExistingFields(objectId) {
  // Récupérer tous les champs de l'objet via une query sur l'objet lui-même
  const query = `
    query GetObjectFields($objectId: UUID!) {
      objects(filter: { id: { eq: $objectId } }) {
        edges {
          node {
            id
            fields(paging: { first: 200 }) {
              edges {
                node {
                  id
                  name
                  label
                  type
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await gqlRequest('/metadata', query, { objectId });

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
  }

  const obj = result.data.objects.edges[0];
  if (!obj) {
    return [];
  }

  return obj.node.fields.edges.map(e => e.node);
}

async function createField(objectId, field) {
  const mutation = `
    mutation CreateField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id
        name
        label
        type
      }
    }
  `;

  const input = {
    field: {
      name: field.name,
      label: field.label,
      type: field.type,
      objectMetadataId: objectId,
      description: field.description || '',
      isNullable: field.isNullable !== false,
    }
  };

  // Ajouter defaultValue si défini
  if (field.defaultValue) {
    input.field.defaultValue = field.defaultValue;
  }

  // Ajouter options pour SELECT/MULTI_SELECT
  if (field.options) {
    input.field.options = field.options;
  }

  const result = await gqlRequest('/metadata', mutation, { input });

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors, null, 2));
  }

  return result.data.createOneField;
}

async function main() {
  console.log('🚀 Création des champs customs AMIPEQ\n');

  try {
    // 1. Récupérer les IDs
    const { companyId, opportunityId } = await getObjectIds();

    // 2. Créer les champs Company
    console.log(`\n📦 Company — ${COMPANY_FIELDS.length} champs à créer`);
    const existingCompanyFields = await getExistingFields(companyId);
    const existingCompanyNames = new Set(existingCompanyFields.map(f => f.name));

    let createdCompany = 0, skippedCompany = 0;

    for (const field of COMPANY_FIELDS) {
      if (existingCompanyNames.has(field.name)) {
        console.log(`  ⏭️  ${field.name} — déjà existant`);
        skippedCompany++;
        continue;
      }

      try {
        const created = await createField(companyId, field);
        console.log(`  ✅ ${field.name} — créé (${created.type})`);
        createdCompany++;
        await sleep(200); // Rate limiting
      } catch (err) {
        console.error(`  ❌ ${field.name} — ${err.message.substring(0, 200)}`);
      }
    }

    // 3. Créer les champs Opportunity
    console.log(`\n💼 Opportunity — ${OPPORTUNITY_FIELDS.length} champs à créer`);
    const existingOppFields = await getExistingFields(opportunityId);
    const existingOppNames = new Set(existingOppFields.map(f => f.name));

    let createdOpp = 0, skippedOpp = 0;

    for (const field of OPPORTUNITY_FIELDS) {
      if (existingOppNames.has(field.name)) {
        console.log(`  ⏭️  ${field.name} — déjà existant`);
        skippedOpp++;
        continue;
      }

      try {
        const created = await createField(opportunityId, field);
        console.log(`  ✅ ${field.name} — créé (${created.type})`);
        createdOpp++;
        await sleep(200);
      } catch (err) {
        console.error(`  ❌ ${field.name} — ${err.message.substring(0, 200)}`);
      }
    }

    // 4. Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ TERMINÉ\n');
    console.log(`Company:     ${createdCompany} créés, ${skippedCompany} existants`);
    console.log(`Opportunity: ${createdOpp} créés, ${skippedOpp} existants`);

  } catch (err) {
    console.error('\n❌ Erreur fatale:', err.message);
    process.exit(1);
  }
}

main();
