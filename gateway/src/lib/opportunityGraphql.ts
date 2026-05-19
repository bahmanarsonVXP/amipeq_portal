/**
 * Lecture / écriture opportunité Twenty via GraphQL uniquement (bundle portail, montants, BC).
 */

import { queryTwenty } from './twenty';
import { GET_OPPORTUNITY_BY_ID } from './queries';
import { opportunityNodeToRestRecord, type TwentyOppNode } from './mapOpportunityRow';
import type { Env } from '../index';

/** Clé enregistrement pseudo-REST / JSON Twenty (camelCase métier). */
export const BUNDLE_FIELD = 'devisPortailBundle';

/** Nom du champ dans la mutation GraphQL Twenty (lowercase). */
export const BUNDLE_GRAPHQL_FIELD = 'devisportailbundle';

export function toGraphqlEnumValue(value: string, fieldName: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(normalized)) {
    throw new Error(`${fieldName} invalide: ${value}`);
  }
  return normalized;
}

export function toGraphqlEnumList(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => toGraphqlEnumValue(value, 'prestation'))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export async function readOpportunityRecord(
  env: Env,
  opportunityId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await queryTwenty<{
      opportunities: { edges: { node: TwentyOppNode }[] };
    }>(env, GET_OPPORTUNITY_BY_ID, {
      filter: { id: { eq: opportunityId } },
    });
    const node = data.opportunities?.edges?.[0]?.node;
    if (!node?.id) return null;
    return opportunityNodeToRestRecord(node, BUNDLE_FIELD);
  } catch {
    return null;
  }
}

export async function readOpportunityForBundle(
  env: Env,
  opportunityId: string,
): Promise<{ record: Record<string, unknown> | null; status: number }> {
  const record = await readOpportunityRecord(env, opportunityId);
  if (!record) return { record: null, status: 404 };
  return { record, status: 200 };
}

export type GraphqlPatchParts = {
  lines: string[];
  /** Objet JSON pour `devisportailbundle` (variable GraphQL). */
  bundle: unknown | undefined;
};

/** Lignes `data` pour mutation updateOpportunity (hors bundle JSON). */
export function patchToGraphqlDataLines(patch: Record<string, unknown>): GraphqlPatchParts {
  const lines: string[] = [];
  let bundle: unknown | undefined;

  if (patch[BUNDLE_FIELD] !== undefined) {
    const raw = patch[BUNDLE_FIELD];
    bundle = typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  if (patch.bonDeCommandeRef !== undefined) {
    const ref = patch.bonDeCommandeRef;
    if (ref == null || ref === '') {
      lines.push('bonDeCommandeRef: null');
    } else {
      lines.push(`bonDeCommandeRef: ${JSON.stringify(String(ref))}`);
    }
  }

  if (typeof patch.stage === 'string' && patch.stage.trim()) {
    lines.push(`stage: ${toGraphqlEnumValue(patch.stage, 'stage')}`);
  }

  if (typeof patch.statutDevis === 'string' && patch.statutDevis.trim()) {
    lines.push(`statutDevis: ${toGraphqlEnumValue(patch.statutDevis, 'statutDevis')}`);
  }

  if (patch.numeroDevis !== undefined) {
    lines.push(`numeroDevis: ${JSON.stringify(String(patch.numeroDevis))}`);
  }

  if (patch.tauxRemise !== undefined && patch.tauxRemise !== null) {
    lines.push(`tauxRemise: ${Number(patch.tauxRemise)}`);
  }

  if (patch.prestation !== undefined) {
    const arr = Array.isArray(patch.prestation)
      ? (patch.prestation as unknown[]).filter((p): p is string => typeof p === 'string')
      : [];
    const gql = toGraphqlEnumList(arr);
    lines.push(gql.length ? `prestation: [${gql.join(', ')}]` : 'prestation: []');
  }

  const amount = patch.amount as { amountMicros?: number | string } | undefined;
  if (amount?.amountMicros != null) {
    const micros =
      typeof amount.amountMicros === 'string'
        ? parseInt(amount.amountMicros, 10)
        : amount.amountMicros;
    if (Number.isFinite(micros)) {
      lines.push(`amount: { amountMicros: ${micros}, currencyCode: EUR }`);
    }
  }

  const remise = patch.montantRemise as { amountMicros?: number | string } | undefined;
  if (remise?.amountMicros != null) {
    const micros =
      typeof remise.amountMicros === 'string'
        ? parseInt(remise.amountMicros, 10)
        : remise.amountMicros;
    if (Number.isFinite(micros)) {
      lines.push(`montantRemise: { amountMicros: ${micros}, currencyCode: EUR }`);
    }
  }

  return { lines, bundle };
}

export async function updateOpportunityViaGraphql(
  env: Env,
  opportunityId: string,
  dataLines: string[],
  bundle?: unknown,
): Promise<{ stage: string; statutDevis: string | null }> {
  const hasBundle = bundle !== undefined;
  if (dataLines.length === 0 && !hasBundle) {
    const record = await readOpportunityRecord(env, opportunityId);
    if (!record) throw new Error('Opportunité introuvable');
    return {
      stage: typeof record.stage === 'string' ? record.stage : '',
      statutDevis: typeof record.statutDevis === 'string' ? record.statutDevis : null,
    };
  }

  const dataParts = [...dataLines];
  if (hasBundle) {
    dataParts.push(`${BUNDLE_GRAPHQL_FIELD}: $bundle`);
  }

  const varDecl = hasBundle ? ', $bundle: JSON' : '';
  const variables: Record<string, unknown> = { id: opportunityId };
  if (hasBundle) {
    variables.bundle = bundle;
  }

  const mutation = `
    mutation UpdateOpportunityPortail($id: ID!${varDecl}) {
      updateOpportunity(id: $id, data: {
        ${dataParts.join('\n        ')}
      }) {
        id
        stage
        statutDevis
      }
    }
  `;

  const data = await queryTwenty<{
    updateOpportunity?: { id: string; stage: string; statutDevis: string | null } | null;
  }>(env, mutation, variables);

  if (!data.updateOpportunity?.id) {
    throw new Error('Mise à jour opportunité impossible (GraphQL)');
  }

  return {
    stage: data.updateOpportunity.stage,
    statutDevis: data.updateOpportunity.statutDevis,
  };
}
