'use client';

import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { OpportunityNotesResponse } from '@/types';

export function useOpportunityNotes(opportunityId: string | null) {
  const { loading: authLoading } = useAuth();
  const key =
    authLoading || !opportunityId
      ? null
      : `/api/opportunities/${encodeURIComponent(opportunityId)}/notes`;

  return useSWR<OpportunityNotesResponse>(key, (url: string) =>
    apiFetchWithSession<OpportunityNotesResponse>(url),
  );
}
