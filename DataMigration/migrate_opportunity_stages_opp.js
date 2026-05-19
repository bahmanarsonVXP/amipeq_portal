#!/usr/bin/env node
/**
 * Migration Twenty : champ opportunity `stage` → codes OPP_*.
 *
 * Phases :
 *   --schema-add   Ajoute les options OPP_* en conservant les anciennes (pour pouvoir PATCHer les lignes).
 *   --migrate-data Met à jour chaque opportunité (stage + statutDevis cohérent).
 *   --schema-final Remplace les options du champ par le jeu final (7 × OPP_* uniquement).
 *   --repair-statut Réaligne stage depuis statutDevis (GAGNE→OPP_WON, PERDU→OPP_LOST) — utile après schema-final Twenty.
 *   --all          Enchaîne schema-add → migrate-data → schema-final → repair-statut.
 *
 * Usage :
 *   node migrate_opportunity_stages_opp.js --dry-run --all
 *   node migrate_opportunity_stages_opp.js --all
 */

const minimist = require('minimist');
const { metadataRequest, graphqlRequest } = require('./lib/core/http');
const {
  STAGE_FIELD_OPTIONS_FOR_TWENTY,
  mapLegacyStageToOpp,
  stageToStatutDevis,
  isOppStageSchemaReady,
  OPP,
} = require('./lib/core/opportunity-stages');

/** Cible stage : legacy + cohérence statutDevis (Twenty peut remettre le default metadata sur stage). */
function resolveTargetStage(node) {
  const { stage, statutDevis } = node;
  const sd = statutDevis || '';
  if (sd === 'GAGNE' && stage !== OPP.WON) return OPP.WON;
  if (sd === 'PERDU' && stage !== OPP.LOST) return OPP.LOST;
  return mapLegacyStageToOpp(stage) || stage;
}

const args = minimist(process.argv.slice(2));
const DRY = Boolean(args['dry-run'] || args.dryRun);

async function getOpportunityObjectId() {
  const data = await metadataRequest(`{
    objects(paging: { first: 100 }) {
      edges { node { id nameSingular } }
    }
  }`);
  const edge = data.objects.edges.find((e) => e.node.nameSingular === 'opportunity');
  if (!edge) throw new Error('Objet metadata opportunity introuvable');
  return edge.node.id;
}

async function getStageField() {
  const oppObjId = await getOpportunityObjectId();
  const data = await metadataRequest(`{
    object(id: "${oppObjId}") {
      fields(paging: { first: 300 }) {
        edges { node { id name type options } }
      }
    }
  }`);
  const field = data.object.fields.edges.map((e) => e.node).find((f) => f.name === 'stage');
  if (!field) throw new Error('Champ stage introuvable sur opportunity');
  return field;
}

const UPDATE_FIELD = `
  mutation UpdateStageField($input: UpdateOneFieldMetadataInput!) {
    updateOneField(input: $input) {
      id
      name
      options
    }
  }
`;

async function phaseSchemaAdd() {
  console.log('\n=== schema-add : ajouter options OPP_* ===\n');
  const field = await getStageField();
  const existing = field.options || [];
  if (isOppStageSchemaReady(existing)) {
    console.log('  Déjà prêt (toutes les valeurs OPP_* présentes). Skip.\n');
    return;
  }
  const have = new Set(existing.map((o) => o.value));
  /* Positions distinctes des legacy (0–6) : Twenty refuse les doublons si on réutilise 0–6 en parallèle */
  const toAppend = STAGE_FIELD_OPTIONS_FOR_TWENTY.filter((o) => !have.has(o.value)).map((o, i) => ({
    ...o,
    position: 100 + i,
  }));
  if (toAppend.length === 0) {
    console.log('  Rien à ajouter.\n');
    return;
  }
  const merged = [...existing, ...toAppend];
  console.log(`  Field id: ${field.id}`);
  console.log(`  Ajout de ${toAppend.length} option(s): ${toAppend.map((o) => o.value).join(', ')}`);
  if (DRY) {
    console.log('  [dry-run] metadata non modifiée.\n');
    return;
  }
  await metadataRequest(UPDATE_FIELD, {
    input: { id: field.id, update: { options: merged } },
  });
  console.log('  OK\n');
}

async function phaseMigrateData() {
  console.log('\n=== migrate-data : enregistrements ===\n');
  const field = await getStageField();
  if (!isOppStageSchemaReady(field.options || []) && !DRY) {
    throw new Error('Exécuter --schema-add avant --migrate-data (options OPP_* manquantes).');
  }

  const UPDATE_OPP = `
    mutation MigrateOppStage($id: ID!, $stage: String!, $statutDevis: String!) {
      updateOpportunity(id: $id, data: { stage: $stage, statutDevis: $statutDevis }) {
        id
        stage
        statutDevis
      }
    }
  `;

  let after = null;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const listQuery = `
    query MigrateOppList($first: Int!, $after: String) {
      opportunities(first: $first, after: $after, orderBy: { createdAt: AscNullsLast }) {
        pageInfo { hasNextPage endCursor }
        edges { node { id stage statutDevis } }
      }
    }
  `;

  for (;;) {
    const variables = { first: 200 };
    if (after != null) variables.after = after;
    const data = await graphqlRequest(listQuery, variables);
    const conn = data.opportunities;
    for (const e of conn.edges) {
      const { id, stage } = e.node;
      const nextStage = resolveTargetStage(e.node);
      const nextSd = stageToStatutDevis(nextStage);
      if (nextStage === stage && nextSd === (e.node.statutDevis || '')) {
        skipped++;
        continue;
      }
      if (DRY) {
        console.log(`  [dry-run] ${id} ${stage} → ${nextStage} (statutDevis ${nextSd})`);
        updated++;
        continue;
      }
      try {
        await graphqlRequest(UPDATE_OPP, { id, stage: nextStage, statutDevis: nextSd });
        updated++;
        if (updated % 50 === 0) process.stdout.write(`  … ${updated} mis à jour\r`);
      } catch (err) {
        errors++;
        console.error(`  ERREUR ${id}:`, err.message || err);
      }
    }
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  console.log(`\n  Mis à jour: ${updated}, inchangés: ${skipped}, erreurs: ${errors}\n`);
}

/** Twenty ne renvoie pas toujours toutes les lignes avec orderBy+after ; filtre explicite stage ≠ terminale. */
async function phaseRepairStatutDevis() {
  console.log('\n=== repair-statut : GAGNE/PERDU → stage cohérent ===\n');
  const UPDATE_OPP = `
    mutation MigrateOppStage($id: ID!, $stage: String!, $statutDevis: String!) {
      updateOpportunity(id: $id, data: { stage: $stage, statutDevis: $statutDevis }) {
        id
        stage
        statutDevis
      }
    }
  `;
  let fixed = 0;
  for (const { statut, stage } of [
    { statut: 'GAGNE', stage: OPP.WON },
    { statut: 'PERDU', stage: OPP.LOST },
  ]) {
    const filter = {
      and: [{ statutDevis: { eq: statut } }, { stage: { neq: stage } }],
    };
    for (;;) {
      const data = await graphqlRequest(
        `
        query RepairList($first: Int!, $filter: OpportunityFilterInput!) {
          opportunities(first: $first, filter: $filter, orderBy: { updatedAt: DescNullsLast }) {
            edges { node { id stage statutDevis } }
          }
        }
      `,
        { first: 200, filter },
      );
      const conn = data.opportunities;
      if (conn.edges.length === 0) break;
      for (const e of conn.edges) {
        const n = e.node;
        if (DRY) {
          console.log(`  [dry-run] ${n.id} ${n.stage} → ${stage} (${n.statutDevis})`);
          fixed++;
          continue;
        }
        try {
          await graphqlRequest(UPDATE_OPP, { id: n.id, stage, statutDevis: statut });
          fixed++;
          if (fixed % 50 === 0) process.stdout.write(`  … ${fixed} corrigés\r`);
        } catch (err) {
          console.error(`  ERREUR ${n.id}:`, err.message || err);
        }
      }
    }
  }
  console.log(`\n  Corrigés: ${fixed}\n`);
}

async function phaseSchemaFinal() {
  console.log('\n=== schema-final : options = jeu OPP_* uniquement ===\n');
  const field = await getStageField();
  const opts = field.options || [];

  if (!isOppStageSchemaReady(opts)) {
    if (DRY) {
      console.log('  [dry-run] Skip schema-final (exécuter sans --dry-run après --schema-add + --migrate-data).\n');
      return;
    }
    throw new Error('Options OPP_* incomplètes — exécuter --schema-add puis --migrate-data avant --schema-final.');
  }
  const oppOnly = STAGE_FIELD_OPTIONS_FOR_TWENTY.map((def) => {
    const found = opts.find((o) => o.value === def.value);
    if (!found) {
      throw new Error(`Option manquante dans Twenty: ${def.value} — relancer --schema-add`);
    }
    return {
      id: found.id,
      value: def.value,
      label: def.label,
      color: def.color,
      position: def.position,
    };
  });

  const legacyLeft = opts.filter((o) => !String(o.value || '').startsWith('OPP_'));
  if (legacyLeft.length && DRY) {
    console.log(`  [dry-run] Retrait de ${legacyLeft.length} option(s) legacy: ${legacyLeft.map((o) => o.value).join(', ')}`);
  }

  if (DRY) {
    console.log('  [dry-run] metadata non modifiée.\n');
    return;
  }

  await metadataRequest(UPDATE_FIELD, {
    input: {
      id: field.id,
      update: {
        options: oppOnly,
        defaultValue: "'OPP_NEW'",
      },
    },
  });
  console.log('  OK (7 options OPP_* + default OPP_NEW)\n');
}

async function main() {
  const runAll = Boolean(args.all);
  const runAdd = runAll || args['schema-add'];
  const runMig = runAll || args['migrate-data'];
  const runFin = runAll || args['schema-final'];
  const runRepair = runAll || args['repair-statut'];

  if (!runAdd && !runMig && !runFin && !runRepair) {
    console.log(`
Usage:
  node migrate_opportunity_stages_opp.js --schema-add [--dry-run]
  node migrate_opportunity_stages_opp.js --migrate-data [--dry-run]
  node migrate_opportunity_stages_opp.js --schema-final [--dry-run]
  node migrate_opportunity_stages_opp.js --repair-statut [--dry-run]
  node migrate_opportunity_stages_opp.js --all [--dry-run]
`);
    process.exit(1);
  }

  if (DRY) console.log('Mode dry-run : aucune écriture Twenty.\n');

  if (runAdd) await phaseSchemaAdd();
  if (runMig) await phaseMigrateData();
  if (runFin) await phaseSchemaFinal();
  if (runRepair) await phaseRepairStatutDevis();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
