'use client';

import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { OpportunityRemindersResponse } from '@/types';

export function useOpportunityReminders(opportunityId: string | null) {
  const { loading: authLoading } = useAuth();
  const key =
    authLoading || !opportunityId
      ? null
      : `/api/opportunities/${encodeURIComponent(opportunityId)}/reminders`;

  return useSWR<OpportunityRemindersResponse>(key, (url: string) =>
    apiFetchWithSession<OpportunityRemindersResponse>(url),
  );
}
