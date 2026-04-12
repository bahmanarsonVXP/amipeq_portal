/**
 * update_statuts_2025_2026.js
 *
 * Met à jour le stage et statutDevis des opportunités dont la couleur de cellule
 * a changé entre l'ancienne version du fichier et SUIVIS_CLIENTS_2026_20260402.xlsx
 *
 * 2025 : 5 changements
 * 2026 : 14 changements
 */

const { graphqlRequest, restRequest } = require('./lib/core/http');

// Liste des mises à jour à appliquer
// stage/statutDevis mapping:
//   VERT  → stage: GAGNE,       statutDevis: GAGNE
//   BLANC → stage: DEVIS_ENVOYE, statutDevis: EN_ATTENTE
const UPDATES = [
  // ── 2025 ──────────────────────────────────────────────────────────────
  { numeroDevis: '108853-CL-25354', client: 'SCP LARTIGUES LANNES',        stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109016-CL-25570', client: 'COLLEGE HENRI GUILLAUMET',    stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109018-CL-25572', client: 'COLLEGE PIERRE MATRAJA',      stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109059-CL-25627', client: 'LYCEE JEAN PIERRE TIMBAUD',   stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '108896-CL-25412', client: 'COLLEGE PAUL ELUARD',         stage: 'DEVIS_ENVOYE', statutDevis: 'EN_ATTENTE' },

  // ── 2026 ──────────────────────────────────────────────────────────────
  { numeroDevis: '109093-CL-26044', client: 'ECOLE LA PROVIDENCE - LA GUERCHE DE BRETAGNE', stage: 'GAGNE', statutDevis: 'GAGNE' },
  { numeroDevis: '109094-CL-26045', client: 'COLLEGE SAINT JOSEPH - LA GUERCHE DE BRETAGNE', stage: 'GAGNE', statutDevis: 'GAGNE' },
  { numeroDevis: '107488-CL-26057', client: 'COLLEGE DU VAUCLIN',          stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '106222-CL-26060', client: 'INSTITUTION NOTRE DAME DE SAINT JEAN', stage: 'GAGNE', statutDevis: 'GAGNE' },
  { numeroDevis: '109104-CL-26070', client: 'ENSEMBLE SCOLAIRE DE MAILLÉ', stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109133-CL-26101', client: 'ENSEMBLE SCOLAIRE NOTRE DAME DES CHENES', stage: 'GAGNE', statutDevis: 'GAGNE' },
  { numeroDevis: '105629-CL-26103', client: 'COLLEGE JANE NARDAL',         stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109136-CL-26107', client: 'LYCEE LEOPOLD ELFORT',        stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109141-CL-26112', client: 'FIDREX',                      stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '105465-CL-26116', client: 'ECOLE OR TORAH',              stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '108599-CL-26117', client: 'LYCEE OR TORAH',              stage: 'GAGNE',        statutDevis: 'GAGNE' },
  { numeroDevis: '109147-CL-26120', client: 'COLLEGE SAINT HELIER',        stage: 'GAGNE',        statutDevis: 'GAGNE' },
  // Note: 109133-CL-26101 apparaît 3× dans la comparaison (ancien fichier avait -1 et -2)
  // → une seule mise à jour envoyée, le doublon sera ignoré (même ID trouvé)
];

async function findOpportunityId(numeroDevis) {
  const query = `
    query FindOpp($filter: OpportunityFilterInput!) {
      opportunities(filter: $filter) {
        edges {
          node {
            id
            name
            stage
            numeroDevis
          }
        }
        totalCount
      }
    }
  `;
  const result = await graphqlRequest(query, {
    filter: { numeroDevis: { eq: numeroDevis } }
  });
  const edges = result.opportunities?.edges || [];
  if (edges.length === 0) return null;
  return edges[0].node;
}

async function updateOpportunity(id, stage, statutDevis) {
  const result = await restRequest('PATCH', `/rest/opportunities/${id}`, {
    stage,
    statutDevis,
  });
  return result;
}

async function main() {
  console.log('=== MISE À JOUR STATUTS 2025/2026 ===\n');

  const stats = { updated: 0, notFound: 0, error: 0 };

  for (const upd of UPDATES) {
    process.stdout.write(`  ${upd.numeroDevis} | ${upd.client.substring(0, 35).padEnd(35)} | → ${upd.stage} ... `);

    try {
      const opp = await findOpportunityId(upd.numeroDevis);

      if (!opp) {
        console.log('NOT FOUND');
        stats.notFound++;
        continue;
      }

      const result = await updateOpportunity(opp.id, upd.stage, upd.statutDevis);

      if (result.statusCode === 200 || result.statusCode === 201) {
        console.log(`OK (id: ${opp.id})`);
        stats.updated++;
      } else {
        console.log(`ERROR ${result.statusCode}: ${JSON.stringify(result.data).substring(0, 100)}`);
        stats.error++;
      }
    } catch (err) {
      console.log(`EXCEPTION: ${err.message}`);
      stats.error++;
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Mis à jour : ${stats.updated}`);
  console.log(`  Non trouvés: ${stats.notFound}`);
  console.log(`  Erreurs    : ${stats.error}`);
}

main().catch(console.error);
