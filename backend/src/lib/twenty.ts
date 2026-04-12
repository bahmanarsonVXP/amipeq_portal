import { config } from './config';

export async function queryTwenty<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${config.twenty.apiUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.twenty.apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export async function getTwentyOpportunity(id: string) {
  const query = `
    query GetOpportunity($id: ID!) {
      opportunity(id: $id) {
        id name closeDate
        amount { amountMicros currencyCode }
        company {
          id name
          address { addressStreet1 addressCity addressPostcode }
          phone
        }
        people { edges { node { firstName lastName email jobTitle } } }
      }
    }
  `;
  const data = await queryTwenty<{ opportunity: unknown }>(query, { id });
  return data.opportunity;
}
