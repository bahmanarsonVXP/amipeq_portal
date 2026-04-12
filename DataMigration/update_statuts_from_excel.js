#!/usr/bin/env node
/**
 * Mise à jour des statuts d'opportunités depuis la colonne Y du fichier Excel
 *
 * Colonnes utilisées:
 * - H (index 7): numeroDevis
 * - Y (index 24): statutPourImport (nouveau)
 *
 * Statuts valides:
 * - GAGNE
 * - PERDU
 * - EN_ATTENTE
 */

const xlsx = require('xlsx');
const { restRequest, graphqlRequest } = require('./lib/core/http');

const FILE = 'SUIVIS CLIENTS 2026_V2.xlsx';  // Avec espace !
const SHEETS = ['2023', '2024', '2025', '2026'];
const COL_NUMERO_DEVIS = 7;   // Colonne H
const COL_STATUT = 24;         // Colonne Y

const VALID_STATUTS = ['GAGNE', 'PERDU', 'EN_ATTENTE'];

// Mapping français → constantes TWENTY
const STATUT_MAPPING = {
  'Gagné': 'GAGNE',
  'gagné': 'GAGNE',
  'GAGNE': 'GAGNE',
  'Perdu': 'PERDU',
  'perdu': 'PERDU',
  'PERDU': 'PERDU',
  'En attente': 'EN_ATTENTE',
  'en attente': 'EN_ATTENTE',
  'EN_ATTENTE': 'EN_ATTENTE',
  'EN ATTENTE': 'EN_ATTENTE'
};

/**
 * Étape 1: Lecture Excel - Extrait les statuts à mettre à jour
 */
function readStatutsFromExcel() {
  console.log(`📖 Lecture du fichier ${FILE}...`);
  const wb = xlsx.readFile(FILE);
  const updates = [];

  for (const sheetName of SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.log(`⚠️  Onglet ${sheetName} non trouvé, ignoré`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const numeroDevis = row[COL_NUMERO_DEVIS];
      const statutPourImport = row[COL_STATUT];

      if (numeroDevis && statutPourImport) {
        const statutNormalized = STATUT_MAPPING[String(statutPourImport).trim()];

        updates.push({
          sheet: sheetName,
          row: i + 1,
          numeroDevis: String(numeroDevis).trim(),
          statutPourImport: statutNormalized || String(statutPourImport).trim(),
          statutOriginal: String(statutPourImport).trim()
        });
      }
    }
  }

  console.log(`✅ ${updates.length} lignes trouvées avec statut à importer\n`);
  return updates;
}

/**
 * Étape 2: Charger toutes les opportunités et créer un index
 * Utilise GraphQL avec pagination pour charger TOUTES les opportunités
 */
async function loadAllOpportunities() {
  console.log('🔄 Chargement de toutes les opportunités...');

  const allOpportunities = [];
  let hasMore = true;
  let cursor = null;
  let pageCount = 0;

  while (hasMore) {
    pageCount++;
    const query = `
      query GetOpportunities($first: Int!, $after: String) {
        opportunities(first: $first, after: $after) {
          edges {
            node {
              id
              numeroDevis
              statutDevis
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

    const result = await graphqlRequest(query, {
      first: 500,
      after: cursor
    });

    const edges = result.opportunities?.edges || [];
    const pageInfo = result.opportunities?.pageInfo || {};

    // Ajouter les opportunités de cette page
    edges.forEach(edge => {
      if (edge.node) {
        allOpportunities.push(edge.node);
      }
    });

    console.log(`  Page ${pageCount}: ${edges.length} opportunités (total: ${allOpportunities.length})`);

    hasMore = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  console.log(`✅ ${allOpportunities.length} opportunités chargées en ${pageCount} pages`);

  // Créer un index par numeroDevis pour recherche rapide
  const index = new Map();
  allOpportunities.forEach(opp => {
    if (opp.numeroDevis) {
      index.set(opp.numeroDevis, {
        id: opp.id,
        currentStatut: opp.statutDevis
      });
    }
  });

  console.log(`✅ Index créé pour ${index.size} opportunités avec numeroDevis\n`);
  return index;
}

/**
 * Étape 3: Mettre à jour le statut d'une opportunité
 */
async function updateStatut(opportunityId, nouveauStatut) {
  const result = await restRequest('PATCH', `/rest/opportunities/${opportunityId}`, {
    statutDevis: nouveauStatut
  });

  return result.statusCode === 200 || result.statusCode === 201;
}

/**
 * Étape 4: Traitement principal
 */
async function main() {
  const startTime = Date.now();

  // Parse arguments
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  if (isDryRun) {
    console.log('⚠️  MODE DRY RUN - Aucune modification ne sera effectuée\n');
  }

  try {
    // Lecture du fichier Excel
    const updates = readStatutsFromExcel();

    if (updates.length === 0) {
      console.log('⚠️  Aucune mise à jour à effectuer');
      return;
    }

    // Chargement de toutes les opportunités
    const opportunitiesIndex = await loadAllOpportunities();

    // Statistiques
    const stats = {
      success: 0,
      notFound: 0,
      errors: 0,
      invalid: 0,
      noChange: 0
    };

    const errors = [];

    console.log('🚀 Début des mises à jour...\n');

    // Traitement de chaque ligne
    for (let idx = 0; idx < updates.length; idx++) {
      const update = updates[idx];

      try {
        // Validation du statut
        if (!VALID_STATUTS.includes(update.statutPourImport)) {
          stats.invalid++;
          errors.push({
            type: 'invalid',
            ...update,
            error: `Statut invalide: "${update.statutOriginal}" → "${update.statutPourImport}"`
          });
          console.log(`❌ ${update.numeroDevis}: Statut invalide "${update.statutOriginal}"`);
          continue;
        }

        // Recherche de l'opportunité dans l'index
        const oppData = opportunitiesIndex.get(update.numeroDevis);

        if (!oppData) {
          stats.notFound++;
          errors.push({
            type: 'not_found',
            ...update
          });
          console.log(`⏭️  ${update.numeroDevis}: Non trouvée`);
          continue;
        }

        // Vérifier si le statut est déjà correct
        if (oppData.currentStatut === update.statutPourImport) {
          stats.noChange++;
          console.log(`➡️  ${update.numeroDevis}: Déjà ${update.statutPourImport}`);
          continue;
        }

        // Mise à jour
        if (isDryRun) {
          // Mode simulation - pas de requête API
          stats.success++;
          console.log(`🔄 [DRY RUN] ${update.numeroDevis}: ${oppData.currentStatut} → ${update.statutPourImport}`);
        } else {
          // Mode réel - mise à jour effective
          const success = await updateStatut(oppData.id, update.statutPourImport);

          if (success) {
            stats.success++;
            console.log(`✅ ${update.numeroDevis}: ${oppData.currentStatut} → ${update.statutPourImport}`);
          } else {
            stats.errors++;
            errors.push({
              type: 'update_failed',
              ...update,
              currentStatut: oppData.currentStatut
            });
            console.log(`❌ ${update.numeroDevis}: Échec mise à jour`);
          }
        }

      } catch (error) {
        stats.errors++;
        errors.push({
          type: 'exception',
          ...update,
          error: error.message
        });
        console.log(`❌ ${update.numeroDevis}: Erreur - ${error.message}`);
      }

      // Affichage progression tous les 50
      const total = stats.success + stats.notFound + stats.errors + stats.invalid + stats.noChange;
      if (total % 50 === 0 && total > 0) {
        console.log(`\n  📊 Progression: ${total}/${updates.length} (${Math.round(total/updates.length*100)}%)\n`);
      }
    }

    // Rapport final
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT FINAL\n');
    if (isDryRun) {
      console.log('⚠️  MODE: DRY RUN (simulation uniquement)\n');
    }
    console.log(`Temps d'exécution:   ${duration}s (${Math.round(duration/60)} min)`);
    console.log(`Total traité:        ${updates.length}`);
    console.log(`✅ Mises à jour:     ${stats.success}`);
    console.log(`➡️  Déjà corrects:    ${stats.noChange}`);
    console.log(`⏭️  Non trouvées:     ${stats.notFound}`);
    console.log(`⚠️  Statuts invalides: ${stats.invalid}`);
    console.log(`❌ Erreurs:          ${stats.errors}`);

    if (errors.length > 0) {
      console.log('\n📝 DÉTAILS DES ERREURS:\n');
      const errorLimit = 20;
      errors.slice(0, errorLimit).forEach(e => {
        console.log(`  ${e.numeroDevis} (${e.sheet}, ligne ${e.row})`);
        console.log(`    Type: ${e.type}`);
        if (e.error) console.log(`    Erreur: ${e.error}`);
        if (e.currentStatut) console.log(`    Statut actuel: ${e.currentStatut}`);
        console.log('');
      });
      if (errors.length > errorLimit) {
        console.log(`  ... et ${errors.length - errorLimit} autres erreurs`);
      }
    }

    console.log('='.repeat(60));

    // Code de sortie
    if (stats.errors > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { readStatutsFromExcel, loadAllOpportunities, updateStatut };
