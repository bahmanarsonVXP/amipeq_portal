import { queryTwenty } from '../twenty';
import type { Env } from '../../index';

export async function deleteOpportunityViaGraphql(env: Env, id: string): Promise<boolean> {
  const mutation = `
    mutation DeleteOpportunity($filter: OpportunityFilterInput!) {
      deleteOpportunities(filter: $filter) {
        id
      }
    }
  `;
  const data = await queryTwenty<{
    deleteOpportunities?: { id: string }[] | null;
  }>(env, mutation, { filter: { id: { eq: id } } });
  return Array.isArray(data.deleteOpportunities) && data.deleteOpportunities.length > 0;
}
