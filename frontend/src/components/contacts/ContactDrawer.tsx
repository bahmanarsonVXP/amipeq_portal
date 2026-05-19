'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import { formatCreatedUpdatedMeta } from '@/lib/metaDates';
import { formatPhoneDisplay, formatPhoneHref } from '@/lib/phone';
import { useCompanies } from '@/hooks/useCompanies';
import { useContactDetail } from '@/hooks/useContactDetail';
import type {
  ContactListItem,
  PersonCreatePayload,
  PersonCreateResponse,
  PersonUpdatePayload,
  PersonUpdateResponse,
} from '@/types';

const CONTACT_CIVILITY_OPTIONS = [
  { value: '', label: 'Civilité' },
  { value: 'MONSSIEUR', label: 'M.' },
  { value: 'MADAME', label: 'Mme' },
  { value: 'MADEMOISELLE', label: 'Mlle' },
] as const;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

interface Props {
  contactId: string | null;
  mode: 'view' | 'create';
  initialEditing?: boolean;
  onClose: () => void;
  onSaved?: (contact: ContactListItem) => void;
  onDeleted?: (contactId: string) => void;
  onOpenCompany?: (companyId: string) => void;
}

export function ContactDrawer({
  contactId,
  mode,
  initialEditing = false,
  onClose,
  onSaved,
  onDeleted,
  onOpenCompany,
}: Props) {
  const isCreate = mode === 'create';
  const isOpen = isCreate || contactId !== null;
  const { data, error, isLoading, mutate } = useContactDetail(isCreate ? null : contactId);
  const contact = data?.contact;

  const [companySearch, setCompanySearch] = useState('');
  const { data: companiesData } = useCompanies(companySearch.trim() || undefined);
  const companies = companiesData?.companies ?? [];

  const [editing, setEditing] = useState(isCreate);
  const [civility, setCivility] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const resetForm = useCallback((source?: ContactListItem | null) => {
    setCivility(source?.civility ?? '');
    setFirstName(source?.firstName ?? '');
    setLastName(source?.lastName ?? '');
    setJobTitle(source?.jobTitle ?? '');
    setPhone(source?.phone ?? '');
    setEmail(source?.email ?? '');
    setCompanyId(source?.companyId ?? '');
    setCompanySearch(source?.companyName ?? '');
    setFormError(null);
  }, []);

  useEffect(() => {
    if (isCreate) {
      setEditing(true);
      resetForm(null);
      return;
    }
    setEditing(initialEditing);
    resetForm(contact ?? null);
  }, [contact, contactId, initialEditing, isCreate, resetForm]);

  const displayName = useMemo(() => {
    if (contact) return formatContactPrimaryLine(contact);
    if (firstName || lastName) {
      return formatContactPrimaryLine({ civility, firstName, lastName });
    }
    return isCreate ? 'Nouveau contact' : 'Chargement…';
  }, [contact, civility, firstName, lastName, isCreate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDelete) onClose();
    },
    [confirmDelete, onClose],
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

  async function handleSave() {
    if (!firstName.trim() && !lastName.trim()) {
      setFormError('Le nom du contact est requis.');
      return;
    }
    if (!companyId) {
      setFormError('Sélectionnez un client rattaché.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload: PersonCreatePayload | PersonUpdatePayload = {
      companyId,
      civility: civility || null,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      phone: phone.trim() || null,
      phoneCode: '+33',
      email: email.trim() || null,
      jobTitle: jobTitle.trim() || null,
    };

    try {
      if (isCreate) {
        const response = await apiFetchWithSession<PersonCreateResponse>('/api/persons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const saved: ContactListItem = {
          id: response.person.id,
          firstName: response.person.firstName,
          lastName: response.person.lastName,
          civility: response.person.civility ?? null,
          email: response.person.email ?? null,
          phone: response.person.phone ?? null,
          phoneCode: response.person.phoneCode ?? null,
          jobTitle: response.person.jobTitle ?? null,
          companyId: response.person.companyId,
          companyName: companySearch || null,
        };
        onSaved?.(saved);
        onClose();
        return;
      }

      if (!contactId) return;

      const response = await apiFetchWithSession<PersonUpdateResponse>(
        `/api/persons/${contactId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );
      await mutate();
      setEditing(false);
      onSaved?.(response.contact);
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, 'Enregistrement impossible'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contactId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetchWithSession(`/api/persons/${contactId}`, { method: 'DELETE' });
      onDeleted?.(contactId);
      setConfirmDelete(false);
      onClose();
    } catch (deleteErr) {
      setDeleteError(getErrorMessage(deleteErr, 'Suppression impossible'));
    } finally {
      setDeleting(false);
    }
  }

  const phoneHref = formatPhoneHref(phone || contact?.phone, '+33');
  const phoneLabel = formatPhoneDisplay(phone || contact?.phone, '+33');
  const firstNameLabel = formatContactFirstName(contact?.firstName ?? firstName);

  return (
    <>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce contact ?"
        description={
          contact && (
            <>
              Supprimer définitivement{' '}
              <span className="font-semibold text-gray-900">{displayName}</span>
              {contact.companyName && (
                <>
                  {' '}
                  rattaché à{' '}
                  <span className="font-semibold text-gray-900">{contact.companyName}</span>
                </>
              )}
              ? Cette action est irréversible.
            </>
          )
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        errorMessage={deleteError}
        onConfirm={handleDelete}
        onClose={() => {
          if (deleting) return;
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      />

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
                <p className="truncate text-lg font-bold text-gray-900">{displayName}</p>
                {firstNameLabel && <p className="mt-0.5 text-sm text-gray-500">{firstNameLabel}</p>}
                {contact?.companyName && !editing && (
                  <p className="mt-1 text-sm text-gray-500">{contact.companyName}</p>
                )}
                {contact && !isCreate && (
                  <p className="mt-2 text-[11px] italic text-gray-500">
                    {formatCreatedUpdatedMeta(contact.createdAt, contact.updatedAt)}
                  </p>
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
              {error && !isCreate && (
                <p className="text-sm text-red-700">Impossible de charger le contact.</p>
              )}
              {isLoading && !isCreate && !contact && (
                <p className="text-sm text-gray-500">Chargement…</p>
              )}

              {(isCreate || contact) && (
                <>
                  {!editing && contact && (
                    <>
                      <DrawerActions
                        onEdit={() => {
                          resetForm(contact);
                          setEditing(true);
                        }}
                        onDelete={() => {
                          setDeleteError(null);
                          setConfirmDelete(true);
                        }}
                      />

                      <div className="space-y-4 text-sm text-gray-700">
                        {contact.companyName && contact.companyId && (
                          <p>
                            <span className="font-medium text-gray-400">Client </span>
                            {onOpenCompany ? (
                              <button
                                type="button"
                                onClick={() => onOpenCompany(contact.companyId!)}
                                className="font-medium text-primary-700 hover:underline"
                              >
                                {contact.companyName}
                              </button>
                            ) : (
                              <span>{contact.companyName}</span>
                            )}
                          </p>
                        )}
                        {contact.jobTitle && (
                          <p>
                            <span className="font-medium text-gray-400">Fonction </span>
                            {contact.jobTitle}
                          </p>
                        )}
                        {contact.phone && (
                          <p>
                            <span className="font-medium text-gray-400">Tél. </span>
                            <a
                              href={phoneHref ? `tel:${phoneHref}` : undefined}
                              className="hover:text-primary-600"
                            >
                              {phoneLabel}
                            </a>
                          </p>
                        )}
                        {contact.email && (
                          <p>
                            <span className="font-medium text-gray-400">Email </span>
                            <a
                              href={`mailto:${contact.email}`}
                              className="break-all hover:text-primary-600"
                            >
                              {contact.email}
                            </a>
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {editing && (
                    <EditForm
                      civility={civility}
                      setCivility={setCivility}
                      firstName={firstName}
                      setFirstName={setFirstName}
                      lastName={lastName}
                      setLastName={setLastName}
                      jobTitle={jobTitle}
                      setJobTitle={setJobTitle}
                      phone={phone}
                      setPhone={setPhone}
                      email={email}
                      setEmail={setEmail}
                      companyId={companyId}
                      setCompanyId={setCompanyId}
                      companySearch={companySearch}
                      setCompanySearch={setCompanySearch}
                      companies={companies}
                      formError={formError}
                      saving={saving}
                      isCreate={isCreate}
                      onCancel={() => {
                        if (isCreate) {
                          onClose();
                          return;
                        }
                        resetForm(contact ?? null);
                        setEditing(false);
                        setFormError(null);
                      }}
                      onSave={handleSave}
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DrawerActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={onEdit}>
        Modifier
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={onDelete}>
        Supprimer
      </Button>
    </div>
  );
}

function EditForm({
  civility,
  setCivility,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  jobTitle,
  setJobTitle,
  phone,
  setPhone,
  email,
  setEmail,
  companyId,
  setCompanyId,
  companySearch,
  setCompanySearch,
  companies,
  formError,
  saving,
  isCreate,
  onCancel,
  onSave,
}: {
  civility: string;
  setCivility: (v: string) => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  jobTitle: string;
  setJobTitle: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  companyId: string;
  setCompanyId: (v: string) => void;
  companySearch: string;
  setCompanySearch: (v: string) => void;
  companies: { id: string; name: string }[];
  formError: string | null;
  saving: boolean;
  isCreate: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Client</label>
        <Input
          placeholder="Rechercher un client…"
          value={companySearch}
          onChange={(e) => {
            setCompanySearch(e.target.value);
            setCompanyId('');
          }}
        />
        {companies.length > 0 && !companyId && (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            {companies.slice(0, 8).map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => {
                    setCompanyId(company.id);
                    setCompanySearch(company.name);
                  }}
                >
                  {company.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {companyId && (
          <p className="mt-1 text-xs text-green-700">Client sélectionné : {companySearch}</p>
        )}
      </div>

      <select
        value={civility}
        onChange={(e) => setCivility(e.target.value)}
        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {CONTACT_CIVILITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Fonction</label>
        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Prénom</label>
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Nom</label>
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Téléphone</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? 'Enregistrement…' : isCreate ? 'Créer le contact' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
