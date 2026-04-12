'use client';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompaniesResponse {
  companies: CompanyOption[];
}

export function useCompanies(search?: string) {
  const { session, loading: authLoading } = useAuth();
  const endpoint = search
    ? `/api/companies?search=${encodeURIComponent(search)}`
    : '/api/companies';
  const token = session?.access_token;
  const key = authLoading || !token ? null : ([endpoint, token] as const);

  return useSWR<CompaniesResponse>(key, ([url, tok]) =>
    apiFetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  );
}
