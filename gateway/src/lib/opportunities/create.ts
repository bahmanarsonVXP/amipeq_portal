import { queryTwenty } from '../twenty';
import { toGraphqlEnumList, toGraphqlEnumValue } from '../opportunityGraphql';
import { OPPORTUNITY_STAGES, stageToStatutDevis } from '../opportunityStages';
import type { Env } from '../../index';

export type CreateOpportunityInput = {
  companyId: string;
  name: string;
  numeroDevis?: string;
  amountEur?: number | null;
  stage?: string;
  dateDevis?: string | null;
  statutDevis?: string;
  prestation?: string[];
  pointOfContactId?: string | null;
  anneeDevis?: number | null;
};

export async function createOpportunityViaGraphql(
  env: Env,
  input: CreateOpportunityInput,
): Promise<string | null> {
  const stageCode = input.stage?.trim() || OPPORTUNITY_STAGES.NEW;
  const stage = toGraphqlEnumValue(stageCode, 'stage');
  const statutDevis = toGraphqlEnumValue(
    input.statutDevis?.trim() || stageToStatutDevis(stageCode),
    'statutDevis',
  );
  const prestation = toGraphqlEnumList(input.prestation);
  const amountEur = input.amountEur;
  const amountMicros =
    amountEur != null && !Number.isNaN(Number(amountEur))
      ? Math.round(Number(amountEur) * 1_000_000)
      : null;

  const optionalFields = [
    `companyId: ${JSON.stringify(input.companyId)}`,
    `stage: ${stage}`,
    `statutDevis: ${statutDevis}`,
    input.numeroDevis?.trim() ? `numeroDevis: ${JSON.stringify(input.numeroDevis.trim())}` : null,
    input.dateDevis?.trim() ? `dateDevis: ${JSON.stringify(input.dateDevis.trim())}` : null,
    input.pointOfContactId?.trim()
      ? `pointOfContactId: ${JSON.stringify(input.pointOfContactId.trim())}`
      : null,
    prestation.length ? `prestation: [${prestation.join(', ')}]` : null,
    amountMicros != null ? `amount: { amountMicros: ${amountMicros}, currencyCode: EUR }` : null,
    input.anneeDevis != null && !Number.isNaN(Number(input.anneeDevis))
      ? `anneeDevis: ${Number(input.anneeDevis)}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n          ');

  const mutation = `
    mutation CreateOpportunityFromPortal {
      createOpportunity(data: {
        name: ${JSON.stringify(input.name)}
        ${optionalFields}
      }) {
        id
      }
    }
  `;

  const data = await queryTwenty<{ createOpportunity?: { id?: string | null } | null }>(
    env,
    mutation,
  );
  return data.createOpportunity?.id ?? null;
}
