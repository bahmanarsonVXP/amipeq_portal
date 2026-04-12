'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { Opportunity } from '@/types';

interface OpportunitiesResponse {
  opportunities: Opportunity[];
}

export function useOpportunities(status?: string) {
  const endpoint = status
    ? `/api/opportunities?status=${status}`
    : '/api/opportunities';
  return useSWR<OpportunitiesResponse>(endpoint, api.get);
}
