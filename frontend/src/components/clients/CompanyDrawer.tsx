'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCreatedUpdatedMeta } from '@/lib/metaDates';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import { formatPhoneDisplay, formatPhoneHref } from '@/lib/phone';
import { formatCurrency } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';
import { getStatusLabel, getStatusVariant } from '@/components/ui/Badge';
import { useCompanyDetail } from '@/hooks/useCompanyDetail';
import type { OpportunityRow, PersonCreatePayload, PersonCreateResponse } from '@/types';

interface Props {
  companyId: string | null;
  onClose: () => void;
  onSelectOpportunity: (row: OpportunityRow) => void;
}

const PRESTATION_LABELS: Record<string, string> = {
  DU: 'DU',
  MAJ_DU: 'MAJ DU',
  MAJ_DU_DEMAT: 'MAJ DU Démat.',
  DUERP: 'DUERP',
  MAJ_DUERP: 'MAJ DUERP',
  MAJ_DU_DISTANCE: 'MAJ DU à Distance',
  DU_SITE_DISTANCE: 'DU Sur SITE ou à DISTANCE',
  PPMS: 'PPMS',
  MAJ_PPMS: 'MAJ PPMS',
  DU_DISTANCE: 'DU à Distance',
  RPS: 'RPS',
  RPS_ENTRETIENS: 'RPS avec Entretiens',
  RPS_ET_ENTRETIENS: 'RPS et/ou Entretiens',
};

const CONTACT_CIVILITY_OPTIONS = [
  { value: '', label: 'Civilité' },
  { value: 'MONSSIEUR', label: 'M.' },
  { value: 'MADAME', label: 'Mme' },
  { value: 'MADEMOISELLE', label: 'Mlle' },
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function CompanyDrawer({ companyId, onClose, onSelectOpportunity }: Props) {
  const router = useRouter();
  const isOpen = companyId !== null;
  const { data, error, isLoading, mutate } = useCompanyDetail(companyId);
  const opportunities = useMemo(() => {
    return [...(data?.opportunities ?? [])].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [data?.opportunities]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const co = data?.company;
  const companyPhoneHref = formatPhoneHref(co?.phone ?? null);
  const companyPhoneLabel = formatPhoneDisplay(co?.phone ?? null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactCivility, setContactCivility] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');

  useEffect(() => {
    setShowNewContactForm(false);
    setContactSaving(false);
    setContactError(null);
    setContactSuccess(null);
    setContactCivility('');
    setContactFirstName('');
    setContactLastName('');
    setContactPhone('');
    setContactEmail('');
    setContactJobTitle('');
  }, [companyId]);

  function goToOpportunityFlow(contactId?: string) {
    if (!co) return;
    const params = new URLSearchParams({
      companyId: co.id,
      companyName: co.name,
    });
    if (contactId) {
      params.set('contactId', contactId);
    }
    onClose();
    router.push(`/opportunities/new?${params.toString()}`);
  }

  async function handleCreateContact() {
    if (!co) return;
    if (!contactFirstName.trim() && !contactLastName.trim()) {
      setContactError('Le nom du contact est requis.');
      setContactSuccess(null);
      return;
    }
    if (!contactPhone.trim()) {
      setContactError('Le numéro du contact est requis.');
      setContactSuccess(null);
      return;
    }
    if (!contactEmail.trim()) {
      setContactError("L'email du contact est requis.");
      setContactSuccess(null);
      return;
    }

    setContactSaving(true);
    setContactError(null);
    setContactSuccess(null);

    try {
      const payload: PersonCreatePayload = {
        companyId: co.id,
        civility: contactCivility || null,
        firstName: contactFirstName.trim() || null,
        lastName: contactLastName.trim() || null,
        phone: contactPhone.trim() || null,
        phoneCode: '+33',
        email: contactEmail.trim() || null,
        city: co.address.city ?? null,
        jobTitle: contactJobTitle.trim() || null,
      };

      await apiFetchWithSession<PersonCreateResponse>('/api/persons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setContactSuccess('Contact créé et rattaché au client.');
      setContactCivility('');
      setContactFirstName('');
      setContactLastName('');
      setContactPhone('');
      setContactEmail('');
      setContactJobTitle('');
      setShowNewContactForm(false);
      await mutate();
    } catch (createError) {
      setContactError(getErrorMessage(createError, 'Impossible de créer le contact'));
    } finally {
      setContactSaving(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[45] bg-black/20 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isOpen && (
          <>
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-gray-900">
                  {co?.name ?? 'Chargement…'}
                </p>
                {co && (co.address.postcode || co.address.city) && (
                  <p className="mt-0.5 text-sm text-gray-400">
                    {[co.address.postcode, co.address.city].filter(Boolean).join(' ')}
                  </p>
                )}
                {co?.address.street1 && (
                  <p className="text-xs text-gray-400">{co.address.street1}</p>
                )}
                {co?.siret && (
                  <p className="mt-1 font-mono text-xs text-gray-500">SIRET {co.siret}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-4 mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12 4L4 12M4 4l8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {error && (
                <p className="text-sm text-red-700">
                  Impossible de charger la fiche client.
                </p>
              )}
              {isLoading && !co && (
                <p className="text-sm text-gray-500">Chargement…</p>
              )}
              {co && (
                <>
                  <div className="mb-6 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => goToOpportunityFlow()}>
                      Nouvelle opportunité
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowNewContactForm((current) => !current);
                        setContactError(null);
                        setContactSuccess(null);
                      }}
                    >
                      {showNewContactForm ? 'Annuler nouveau contact' : 'Nouveau contact'}
                    </Button>
                  </div>

                  {(co.phone || co.domainUrl) && (
                    <div className="mb-6 space-y-1 text-sm text-gray-600">
                      {co.phone && (
                        <p>
                          <span className="font-medium text-gray-400">Tél. </span>
                          <a
                            href={companyPhoneHref ? `tel:${companyPhoneHref}` : undefined}
                            className="hover:text-primary-600"
                          >
                            {companyPhoneLabel}
                          </a>
                        </p>
                      )}
                      {co.domainUrl && (
                        <p>
                          <span className="font-medium text-gray-400">Web </span>
                          <a
                            href={co.domainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-primary-600 hover:underline"
                          >
                            {co.domainUrl}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Contacts
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary-600 hover:underline"
                        onClick={() => {
                          setShowNewContactForm(true);
                          setContactError(null);
                          setContactSuccess(null);
                        }}
                      >
                        Créer un contact
                      </button>
                    </div>

                    {co.people.length > 0 ? (
                      <ul className="space-y-3">
                        {co.people.map((p) => {
                          const phoneHref = formatPhoneHref(p.phone, p.phoneCode);
                          const phoneLabel = formatPhoneDisplay(p.phone, p.phoneCode);
                          return (
                            <li
                              key={p.id}
                              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                                  </p>
                                  {p.jobTitle && (
                                    <p className="text-xs text-gray-500">{p.jobTitle}</p>
                                  )}
                                  {p.email && (
                                    <a
                                      href={`mailto:${p.email}`}
                                      className="text-xs text-primary-600 hover:underline"
                                    >
                                      {p.email}
                                    </a>
                                  )}
                                  {p.phone && (
                                    <p className="text-xs text-gray-600">
                                      <a
                                        href={phoneHref ? `tel:${phoneHref}` : undefined}
                                        className="hover:text-primary-600"
                                      >
                                        {phoneLabel}
                                      </a>
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => goToOpportunityFlow(p.id)}
                                >
                                  Créer une opportunité
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        Aucun contact rattaché à ce client.
                      </div>
                    )}

                    {showNewContactForm && (
                      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Civilité
                            </label>
                            <select
                              value={contactCivility}
                              onChange={(e) => setContactCivility(e.target.value)}
                              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              {CONTACT_CIVILITY_OPTIONS.map((option) => (
                                <option key={option.value || 'empty'} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Fonction
                            </label>
                            <Input
                              value={contactJobTitle}
                              onChange={(e) => setContactJobTitle(e.target.value)}
                              placeholder="Optionnel"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Prénom
                            </label>
                            <Input
                              value={contactFirstName}
                              onChange={(e) => setContactFirstName(e.target.value)}
                              placeholder="Prénom"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Nom
                            </label>
                            <Input
                              value={contactLastName}
                              onChange={(e) => setContactLastName(e.target.value)}
                              placeholder="Nom"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Téléphone
                            </label>
                            <Input
                              value={contactPhone}
                              onChange={(e) => setContactPhone(e.target.value)}
                              placeholder="Téléphone"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Email
                            </label>
                            <Input
                              type="email"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              placeholder="Email"
                            />
                          </div>
                        </div>

                        {contactError && (
                          <p className="text-sm text-red-600">{contactError}</p>
                        )}
                        {contactSuccess && (
                          <p className="text-sm text-green-600">{contactSuccess}</p>
                        )}

                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setShowNewContactForm(false);
                              setContactError(null);
                            }}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateContact}
                            disabled={contactSaving}
                          >
                            {contactSaving ? 'Création…' : 'Créer le contact'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {contactSuccess && !showNewContactForm && (
                      <p className="mt-3 text-sm text-green-600">{contactSuccess}</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Opportunités ({opportunities.length})
                    </p>
                    {opportunities.length === 0 && (
                      <p className="text-sm text-gray-500">Aucune opportunité.</p>
                    )}
                    <ul className="space-y-1">
                      {opportunities.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => onSelectOpportunity(row)}
                            className="w-full rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-primary-200 hover:bg-primary-50/30"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={opportunityStageBadgeVariant(row.stage)}>
                                {opportunityStageLabel(row.stage)}
                              </Badge>
                              {row.statutDevis && (
                                <Badge variant={getStatusVariant(row.statutDevis)}>
                                  {getStatusLabel(row.statutDevis)}
                                </Badge>
                              )}
                              {row.numeroDevis && (
                                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                                  {row.numeroDevis}
                                </span>
                              )}
                            </div>
                            {row.prestation.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.prestation.map((prestation) => (
                                  <span
                                    key={prestation}
                                    className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-medium leading-tight text-primary-700"
                                  >
                                    {PRESTATION_LABELS[prestation] ?? prestation}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-0.5 flex items-end justify-between gap-6">
                              <p className="text-sm font-bold leading-tight text-right text-gray-900">
                                {row.amountEur != null ? formatCurrency(row.amountEur) : '—'}
                              </p>
                              <p className="text-[9px] leading-3 text-right text-gray-400">
                                {formatCreatedUpdatedMeta(row.createdAt, row.updatedAt)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
