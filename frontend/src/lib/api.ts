const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('amipeq_token') : null;

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('amipeq_token');
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
