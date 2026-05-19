'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CompanyNameEntrepriseSearch } from '@/components/clients/CompanyNameEntrepriseSearch';
import { ContactDirectorySearch } from '@/components/contacts/ContactDirectorySearch';
import { ContactSelectionCard } from '@/components/contacts/ContactSelectionCard';
import { useCompanies } from '@/hooks/useCompanies';
import { useCompanyDetail } from '@/hooks/useCompanyDetail';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type {
  ClientType,
  CompanyCreatePayload,
  CompanyCreateResponse,
  CompanyDetailPerson,
  ContactListItem,
  OpportunityCreatePayload,
  PersonCreatePayload,
  PersonCreateResponse,
  Prestation,
} from '@/types';

const TYPE_OPTIONS: { value: ClientType; label: string }[] = [
  { value: 'ETABLISSEMENT_SCOLAIRE', label: 'Éducation' },
  { value: 'MAIRIE_COLLECTIVITE', label: 'Collectivité' },
  { value: 'ENTREPRISE_TPE_PME', label: 'Entreprise' },
  { value: 'AUTRE', label: 'Autre' },
];

const CIVILITY_OPTIONS = [
  { value: '', label: 'Civilité' },
  { value: 'MONSSIEUR', label: 'M.' },
  { value: 'MADAME', label: 'Mme' },
  { value: 'MADEMOISELLE', label: 'Mlle' },
];

const PRESTATION_OPTIONS: { value: Prestation; label: string }[] = [
  { value: 'DUERP', label: 'DUERP' },
  { value: 'PPMS', label: 'PPMS' },
  { value: 'RPS', label: 'RPS' },
  { value: 'PSE', label: 'PSE' },
  { value: 'COVID', label: 'COVID' },
  { value: 'RGPD', label: 'RGPD' },
  { value: 'AUTRE', label: 'Autre' },
];

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

type CompanyMode = 'existing' | 'new';
type ContactMode = 'existing' | 'directory' | 'new';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Erreur inconnue';
}

function buildContactSubtitle(contact: CompanyDetailPerson | ContactListItem): string {
  const phone = contact.phone
    ? formatPhoneDisplay(contact.phone, contact.phoneCode)
    : null;
  return [contact.jobTitle, contact.email, phone]
    .filter((part): part is string => Boolean(part) && part !== '—')
    .join(' · ');
}

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = searchParams.get('mode');
  const initialCompanyId = searchParams.get('companyId');
  const initialCompanyName = searchParams.get('companyName') ?? '';
  const initialContactId = searchParams.get('contactId');
  const initialContactMode = searchParams.get('contactMode');

  const [companyMode, setCompanyMode] = useState<CompanyMode>(
    initialMode === 'new-client' ? 'new' : 'existing',
  );
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [newCompanyName, setNewCompanyName] = useState(
    initialMode === 'new-client' ? initialCompanyName : '',
  );
  const [newCompanyType, setNewCompanyType] = useState<ClientType | ''>('');
  const [newCompanyStreet1, setNewCompanyStreet1] = useState('');
  const [newCompanyPostcode, setNewCompanyPostcode] = useState('');
  const [newCompanyCity, setNewCompanyCity] = useState('');
  const [newCompanySiret, setNewCompanySiret] = useState('');

  const [contactMode, setContactMode] = useState<ContactMode>(
    initialMode === 'new-client' || initialContactMode === 'new' ? 'new' : 'existing',
  );
  const [selectedContactId, setSelectedContactId] = useState<string | null>(initialContactId);
  const [selectedDirectoryContact, setSelectedDirectoryContact] = useState<ContactListItem | null>(
    null,
  );
  const [contactCivility, setContactCivility] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');

  const [name, setName] = useState('');
  const [amountEur, setAmountEur] = useState('');
  const [prestation, setPrestation] = useState<Prestation[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearDefault = useMemo(() => new Date().getFullYear(), []);
  const debouncedQuery = useDebouncedValue(companyQuery, 300);
  const { data: companiesData, isLoading: companiesLoading } = useCompanies(
    companyMode === 'existing' ? debouncedQuery.trim() || undefined : undefined,
  );
  const { data: companyDetail, isLoading: companyDetailLoading } = useCompanyDetail(
    companyMode === 'existing' ? companyId : null,
  );
  const companies = companiesData?.companies ?? [];
  const companyContacts = companyDetail?.company.people ?? [];
  useEffect(() => {
    if (companyMode === 'new') {
      setContactMode('new');
      setSelectedContactId(null);
    }
  }, [companyMode]);

  useEffect(() => {
    if (companyMode !== 'existing' || !companyDetail?.company.name) return;
    if (!companyName) setCompanyName(companyDetail.company.name);
  }, [companyDetail?.company.name, companyMode, companyName]);

  useEffect(() => {
    if (companyMode !== 'existing' || !companyId) return;
    if (companyContacts.length === 0) {
      if (contactMode !== 'directory' && !selectedDirectoryContact) {
        setContactMode('directory');
      }
      return;
    }
    if (initialContactId && companyContacts.some((contact) => contact.id === initialContactId)) {
      setSelectedContactId(initialContactId);
      setSelectedDirectoryContact(null);
      setContactMode('existing');
      return;
    }
    if (!selectedContactId && !selectedDirectoryContact && companyContacts.length === 1) {
      setSelectedContactId(companyContacts[0].id);
      setContactMode('existing');
    }
  }, [
    companyContacts,
    companyId,
    companyMode,
    contactMode,
    initialContactId,
    selectedDirectoryContact,
    selectedContactId,
  ]);

  useEffect(() => {
    const sourceName =
      companyMode === 'existing'
        ? companyDetail?.company.name ?? companyName
        : newCompanyName.trim();

    if (!sourceName) return;
    setName((prev) => (prev.trim() ? prev : `Devis ${yearDefault} — ${sourceName}`));
  }, [companyDetail?.company.name, companyMode, companyName, newCompanyName, yearDefault]);

  function togglePrestation(value: Prestation) {
    setPrestation((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  function selectCompany(id: string, label: string) {
    setCompanyId(id);
    setCompanyName(label);
    setPickerOpen(false);
    setCompanyQuery('');
    setContactMode('existing');
    setSelectedContactId(null);
    setSelectedDirectoryContact(null);
  }

  function resetSelectedCompany() {
    setCompanyId(null);
    setCompanyName('');
    setSelectedContactId(null);
    setSelectedDirectoryContact(null);
    setContactMode('existing');
  }

  function selectCompanyContact(id: string) {
    setSelectedContactId(id);
    setSelectedDirectoryContact(null);
    setContactMode('existing');
  }

  function selectDirectoryContact(contact: ContactListItem) {
    setSelectedContactId(contact.id);
    setSelectedDirectoryContact(contact);
    setContactMode('directory');
  }

  async function createCompany(): Promise<CompanyCreateResponse> {
    const payload: CompanyCreatePayload = {
      name: newCompanyName.trim(),
      typeClient: newCompanyType,
      siret: newCompanySiret.trim() || null,
      address: {
        street1: newCompanyStreet1.trim(),
        postcode: newCompanyPostcode.trim(),
        city: newCompanyCity.trim(),
        country: 'France',
      },
    };

    return apiFetchWithSession<CompanyCreateResponse>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async function createContact(resolvedCompanyId: string, city: string | null) {
    const payload: PersonCreatePayload = {
      companyId: resolvedCompanyId,
      civility: contactCivility || null,
      firstName: contactFirstName.trim() || null,
      lastName: contactLastName.trim() || null,
      phone: contactPhone.trim() || null,
      phoneCode: '+33',
      email: contactEmail.trim() || null,
      city,
      jobTitle: contactJobTitle.trim() || null,
    };

    const response = await apiFetchWithSession<PersonCreateResponse>('/api/persons', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return response.person.id;
  }

  function validateForm(): string | null {
    if (companyMode === 'existing' && !companyId) {
      return 'Sélectionnez un client existant.';
    }

    if (companyMode === 'new') {
      if (!newCompanyName.trim()) return 'Le nom du nouveau client est requis.';
      if (!newCompanyType) return 'Le type de client est requis.';
      if (!newCompanyStreet1.trim()) return "L'adresse postale du client est requise.";
      if (!newCompanyPostcode.trim()) return 'Le code postal du client est requis.';
      if (!newCompanyCity.trim()) return 'La ville du client est requise.';
    }

    if (contactMode === 'existing' || contactMode === 'directory') {
      if (!selectedContactId) {
        return 'Sélectionnez un interlocuteur pour cette opportunité.';
      }
    } else {
      if (!contactFirstName.trim() && !contactLastName.trim()) {
        return 'Le nom du contact est requis.';
      }
      if (!contactPhone.trim()) {
        return 'Le numéro du contact est requis.';
      }
      if (!contactEmail.trim()) {
        return "L'email du contact est requis.";
      }
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const title = name.trim() || `Devis ${yearDefault}`;
    setSubmitting(true);

    try {
      let resolvedCompanyId = companyId;
      let resolvedCompanyCity = companyDetail?.company.address.city ?? null;

      if (companyMode === 'new') {
        const createdCompany = await createCompany();
        resolvedCompanyId = createdCompany.id;
        resolvedCompanyCity = createdCompany.address?.city ?? newCompanyCity.trim();
      }

      if (!resolvedCompanyId) {
        throw new Error('Aucun client disponible pour créer lopportunité.');
      }

      let pointOfContactId: string | null = selectedContactId;
      if (contactMode === 'new') {
        pointOfContactId = await createContact(resolvedCompanyId, resolvedCompanyCity);
      }

      const payload: OpportunityCreatePayload = {
        companyId: resolvedCompanyId,
        name: title,
        prestation: prestation.length ? prestation : undefined,
        pointOfContactId: pointOfContactId ?? undefined,
      };

      const parsedAmount = parseAmount(amountEur);
      if (parsedAmount != null) payload.amountEur = parsedAmount;

      const response = await apiFetchWithSession<{ id?: string }>('/api/opportunities', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.id) {
        router.push('/opportunities');
        router.refresh();
        return;
      }

      router.push('/opportunities');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Header
        title={companyMode === 'new' ? 'Nouveau client / opportunité' : 'Nouvelle opportunité'}
        subtitle="Parcours guidé client, contact puis opportunité"
      />

      <div className="p-6 pb-16 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/opportunities"
            className="mb-6 inline-block text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Retour aux opportunités
          </Link>

          <form onSubmit={handleSubmit} className="space-y-10">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Étape 1</p>
                  <h2 className="text-lg font-semibold text-gray-900">Client</h2>
                </div>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition',
                      companyMode === 'existing'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    )}
                    onClick={() => setCompanyMode('existing')}
                  >
                    Client existant
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition',
                      companyMode === 'new'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    )}
                    onClick={() => setCompanyMode('new')}
                  >
                    Nouveau client
                  </button>
                </div>
              </div>

              {companyMode === 'existing' ? (
                <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  {companyId ? (
                    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {companyDetail?.company.name ?? companyName ?? 'Chargement…'}
                        </p>
                        {(companyDetail?.company.address.postcode ||
                          companyDetail?.company.address.city) && (
                          <p className="text-sm text-gray-500">
                            {[
                              companyDetail?.company.address.postcode,
                              companyDetail?.company.address.city,
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-sm text-primary-600 hover:underline"
                        onClick={resetSelectedCompany}
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          className="pl-10"
                          placeholder="Rechercher une société…"
                          value={companyQuery}
                          onChange={(e) => {
                            setCompanyQuery(e.target.value);
                            setPickerOpen(true);
                          }}
                          onFocus={() => setPickerOpen(true)}
                          autoComplete="off"
                        />
                      </div>
                      {pickerOpen && (companyQuery.trim() || companiesLoading) && (
                        <ul
                          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                          role="listbox"
                        >
                          {companiesLoading && (
                            <li className="px-4 py-3 text-sm text-gray-500">Chargement…</li>
                          )}
                          {!companiesLoading &&
                            companies.map((company) => (
                              <li key={company.id}>
                                <button
                                  type="button"
                                  className={cn(
                                    'w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50',
                                    'focus:bg-gray-50 focus:outline-none',
                                  )}
                                  onClick={() => selectCompany(company.id, company.name)}
                                >
                                  {company.name}
                                </button>
                              </li>
                            ))}
                          {!companiesLoading && companies.length === 0 && companyQuery.trim() && (
                            <li className="px-4 py-3 text-sm text-gray-500">
                              Aucun résultat. Passe en mode <span className="font-medium">Nouveau client</span>{' '}
                              si la société n&apos;existe pas encore.
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Rechercher et sélectionner le client si la société existe déjà dans Twenty.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nom de l&apos;entité <span className="text-red-500">*</span>
                    </label>
                    <CompanyNameEntrepriseSearch
                      value={newCompanyName}
                      onChange={setNewCompanyName}
                      onPick={(pick) => {
                        setNewCompanyName(pick.name);
                        if (pick.street1) setNewCompanyStreet1(pick.street1);
                        if (pick.postcode) setNewCompanyPostcode(pick.postcode);
                        if (pick.city) setNewCompanyCity(pick.city);
                        setNewCompanySiret(pick.siret ?? '');
                      }}
                      placeholder="Nom du nouveau client"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      SIRET <span className="font-normal text-gray-400">(facultatif)</span>
                    </label>
                    <Input
                      value={newCompanySiret}
                      onChange={(e) => setNewCompanySiret(e.target.value.replace(/\s/g, ''))}
                      placeholder="14 chiffres"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={selectClass}
                      value={newCompanyType}
                      onChange={(e) => setNewCompanyType(e.target.value as ClientType)}
                    >
                      <option value="">Sélectionner un type</option>
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Adresse postale <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={newCompanyStreet1}
                      onChange={(e) => setNewCompanyStreet1(e.target.value)}
                      placeholder="Adresse"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Code postal <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={newCompanyPostcode}
                      onChange={(e) => setNewCompanyPostcode(e.target.value)}
                      placeholder="Code postal"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={newCompanyCity}
                      onChange={(e) => setNewCompanyCity(e.target.value)}
                      placeholder="Ville"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Étape 2</p>
                  <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
                </div>
                {companyMode === 'existing' && (
                  <div className="flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <button
                      type="button"
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition',
                        contactMode === 'existing'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )}
                      onClick={() => setContactMode('existing')}
                    >
                      Contacts du client
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition',
                        contactMode === 'directory'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )}
                      onClick={() => {
                        setContactMode('directory');
                        setSelectedContactId(null);
                        setSelectedDirectoryContact(null);
                      }}
                    >
                      Annuaire
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition',
                        contactMode === 'new'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )}
                      onClick={() => {
                        setContactMode('new');
                        setSelectedContactId(null);
                        setSelectedDirectoryContact(null);
                      }}
                    >
                      Nouveau contact
                    </button>
                  </div>
                )}
              </div>

              {contactMode === 'directory' && companyMode === 'existing' ? (
                <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  {!companyId ? (
                    <p className="text-sm text-gray-500">Sélectionnez d&apos;abord un client.</p>
                  ) : (
                    <>
                      {selectedDirectoryContact &&
                        selectedContactId === selectedDirectoryContact.id && (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <ContactSelectionCard
                                contact={selectedDirectoryContact}
                                showCompanyBadge
                                opportunityCompanyId={companyId}
                                subtitle={buildContactSubtitle(selectedDirectoryContact)}
                              />
                            </div>
                            <button
                              type="button"
                              className="text-sm font-medium text-gray-600 hover:text-gray-900"
                              onClick={() => {
                                setSelectedContactId(null);
                                setSelectedDirectoryContact(null);
                              }}
                            >
                              Changer de contact
                            </button>
                          </div>
                        )}
                      <ContactDirectorySearch
                        opportunityCompanyId={companyId}
                        disabled={submitting}
                        onSelect={selectDirectoryContact}
                      />
                    </>
                  )}
                </div>
              ) : contactMode === 'existing' && companyMode === 'existing' ? (
                <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  {companyDetailLoading && (
                    <p className="text-sm text-gray-500">Chargement des contacts…</p>
                  )}
                  {!companyDetailLoading && companyContacts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                      Aucun contact sur la fiche client. Utilisez l&apos;onglet Annuaire ou créez un
                      nouveau contact.
                    </div>
                  )}
                  {companyContacts.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {companyContacts.map((contact) => (
                        <ContactSelectionCard
                          key={contact.id}
                          contact={contact}
                          selected={selectedContactId === contact.id}
                          onClick={() => selectCompanyContact(contact.id)}
                          subtitle={buildContactSubtitle(contact)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Civilité</label>
                    <select
                      className={selectClass}
                      value={contactCivility}
                      onChange={(e) => setContactCivility(e.target.value)}
                    >
                      {CIVILITY_OPTIONS.map((option) => (
                        <option key={option.value || 'empty'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Fonction
                    </label>
                    <Input
                      value={contactJobTitle}
                      onChange={(e) => setContactJobTitle(e.target.value)}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Prénom
                    </label>
                    <Input
                      value={contactFirstName}
                      onChange={(e) => setContactFirstName(e.target.value)}
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={contactLastName}
                      onChange={(e) => setContactLastName(e.target.value)}
                      placeholder="Nom"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Numéro de contact <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Téléphone"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Email de contact <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Étape 3</p>
                <h2 className="text-lg font-semibold text-gray-900">Opportunité</h2>
              </div>

              <div className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Intitulé de l&apos;opportunité <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Ex. Devis ${yearDefault}-001`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Montant (€ HT)
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amountEur}
                    onChange={(e) => setAmountEur(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700">Prestations</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESTATION_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          'cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors',
                          prestation.includes(option.value)
                            ? 'border-primary-500 bg-primary-50 font-medium text-gray-900'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={prestation.includes(option.value)}
                          onChange={() => togglePrestation(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Création…' : "Créer l'opportunité"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/opportunities')}
              >
                Annuler
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
