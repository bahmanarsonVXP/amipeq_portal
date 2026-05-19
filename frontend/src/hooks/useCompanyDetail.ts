'use client';

import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { CompanyDetailResponse } from '@/types';

export function useCompanyDetail(companyId: string | null) {
  const { loading: authLoading } = useAuth();
  const key =
    authLoading || !companyId ? null : `/api/companies/${encodeURIComponent(companyId)}`;

  return useSWR<CompanyDetailResponse>(key, (url: string) =>
    apiFetchWithSession<CompanyDetailResponse>(url),
  );
}
