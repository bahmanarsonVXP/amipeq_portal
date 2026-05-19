'use client';
import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyListItem } from '@/types';

export type CompanyOption = Pick<CompanyListItem, 'id' | 'name'>;

interface CompaniesResponse {
  companies: CompanyListItem[];
}

export function useCompanies(search?: string) {
  const { loading: authLoading } = useAuth();
  const endpoint = search
    ? `/api/companies?search=${encodeURIComponent(search)}`
    : '/api/companies';
  const key = authLoading ? null : endpoint;

  return useSWR<CompaniesResponse>(key, (url: string) => apiFetchWithSession<CompaniesResponse>(url));
}
