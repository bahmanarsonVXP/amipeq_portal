'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EntrepriseSearchItem, EntrepriseSearchResponse } from '@/types';

const MIN_QUERY_LENGTH = 4;

export interface CompanyEntreprisePick {
  name: string;
  street1: string;
  postcode: string;
  city: string;
  siret: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPick: (pick: CompanyEntreprisePick) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CompanyNameEntrepriseSearch({
  value,
  onChange,
  onPick,
  placeholder = 'Nom du nouveau client',
  className,
  disabled = false,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EntrepriseSearchItem[]>([]);

  const canSearch = value.trim().length >= MIN_QUERY_LENGTH && !disabled;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  async function runSearch() {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const data = await apiFetchWithSession<EntrepriseSearchResponse>(
        `/api/entreprises/search?q=${encodeURIComponent(value.trim())}`,
      );
      setResults(data.results);
      if (data.results.length === 0) {
        setError(
          value.trim().length < 8
            ? 'Aucun résultat. Essayez quelques lettres de plus du nom (ex. voxperienc pour VOXPERIENCE).'
            : 'Aucune entreprise trouvée.',
        );
      }
    } catch (err) {
      setResults([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de contacter l'annuaire des entreprises.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(item: EntrepriseSearchItem) {
    onPick({
      name: item.name,
      street1: item.address.street1,
      postcode: item.address.postcode,
      city: item.address.city,
      siret: item.siret,
    });
    setOpen(false);
    setResults([]);
    setError(null);
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (open) {
              setOpen(false);
              setResults([]);
              setError(null);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={canSearch ? 'pr-11' : undefined}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
        />
        {canSearch && (
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={loading}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50"
            title="Rechercher dans l'annuaire des entreprises (data.gouv.fr)"
            aria-label="Rechercher dans l'annuaire des entreprises"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Globe className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>
      {canSearch && !open && !loading && (
        <p className="mt-1 text-xs text-gray-500">
          Cliquez sur l&apos;icône globe pour interroger l&apos;annuaire des entreprises (jusqu&apos;à 10
          résultats).
        </p>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {loading && (
            <p className="px-3 py-2 text-sm text-gray-500">Recherche en cours…</p>
          )}
          {!loading && error && (
            <p className="px-3 py-2 text-sm text-amber-700">{error}</p>
          )}
          {!loading &&
            results.map((item) => (
              <button
                key={`${item.siret ?? 'no-siret'}-${item.name}-${item.address.postcode}`}
                type="button"
                role="option"
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-primary-50"
                onClick={() => handleSelect(item)}
              >
                <p className="font-medium text-gray-900">{item.name}</p>
                {(item.address.street1 || item.address.postcode || item.address.city) && (
                  <p className="mt-0.5 text-xs text-gray-600">
                    {[item.address.street1, item.address.postcode, item.address.city]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {item.siret && (
                  <p className="mt-0.5 font-mono text-xs text-gray-500">SIRET {item.siret}</p>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}