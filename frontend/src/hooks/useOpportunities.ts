'use client';
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { OpportunityRow } from '@/types';

interface OpportunitiesResponse {
  opportunities: OpportunityRow[];
}

export function useOpportunities(status?: string) {
  const { session, loading: authLoading } = useAuth();
  const endpoint = status
    ? `/api/opportunities?status=${encodeURIComponent(status)}`
    : '/api/opportunities';
  const token = session?.access_token;
  const key = authLoading || !token ? null : ([endpoint, token] as const);

  return useSWR<OpportunitiesResponse>(key, ([url, tok]) =>
    apiFetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  );
}
