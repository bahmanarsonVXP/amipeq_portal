'use client';

import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import { getContactCompanyBadge } from '@/lib/contactCompanyBadge';
import { cn } from '@/lib/utils';
import type { CompanyDetailPerson, ContactListItem } from '@/types';

type ContactLike = CompanyDetailPerson | ContactListItem;

interface Props {
  contact: ContactLike;
  selected?: boolean;
  onClick?: () => void;
  opportunityCompanyId?: string | null;
  showCompanyBadge?: boolean;
  subtitle?: string | null;
  className?: string;
}

export function ContactSelectionCard({
  contact,
  selected = false,
  onClick,
  opportunityCompanyId,
  showCompanyBadge = false,
  subtitle,
  className,
}: Props) {
  const badge =
    showCompanyBadge && 'companyId' in contact
      ? getContactCompanyBadge(contact as ContactListItem, opportunityCompanyId)
      : null;

  const content = (
    <>
      <p className="font-semibold uppercase tracking-wide text-gray-900">
        {formatContactPrimaryLine(contact)}
      </p>
      {formatContactFirstName(contact.firstName) && (
        <p className="text-sm text-gray-600">{formatContactFirstName(contact.firstName)}</p>
      )}
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      {badge && (
        <span
          className={cn(
            'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            badge.variant === 'current' && 'bg-primary-100 text-primary-800',
            badge.variant === 'other' && 'bg-gray-100 text-gray-600',
            badge.variant === 'none' && 'bg-amber-50 text-amber-800',
          )}
        >
          {badge.label}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-xl border px-4 py-3 text-left transition',
          selected
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/40',
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-primary-500 bg-primary-50 px-4 py-3',
        className,
      )}
    >
      {content}
    </div>
  );
}
