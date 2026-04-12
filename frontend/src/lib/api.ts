import { GATEWAY_TOKEN_KEY } from './gatewayToken';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function mergeFetchHeaders(
  lsToken: string | null,
  extra?: HeadersInit
): Headers {
  const h = new Headers();
  h.set('Content-Type', 'application/json');
  if (lsToken) h.set('Authorization', `Bearer ${lsToken}`);
  if (extra) {
    const incoming = new Headers(extra);
    incoming.forEach((value, key) => {
      h.set(key, value);
    });
  }
  return h;
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const lsToken = typeof window !== 'undefined' ? localStorage.getItem(GATEWAY_TOKEN_KEY) : null;
  const { headers: optHeaders, ...rest } = options ?? {};
  const headers = mergeFetchHeaders(lsToken, optHeaders);

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...rest,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GATEWAY_TOKEN_KEY);
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expirée');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(res.status, error.message || 'Erreur API');
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
};
