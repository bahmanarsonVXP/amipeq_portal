#!/usr/bin/env node
/**
 * Crée un devis legacy (-A) dans devisPortailBundle pour les opportunités sans quotes[].
 *
 * Usage:
 *   node backfill_portail_bundle_legacy.js --dry-run
 *   node backfill_portail_bundle_legacy.js --limit 50
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { graphqlRequest, restRequest } = require('./lib/core/http');

const BUNDLE_FIELD = 'devisPortailBundle';
const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null;

function stripSuffix(numero) {
  const t = String(numero || '').trim();
  return /-[A-Z]$/.test(t) ? t.slice(0, -2) : t;
}

function microsToEur(m) {
  if (m == null) return null;
  const n = typeof m === 'string' ? parseInt(m, 10) : m;
  return Number.isFinite(n) ? Math.round((n / 1_000_000) * 100) / 100 : null;
}

function deriveDocStatut(stage, statutDevis) {
  if (statutDevis === 'GAGNE' || stage === 'GAGNE' || stage === 'OPP_WON') return 'Q_SENT';
  if (
    stage === 'DEVIS_ENVOYE' ||
    stage === 'OPP_CLIENT_PENDING' ||
    stage === 'RELANCE' ||
    statutDevis === 'EN_ATTENTE'
  ) {
    return 'Q_SENT';
  }
  if (statutDevis === 'PERDU' || stage === 'PERDU' || stage === 'OPP_LOST') return 'Q_CANCELLED';
  if (stage === 'DEVIS_EN_RELECTURE') return 'Q_INTERNAL_REVIEW';
  return 'Q_DRAFT_NEW';
}

function deriveCommercial(statutDevis) {
  if (statutDevis === 'GAGNE') return 'GAGNE';
  if (statutDevis === 'PERDU') return 'PERDU';
  return 'EN_ATTENTE';
}

function buildLegacyBundle(opp) {
  const root = stripSuffix(opp.numeroDevis || opp.name || 'DEVIS');
  const net = microsToEur(opp.amount?.amountMicros);
  const remise = microsToEur(opp.montantRemise?.amountMicros);
  const brut = net != null && remise != null ? Math.round((net + remise) * 100) / 100 : net;
  const id = crypto.randomUUID();
  const docStatut = deriveDocStatut(opp.stage, opp.statutDevis);
  return {
    version: 2,
    pilotageId: id,
    quotes: [
      {
        id,
        numero: `${root}-A`,
        label: 'Devis',
        statut: docStatut,
        statutCommercial: deriveCommercial(opp.statutDevis),
        sentAt: docStatut === 'Q_SENT' ? new Date().toISOString() : null,
        montantBrutEur: brut,
        tauxRemise: opp.tauxRemise ?? null,
        montantNetEur: net,
        remiseTexte: null,
        prestations: Array.isArray(opp.prestation) ? opp.prestation : [],
        documentKey: null,
        documentFileName: null,
        documentUploadedAt: null,
      },
    ],
    standby: { active: false, until: null, reason: null },
    lastSentInitQuoteId: null,
  };
}

function needsBackfill(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return true;
  try {
    const o = JSON.parse(raw);
    return !Array.isArray(o.quotes) || o.quotes.length === 0;
  } catch {
    return true;
  }
}

async function fetchOpportunities(after) {
  const query = `
    query BackfillBundles($after: String, $first: Int) {
      opportunities(after: $after, first: $first) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            name
            stage
            statutDevis
            numeroDevis
            tauxRemise
            prestation
            amount { amountMicros currencyCode }
            montantRemise { amountMicros currencyCode }
            devisPortailBundle: customFields(key: "devisPortailBundle")
          }
        }
      }
    }
  `;
  const data = await graphqlRequest(query, { after: after ?? null, first: 100 });
  return data?.opportunities;
}

async function main() {
  let after = null;
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const page = await fetchOpportunities(after);
    const edges = page?.edges ?? [];
    for (const { node: opp } of edges) {
      if (LIMIT != null && processed >= LIMIT) break;
      processed += 1;
      const raw =
        typeof opp.devisPortailBundle === 'string'
          ? opp.devisPortailBundle
          : opp.devisPortailBundle
            ? JSON.stringify(opp.devisPortailBundle)
            : null;
      if (!needsBackfill(raw)) {
        skipped += 1;
        continue;
      }
      const bundle = buildLegacyBundle(opp);
      console.log(`${DRY_RUN ? '[dry-run] ' : ''}${opp.id} ${bundle.quotes[0].numero}`);
      if (!DRY_RUN) {
        const { status } = await restRequest('PATCH', `/rest/opportunities/${opp.id}`, {
          [BUNDLE_FIELD]: JSON.stringify(bundle),
          numeroDevis: stripSuffix(bundle.quotes[0].numero),
        });
        if (status < 200 || status >= 300) {
          console.error(`  ERREUR PATCH ${opp.id} status=${status}`);
        } else {
          updated += 1;
        }
      } else {
        updated += 1;
      }
    }
    if (LIMIT != null && processed >= LIMIT) break;
    if (!page?.pageInfo?.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }

  console.log(`\nTerminé. Traitées: ${processed}, mises à jour: ${updated}, déjà OK: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
