type Env = { TWENTY_API_URL: string; TWENTY_API_KEY: string };

export async function queryTwenty<T>(
  env: Env,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${env.TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}
