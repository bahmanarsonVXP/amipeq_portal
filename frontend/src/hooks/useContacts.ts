'use client';

import useSWR from 'swr';
import { apiFetchWithSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { ContactsListResponse } from '@/types';

export function useContacts(search?: string) {
  const { loading: authLoading } = useAuth();
  const endpoint = search
    ? `/api/persons?search=${encodeURIComponent(search)}`
    : '/api/persons';
  const key = authLoading ? null : endpoint;

  return useSWR<ContactsListResponse>(key, (url: string) =>
    apiFetchWithSession<ContactsListResponse>(url),
  );
}
