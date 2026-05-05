import { GATEWAY_TOKEN_KEY } from './gatewayToken';
import { supabase } from './supabase';

/** En `next dev`, base vide → fetch vers /api/... (même origine :3000), rewrite vers le gateway. */
function getApiBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** D’abord les en-têtes explicites (dont Authorization), puis repli sur localStorage. */
function mergeFetchHeaders(lsToken: string | null, extra?: HeadersInit): Headers {
  const h = new Headers();
  h.set('Content-Type', 'application/json');
  if (extra) {
    new Headers(extra).forEach((value, key) => {
      h.set(key, value);
    });
  }
  if (!h.has('Authorization') && lsToken) {
    h.set('Authorization', `Bearer ${lsToken}`);
  }
  return h;
}

/** JWT lu depuis Supabase au moment de l’appel (évite tout décalage avec React / SWR). */
export async function apiFetchWithSession<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError(401, error.message);
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Session requise');
  return apiFetch<T>(endpoint, {
    ...options,
    headers: {
      ...((options?.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const lsToken = typeof window !== 'undefined' ? localStorage.getItem(GATEWAY_TOKEN_KEY) : null;
  const { headers: optHeaders, ...rest } = options ?? {};
  const headers = mergeFetchHeaders(lsToken, optHeaders);

  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
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
