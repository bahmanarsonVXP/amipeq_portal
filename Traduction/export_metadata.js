#!/usr/bin/env node
/**
 * Twenty CRM — Export des métadonnées (objets + champs) vers TSV
 * v2 — Pagination correcte pour récupérer TOUS les champs
 * 
 * Usage:
 *   node export_metadata.js <TWENTY_URL> <API_KEY>
 * 
 * Exemple:
 *   node export_metadata.js https://twenty-production-7352.up.railway.app "eyJhbG..."
 * 
 * Génère: twenty_metadata_fr.tsv + twenty_metadata_backup.json
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const TWENTY_URL = (process.argv[2] || process.env.TWENTY_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.argv[3] || process.env.TWENTY_API_KEY;

if (!TWENTY_URL || !API_KEY) {
  console.error('Usage: node export_metadata.js [TWENTY_URL] [API_KEY]');
  console.error('Or set TWENTY_BASE_URL and TWENTY_API_KEY in ../.env');
  process.exit(1);
}

// --- Traductions françaises pré-remplies ---
const OBJECT_TRANSLATIONS = {
  'person': 'Contact', 'people': 'Contacts',
  'company': 'Entreprise', 'companies': 'Entreprises',
  'opportunity': 'Opportunité', 'opportunities': 'Opportunités',
  'note': 'Note', 'notes': 'Notes',
  'task': 'Tâche', 'tasks': 'Tâches',
  'noteTarget': 'Cible de note', 'taskTarget': 'Cible de tâche',
  'attachment': 'Pièce jointe', 'attachments': 'Pièces jointes',
  'favorite': 'Favori', 'favorites': 'Favoris',
  'view': 'Vue', 'views': 'Vues',
  'webhook': 'Webhook', 'webhooks': 'Webhooks',
  'workspaceMember': 'Membre', 'workspaceMembers': 'Membres',
  'message': 'Message', 'messages': 'Messages',
  'calendarEvent': 'Événement', 'calendarEvents': 'Événements',
  'workflow': 'Workflow', 'workflows': 'Workflows',
};

const FIELD_TRANSLATIONS = {
  'name': 'Nom', 'firstName': 'Prénom', 'lastName': 'Nom de famille',
  'email': 'E-mail', 'emails': 'E-mails',
  'phone': 'Téléphone', 'phones': 'Téléphones',
  'city': 'Ville', 'address': 'Adresse',
  'jobTitle': 'Fonction', 'linkedinLink': 'LinkedIn',
  'xLink': 'X (Twitter)', 'avatarUrl': 'Avatar',
  'position': 'Position', 'createdBy': 'Créé par',
  'createdAt': 'Date de création', 'updatedAt': 'Date de modification',
  'deletedAt': 'Date de suppression',
  'domainName': 'Nom de domaine', 'employees': 'Effectifs',
  'idealCustomerProfile': 'Profil client idéal',
  'annualRecurringRevenue': 'Revenu annuel récurrent',
  'accountOwner': 'Responsable du compte',
  'stage': 'Étape', 'amount': 'Montant',
  'closeDate': 'Date de clôture', 'probability': 'Probabilité',
  'pointOfContact': 'Point de contact',
  'company': 'Entreprise', 'people': 'Contacts', 'person': 'Contact',
  'title': 'Titre', 'body': 'Contenu',
  'status': 'Statut', 'dueAt': 'Échéance',
  'assignee': 'Assigné à', 'description': 'Description',
  'type': 'Type', 'currency': 'Devise',
  'searchVector': 'Vecteur de recherche',
};

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
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fetch all objects (paginated)
async function fetchAllObjects() {
  let allObjects = [];
  let hasNextPage = true;
  let afterCursor = null;

  while (hasNextPage) {
    const cursorArg = afterCursor ? `, after: "${afterCursor}"` : '';
    const query = `
      query {
        objects(paging: { first: 50${cursorArg} }) {
          edges {
            node {
              id
              nameSingular
              namePlural
              labelSingular
              labelPlural
              description
              isCustom
              isActive
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await postGraphQL(query);
    if (result.errors) {
      console.error('GraphQL errors (objects):', JSON.stringify(result.errors, null, 2));
      break;
    }

    const edges = result.data.objects.edges;
    allObjects.push(...edges.map(e => e.node));
    hasNextPage = result.data.objects.pageInfo.hasNextPage;
    afterCursor = result.data.objects.pageInfo.endCursor;
  }

  return allObjects;
}

// Fetch ALL fields for one object (paginated separately)
async function fetchAllFieldsForObject(objectId, objectName) {
  let allFields = [];
  let hasNextPage = true;
  let afterCursor = null;

  while (hasNextPage) {
    const cursorArg = afterCursor ? `, after: "${afterCursor}"` : '';
    const query = `
      query {
        objects(filter: { id: { eq: "${objectId}" } }) {
          edges {
            node {
              fields(paging: { first: 50${cursorArg} }) {
                edges {
                  node {
                    id
                    name
                    label
                    description
                    type
                    isCustom
                    isActive
                    isSystem
                  }
                  cursor
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      }
    `;

    const result = await postGraphQL(query);
    if (result.errors) {
      console.error(`  ⚠️  Erreur pour ${objectName}:`, result.errors[0]?.message);
      break;
    }

    const objNode = result.data.objects.edges[0]?.node;
    if (!objNode) break;

    const fieldEdges = objNode.fields.edges;
    allFields.push(...fieldEdges.map(e => e.node));
    hasNextPage = objNode.fields.pageInfo.hasNextPage;
    afterCursor = objNode.fields.pageInfo.endCursor;
  }

  return allFields;
}

async function main() {
  console.log('🔍 Récupération des métadonnées depuis', TWENTY_URL, '...\n');

  // 1. Fetch all objects
  console.log('📦 Récupération des objets...');
  const objects = await fetchAllObjects();
  console.log(`   ${objects.length} objets trouvés\n`);

  // 2. For each active object, fetch ALL fields with pagination
  console.log('📋 Récupération des champs (objet par objet)...');
  const objectsWithFields = [];

  const activeObjects = objects
    .filter(o => o.isActive)
    .sort((a, b) => {
      if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
      return (a.labelSingular || a.nameSingular).localeCompare(b.labelSingular || b.nameSingular);
    });

  for (const obj of activeObjects) {
    const fields = await fetchAllFieldsForObject(obj.id, obj.nameSingular);
    objectsWithFields.push({ ...obj, fields });
    console.log(`   ${obj.labelSingular || obj.nameSingular}: ${fields.length} champs`);
    await sleep(50); // gentle rate limiting
  }

  // 3. Build TSV
  console.log('\n📄 Génération du TSV...');
  const rows = [];

  rows.push([
    'Type', 'Objet ID', 'Champ ID', 'Nom technique',
    'Label actuel (EN)', 'Label FR (à modifier)',
    'Description', 'Type de champ', 'Custom?', 'Actif?', 'Système?'
  ].join('\t'));

  let totalFields = 0;

  for (const obj of objectsWithFields) {
    const objLabel = obj.labelSingular || obj.nameSingular;
    const objLabelPlural = obj.labelPlural || obj.namePlural || '';

    const frSingular = OBJECT_TRANSLATIONS[obj.nameSingular] || '';
    const frPlural = OBJECT_TRANSLATIONS[obj.namePlural] || '';
    const frLabel = frSingular ? `${frSingular} / ${frPlural}` : '';

    rows.push([
      'OBJET', obj.id, '',
      `${obj.nameSingular} / ${obj.namePlural}`,
      `${objLabel} / ${objLabelPlural}`,
      frLabel,
      obj.description || '', '',
      obj.isCustom ? 'Oui' : 'Non',
      obj.isActive ? 'Oui' : 'Non', ''
    ].join('\t'));

    const sortedFields = obj.fields
      .filter(f => f.isActive)
      .sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
        if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
        return (a.label || a.name).localeCompare(b.label || b.name);
      });

    for (const field of sortedFields) {
      const frField = FIELD_TRANSLATIONS[field.name] || '';
      rows.push([
        '  champ', obj.id, field.id,
        field.name,
        field.label || field.name,
        frField,
        field.description || '',
        field.type || '',
        field.isCustom ? 'Oui' : 'Non',
        field.isActive ? 'Oui' : 'Non',
        field.isSystem ? 'Oui' : 'Non'
      ].join('\t'));
      totalFields++;
    }
  }

  // Write TSV
  fs.writeFileSync('twenty_metadata_fr.tsv', rows.join('\n'), 'utf-8');
  console.log(`\n✅ Fichier généré: twenty_metadata_fr.tsv`);
  console.log(`   ${activeObjects.length} objets, ${totalFields} champs au total`);

  // Write JSON backup
  const backup = objectsWithFields.map(obj => ({
    id: obj.id, nameSingular: obj.nameSingular, namePlural: obj.namePlural,
    labelSingular: obj.labelSingular, labelPlural: obj.labelPlural, isCustom: obj.isCustom,
    fields: obj.fields.map(f => ({
      id: f.id, name: f.name, label: f.label,
      type: f.type, isCustom: f.isCustom, isSystem: f.isSystem,
    }))
  }));
  fs.writeFileSync('twenty_metadata_backup.json', JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`💾 Backup JSON: twenty_metadata_backup.json`);

  console.log(`\n📋 Prochaines étapes:`);
  console.log(`   1. Ouvre twenty_metadata_fr.tsv dans Excel`);
  console.log(`   2. Remplis/modifie la colonne F "Label FR (à modifier)"`);
  console.log(`   3. Sauvegarde en TSV (séparateur tabulation)`);
  console.log(`   4. Lance: node import_translations.js ${TWENTY_URL} "TA_CLE" twenty_metadata_fr.tsv`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
