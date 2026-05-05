'use client';
import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { OpportunityRow } from '@/types';

interface OpportunitiesResponse {
  opportunities: OpportunityRow[];
}

export function useOpportunities(status?: string) {
  const { loading: authLoading } = useAuth();
  const endpoint = status
    ? `/api/opportunities?status=${encodeURIComponent(status)}`
    : '/api/opportunities';
  const key = authLoading ? null : endpoint;

  return useSWR<OpportunitiesResponse>(key, (url: string) => apiFetchWithSession<OpportunitiesResponse>(url));
}
