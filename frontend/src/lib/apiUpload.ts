import { GATEWAY_TOKEN_KEY } from './gatewayToken';
import { ApiError } from './api';
import { supabase } from './supabase';

function getApiBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') return '';
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
}

/** Upload multipart (sans Content-Type JSON). */
export async function apiUploadWithSession<T>(
  endpoint: string,
  formData: FormData,
  method: 'PUT' | 'POST' = 'PUT',
): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError(401, error.message);
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Session requise');

  const lsToken = typeof window !== 'undefined' ? localStorage.getItem(GATEWAY_TOKEN_KEY) : null;
  const auth = token || lsToken;

  const path = endpoint.replace(/\/+$/, '') || '/';
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    body: formData,
    headers: auth ? { Authorization: `Bearer ${auth}` } : undefined,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GATEWAY_TOKEN_KEY);
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expirée');
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, err.message || 'Erreur upload');
  }

  return res.json() as Promise<T>;
}

export async function downloadQuoteDocument(
  opportunityId: string,
  quoteId: string,
  fileName: string,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError(401, error.message);
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Session requise');

  const res = await fetch(
    `${getApiBaseUrl()}/api/opportunities/${opportunityId}/portail-bundle/quotes/${quoteId}/document`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, err.message || 'Téléchargement impossible');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
