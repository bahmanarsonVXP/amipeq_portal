'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import type { PortailBundleDetailResponse } from '@/types';

export function usePortailBundle(opportunityId: string | null) {
  const [detail, setDetail] = useState<PortailBundleDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!opportunityId) {
      setDetail(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetchWithSession<PortailBundleDetailResponse>(
        `/api/opportunities/${opportunityId}/portail-bundle`,
      );
      setDetail(res);
      return res;
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'Chargement des devis impossible';
      setError(msg);
      setDetail(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { detail, loading, error, setError, refresh, setDetail };
}
