'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { OpportunityRow } from '@/types';

interface OpportunitiesResponse {
  opportunities: OpportunityRow[];
}

export function useOpportunities(status?: string) {
  const endpoint = status
    ? `/api/opportunities?status=${encodeURIComponent(status)}`
    : '/api/opportunities';
  return useSWR<OpportunitiesResponse>(endpoint, api.get);
}
