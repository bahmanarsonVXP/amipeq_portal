import type { Env } from '../index';

const base = (url: string) => url.replace(/\/$/, '');

export async function twentyRestPost(
  env: Pick<Env, 'TWENTY_API_URL' | 'TWENTY_API_KEY'>,
  path: string,
  body: Record<string, unknown>
): Promise<{ status: number; json: Record<string, unknown> }> {
  const url = `${base(env.TWENTY_API_URL)}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TWENTY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}
