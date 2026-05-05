'use client';
import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompaniesResponse {
  companies: CompanyOption[];
}

export function useCompanies(search?: string) {
  const { loading: authLoading } = useAuth();
  const endpoint = search
    ? `/api/companies?search=${encodeURIComponent(search)}`
    : '/api/companies';
  const key = authLoading ? null : endpoint;

  return useSWR<CompaniesResponse>(key, (url: string) => apiFetchWithSession<CompaniesResponse>(url));
}
