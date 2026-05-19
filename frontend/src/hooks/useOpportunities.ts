'use client';
import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { OpportunityRow } from '@/types';

interface OpportunitiesResponse {
  opportunities: OpportunityRow[];
}

interface UseOpportunitiesOptions {
  status?: string;
  search?: string;
  extended?: boolean;
  limit?: number;
}

export function useOpportunities(statusOrOptions?: string | UseOpportunitiesOptions) {
  const { loading: authLoading } = useAuth();
  const options: UseOpportunitiesOptions =
    typeof statusOrOptions === 'string'
      ? { status: statusOrOptions }
      : (statusOrOptions ?? {});

  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.extended) params.set('extended', '1');
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.limit != null) params.set('limit', String(options.limit));

  const endpoint = params.toString()
    ? `/api/opportunities?${params.toString()}`
    : '/api/opportunities';
  const key = authLoading ? null : endpoint;

  return useSWR<OpportunitiesResponse>(key, (url: string) => apiFetchWithSession<OpportunitiesResponse>(url));
}
