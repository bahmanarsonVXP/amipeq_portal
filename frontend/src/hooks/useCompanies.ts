'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Company } from '@/types';

interface CompaniesResponse {
  companies: Company[];
}

export function useCompanies(search?: string) {
  const endpoint = search
    ? `/api/companies?search=${encodeURIComponent(search)}`
    : '/api/companies';
  return useSWR<CompaniesResponse>(endpoint, api.get);
}
