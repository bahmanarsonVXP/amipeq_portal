'use client';
import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { ClientOverviewResponse } from '@/types';

export function useClientOverview(search?: string) {
  const { loading: authLoading } = useAuth();
  const endpoint = search
    ? `/api/companies/overview?search=${encodeURIComponent(search)}`
    : '/api/companies/overview';
  const key = authLoading ? null : endpoint;

  return useSWR<ClientOverviewResponse>(key, (url: string) => apiFetchWithSession<ClientOverviewResponse>(url));
}
