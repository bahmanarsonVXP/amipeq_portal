'use client';

import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { ContactDetailResponse } from '@/types';

export function useContactDetail(contactId: string | null) {
  const { loading: authLoading } = useAuth();
  const key =
    authLoading || !contactId ? null : `/api/persons/${encodeURIComponent(contactId)}`;

  return useSWR<ContactDetailResponse>(key, (url: string) =>
    apiFetchWithSession<ContactDetailResponse>(url),
  );
}
