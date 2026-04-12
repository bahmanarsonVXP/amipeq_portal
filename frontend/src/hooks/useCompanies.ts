'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompaniesResponse {
  companies: CompanyOption[];
}

export function useCompanies(search?: string) {
  const endpoint = search
    ? `/api/companies?search=${encodeURIComponent(search)}`
    : '/api/companies';
  return useSWR<CompaniesResponse>(endpoint, api.get);
}
