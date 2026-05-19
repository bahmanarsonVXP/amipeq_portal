'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { useContacts } from '@/hooks/useContacts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import { getContactCompanyBadge } from '@/lib/contactCompanyBadge';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type { ContactListItem } from '@/types';

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 12;

interface Props {
  onSelect: (contact: ContactListItem) => void;
  opportunityCompanyId?: string | null;
  opportunityCompanyName?: string | null;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ContactDirectorySearch({
  onSelect,
  opportunityCompanyId,
  disabled = false,
  placeholder = 'Nom, email, client sur la fiche…',
  className,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH && !disabled;

  const { data, isLoading, error } = useContacts(canSearch ? debouncedQuery : undefined);
  const results = (data?.contacts ?? []).slice(0, MAX_RESULTS);

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

  useEffect(() => {
    if (canSearch) setOpen(true);
  }, [canSearch, debouncedQuery]);

  function handleSelect(contact: ContactListItem) {
    onSelect(contact);
    setOpen(false);
    setQuery('');
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= MIN_QUERY_LENGTH) {
              setOpen(true);
            } else {
              setOpen(false);
            }
          }}
          onFocus={() => {
            if (query.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          autoComplete="off"
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Interlocuteur sur l&apos;opportunité uniquement — la fiche contact dans Twenty n&apos;est pas
        modifiée.
      </p>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {isLoading && (
            <p className="px-3 py-2 text-sm text-gray-500">Recherche…</p>
          )}
          {!isLoading && error && (
            <p className="px-3 py-2 text-sm text-red-600">Impossible de charger l&apos;annuaire.</p>
          )}
          {!isLoading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">Aucun contact trouvé.</p>
          )}
          {!isLoading &&
            results.map((contact) => {
              const badge = getContactCompanyBadge(contact, opportunityCompanyId);
              const phone = contact.phone
                ? formatPhoneDisplay(contact.phone, contact.phoneCode)
                : null;
              return (
                <button
                  key={contact.id}
                  type="button"
                  role="option"
                  className="w-full border-b border-gray-50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-primary-50"
                  onClick={() => handleSelect(contact)}
                >
                  <p className="font-semibold uppercase tracking-wide text-gray-900">
                    {formatContactPrimaryLine(contact)}
                  </p>
                  {formatContactFirstName(contact.firstName) && (
                    <p className="text-gray-600">{formatContactFirstName(contact.firstName)}</p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    {contact.email && <span className="break-all">{contact.email}</span>}
                    {phone && <span>{phone}</span>}
                  </p>
                  <span
                    className={cn(
                      'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      badge.variant === 'current' && 'bg-primary-100 text-primary-800',
                      badge.variant === 'other' && 'bg-gray-100 text-gray-600',
                      badge.variant === 'none' && 'bg-amber-50 text-amber-800',
                    )}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
