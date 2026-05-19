'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCompanyDetail } from '@/hooks/useCompanyDetail';
import { useOpportunityNotes } from '@/hooks/useOpportunityNotes';
import { useOpportunityReminders } from '@/hooks/useOpportunityReminders';
import { ApiError, apiFetchWithSession } from '@/lib/api';
import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import { formatPhoneDisplay, formatPhoneHref } from '@/lib/phone';
import { formatCurrency, toDateInputValue } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';
import { OPPORTUNITY_STAGES } from '@/lib/opportunityStages';
import {
  bcMissing as rowBcMissing,
  effectiveWidgetFlags,
  getPilotQuote,
  isTerminalStage,
} from '@/lib/portailBundle';
import { ContactDirectorySearch } from '@/components/contacts/ContactDirectorySearch';
import { DevisListCompact } from '@/components/opportunities/DevisListCompact';
import { DevisLayer } from '@/components/opportunities/DevisLayer';
import { OpportunityStageCapsules } from '@/components/opportunities/OpportunityStageCapsules';
import { usePortailBundle } from '@/hooks/usePortailBundle';
import type {
  OpportunityContactUpdateResponse,
  OpportunityReminder,
  OpportunityRow,
  PersonCreatePayload,
  PersonCreateResponse,
  PortailBundle,
  PortailBundleDetailResponse,
} from '@/types';

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

const EMPTY_PORTAIL_BUNDLE: PortailBundle = {
  version: 2,
  pilotageId: null,
  quotes: [],
  standby: { active: false, until: null, reason: null },
  lastSentInitQuoteId: null,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type OpportunityDevisIntent = 'create' | 'edit-pilot' | null;

interface Props {
  opp: OpportunityRow | null;
  onClose: () => void;
  /** Au-dessus d’un autre tiroir (ex. fiche client). */
  stack?: 'default' | 'nested';
  onUpdated?: (patch: Partial<OpportunityRow>) => void;
  /** Ouvre le calque devis à l’affichage du tiroir (liste opportunités). */
  devisIntent?: OpportunityDevisIntent;
  onDevisIntentConsumed?: () => void;
}

interface DrawerContact {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  phone: string | null;
  phoneCode?: string | null;
  email: string | null;
  jobTitle?: string | null;
  isOpportunityContact: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function reminderStatusLabel(status: OpportunityReminder['status']): string {
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'DONE') return 'Terminé';
  return 'À faire';
}

function reminderStatusBadgeVariant(status: OpportunityReminder['status']) {
  if (status === 'IN_PROGRESS') return 'info' as const;
  if (status === 'DONE') return 'success' as const;
  return 'warning' as const;
}

export function OpportunityDrawer({
  opp,
  onClose,
  stack = 'default',
  onUpdated,
  devisIntent = null,
  onDevisIntentConsumed,
}: Props) {
  const isOpen = opp !== null;
  const zOverlay = stack === 'nested' ? 'z-[55]' : 'z-40';
  const zDrawer = stack === 'nested' ? 'z-[60]' : 'z-50';
  const {
    data: companyDetail,
    isLoading: contactsLoading,
    mutate: mutateCompanyDetail,
  } = useCompanyDetail(opp?.companyId ?? null);
  const { data: notesData, isLoading: notesLoading, mutate: mutateNotes } = useOpportunityNotes(opp?.id ?? null);
  const {
    data: remindersData,
    isLoading: remindersLoading,
    mutate: mutateReminders,
  } = useOpportunityReminders(opp?.id ?? null);
  const [noteBody, setNoteBody] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState<string | null>(null);
  const [updatingReminderId, setUpdatingReminderId] = useState<string | null>(null);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactActionError, setContactActionError] = useState<string | null>(null);
  const [contactActionSuccess, setContactActionSuccess] = useState<string | null>(null);
  const [updatingContactId, setUpdatingContactId] = useState<string | null>(null);
  const [contactCivility, setContactCivility] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');
  const [statusActionStage, setStatusActionStage] = useState<string | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const {
    detail: portailDetail,
    loading: portailLoading,
    error: portailError,
    setError: setPortailError,
    setDetail: setPortailDetail,
  } = usePortailBundle(opp?.id ?? null);
  const [portailBusy, setPortailBusy] = useState<string | null>(null);
  const [bcInput, setBcInput] = useState('');
  const [devisLayer, setDevisLayer] = useState<
    null | { mode: 'create' } | { mode: 'edit'; quoteId: string }
  >(null);

  const displayBundle = portailDetail?.bundle ?? opp?.portailBundle ?? EMPTY_PORTAIL_BUNDLE;
  const displayStage = portailDetail?.stage ?? opp?.stage ?? '';
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (devisLayer) {
        setDevisLayer(null);
        return;
      }
      onClose();
    },
    [onClose, devisLayer],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sortedNotes = useMemo(() => {
    return [...(notesData?.notes ?? [])].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [notesData?.notes]);

  const contacts = useMemo<DrawerContact[]>(() => {
    const map = new Map<string, DrawerContact>();

    if (opp?.contact) {
      map.set(opp.contact.id, {
        id: opp.contact.id,
        civility: opp.contact.civility ?? null,
        firstName: opp.contact.firstName ?? '',
        lastName: opp.contact.lastName ?? '',
        phone: opp.contact.phone ?? null,
        phoneCode: opp.contact.phoneCode ?? null,
        email: opp.contact.email ?? null,
        isOpportunityContact: true,
      });
    }

    for (const person of companyDetail?.company.people ?? []) {
      const previous = map.get(person.id);
      map.set(person.id, {
        id: person.id,
        firstName: person.firstName ?? previous?.firstName ?? '',
        lastName: person.lastName ?? previous?.lastName ?? '',
        civility: person.civility ?? previous?.civility ?? null,
        phone: person.phone ?? previous?.phone ?? null,
        phoneCode: person.phoneCode ?? previous?.phoneCode ?? null,
        email: person.email ?? previous?.email ?? null,
        jobTitle: person.jobTitle ?? null,
        isOpportunityContact: previous?.isOpportunityContact ?? false,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isOpportunityContact !== b.isOpportunityContact) {
        return a.isOpportunityContact ? -1 : 1;
      }
      const lastNameCompare = a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' });
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' });
    });
  }, [companyDetail, opp?.contact]);

  useEffect(() => {
    setNoteBody('');
    setNoteError(null);
    setNoteSuccess(null);
    setReminderDate(toDateInputValue(opp?.dateRelance));
    setReminderTime('');
    setReminderText('');
    setReminderError(null);
    setReminderSuccess(null);
    setShowNewContactForm(false);
    setContactSaving(false);
    setContactActionError(null);
    setContactActionSuccess(null);
    setUpdatingContactId(null);
    setContactCivility('');
    setContactFirstName('');
    setContactLastName('');
    setContactPhone('');
    setContactEmail('');
    setContactJobTitle('');
    setStatusActionStage(null);
    setStatusActionError(null);
    setPortailDetail(null);
    setPortailError(null);
    setPortailBusy(null);
    setBcInput('');
    setDevisLayer(null);
  }, [opp?.id, opp?.dateRelance]);

  useEffect(() => {
    if (!opp?.id || !devisIntent) return;
    if (devisIntent === 'create') {
      setDevisLayer({ mode: 'create' });
      onDevisIntentConsumed?.();
      return;
    }
    const bundle = portailDetail?.bundle ?? opp.portailBundle ?? EMPTY_PORTAIL_BUNDLE;
    const pilot = getPilotQuote(bundle);
    if (pilot) {
      setDevisLayer({ mode: 'edit', quoteId: pilot.id });
    } else {
      setDevisLayer({ mode: 'create' });
    }
    onDevisIntentConsumed?.();
  }, [opp?.id, opp?.portailBundle, devisIntent, portailDetail?.bundle, onDevisIntentConsumed]);

  useEffect(() => {
    if (portailDetail?.bonDeCommandeRef != null) {
      setBcInput(portailDetail.bonDeCommandeRef ?? '');
    }
  }, [portailDetail?.bonDeCommandeRef]);

  function applyPortailServerRow(bundle: PortailBundle, stage: string, bonDeCommandeRef: string | null) {
    setPortailDetail((d) => ({ bundle, stage, bonDeCommandeRef, remisePresets: d?.remisePresets }));
    setBcInput(bonDeCommandeRef ?? '');
    const pilot = getPilotQuote(bundle);
    const remiseEur =
      pilot?.montantBrutEur != null && pilot?.montantNetEur != null
        ? Math.round((pilot.montantBrutEur - pilot.montantNetEur) * 100) / 100
        : null;
    onUpdated?.({
      stage,
      bonDeCommandeRef,
      bcMissing: rowBcMissing(bonDeCommandeRef, stage),
      portailWidgets: effectiveWidgetFlags(bundle, stage),
      portailBundle: bundle,
      ...(pilot
        ? {
            amountEur: pilot.montantNetEur,
            montantInitialEur: pilot.montantBrutEur,
            montantRemiseEur: remiseEur,
            tauxRemise: pilot.tauxRemise,
            prestation: pilot.prestations,
            numeroDevis: pilot.numero.replace(/-[A-Z]$/, ''),
          }
        : {}),
    });
  }

  async function handleAssignOpportunityContact(contactId: string) {
    if (!opp) return;

    setUpdatingContactId(contactId);
    setContactActionError(null);
    setContactActionSuccess(null);
    try {
      const response = await apiFetchWithSession<OpportunityContactUpdateResponse>(
        `/api/opportunities/${opp.id}/contact`,
        {
          method: 'PATCH',
          body: JSON.stringify({ pointOfContactId: contactId }),
        },
      );
      onUpdated?.({ contact: response.contact ?? null });
      setContactActionSuccess('Point de contact opportunité mis à jour.');
    } catch (contactError) {
      setContactActionError(
        getErrorMessage(contactError, 'Impossible de mettre à jour le point de contact'),
      );
    } finally {
      setUpdatingContactId(null);
    }
  }

  async function handleCreateContactAndAssign() {
    if (!opp?.companyId) return;
    if (!contactFirstName.trim() && !contactLastName.trim()) {
      setContactActionError('Le nom du contact est requis.');
      setContactActionSuccess(null);
      return;
    }
    if (!contactPhone.trim()) {
      setContactActionError('Le numéro du contact est requis.');
      setContactActionSuccess(null);
      return;
    }
    if (!contactEmail.trim()) {
      setContactActionError("L'email du contact est requis.");
      setContactActionSuccess(null);
      return;
    }

    setContactSaving(true);
    setContactActionError(null);
    setContactActionSuccess(null);

    try {
      const payload: PersonCreatePayload = {
        companyId: opp.companyId,
        civility: contactCivility || null,
        firstName: contactFirstName.trim() || null,
        lastName: contactLastName.trim() || null,
        phone: contactPhone.trim() || null,
        phoneCode: '+33',
        email: contactEmail.trim() || null,
        city: companyDetail?.company.address.city ?? null,
        jobTitle: contactJobTitle.trim() || null,
      };

      const response = await apiFetchWithSession<PersonCreateResponse>('/api/persons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await mutateCompanyDetail();
      await handleAssignOpportunityContact(response.person.id);
      setShowNewContactForm(false);
      setContactCivility('');
      setContactFirstName('');
      setContactLastName('');
      setContactPhone('');
      setContactEmail('');
      setContactJobTitle('');
      setContactActionSuccess('Nouveau contact créé et affecté à l’opportunité.');
    } catch (contactError) {
      setContactActionError(getErrorMessage(contactError, 'Impossible de créer le contact'));
    } finally {
      setContactSaving(false);
    }
  }

  async function handleCreateNote() {
    if (!opp || !noteBody.trim()) return;

    setNoteSaving(true);
    setNoteError(null);
    setNoteSuccess(null);
    try {
      await apiFetchWithSession(`/api/opportunities/${opp.id}/note`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Note ${opp.numeroDevis ?? opp.name}`,
          body: noteBody.trim(),
        }),
      });
      setNoteBody('');
      setNoteSuccess('Note ajoutée dans Twenty.');
      await mutateNotes();
    } catch (error) {
      setNoteError(getErrorMessage(error, "Impossible d'ajouter la note"));
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleCreateReminder() {
    if (!opp) return;
    if (!reminderDate || !reminderTime || !reminderText.trim()) {
      setReminderError('Renseignez la date, l’heure et le texte du rappel.');
      setReminderSuccess(null);
      return;
    }

    setReminderSaving(true);
    setReminderError(null);
    setReminderSuccess(null);
    try {
      const response = await apiFetchWithSession<{ dateRelance?: string | null }>(
        `/api/opportunities/${opp.id}/reminder`,
        {
          method: 'POST',
          body: JSON.stringify({
            date: reminderDate,
            time: reminderTime,
            text: reminderText.trim(),
            title: `Relance ${opp.numeroDevis ?? opp.name}`,
          }),
        },
      );
      onUpdated?.({ dateRelance: response.dateRelance ?? null });
      setReminderText('');
      setReminderTime('');
      await mutateReminders();
      setReminderSuccess('Relance créée dans Twenty et synchronisée sur l’opportunité.');
    } catch (error) {
      setReminderError(getErrorMessage(error, 'Impossible de créer la relance'));
    } finally {
      setReminderSaving(false);
    }
  }

  async function handleUpdateReminderStatus(
    reminderId: string,
    status: OpportunityReminder['status'],
  ) {
    if (!opp) return;

    setUpdatingReminderId(reminderId);
    setReminderError(null);
    setReminderSuccess(null);
    try {
      const response = await apiFetchWithSession<{ dateRelance?: string | null }>(
        `/api/opportunities/${opp.id}/reminders/${reminderId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
      onUpdated?.({ dateRelance: response.dateRelance ?? null });
      await mutateReminders();
      setReminderSuccess(`Statut du rappel mis à jour : ${reminderStatusLabel(status)}.`);
    } catch (error) {
      setReminderError(getErrorMessage(error, 'Impossible de mettre à jour le rappel'));
    } finally {
      setUpdatingReminderId(null);
    }
  }

  async function handleUpdateOpportunityStage(stage: string): Promise<boolean> {
    if (!opp) return false;

    setStatusActionStage(stage);
    setStatusActionError(null);
    try {
      const pilot = getPilotQuote(displayBundle);
      const isWon = stage === OPPORTUNITY_STAGES.WON || stage === 'GAGNE';
      const body: { status: string; quoteId?: string } = { status: stage };
      if (isWon && pilot?.id) body.quoteId = pilot.id;

      const response = await apiFetchWithSession<{
        success?: boolean;
        stage?: string;
        bundle?: PortailBundle;
        updateOpportunity?: { stage?: string };
      }>(`/api/opportunities/${opp.id}/status`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const newStage =
        response.stage ?? response.updateOpportunity?.stage ?? stage;
      if (response.bundle) {
        applyPortailServerRow(response.bundle, newStage, currentBonDeCommandeRef());
      } else {
        setPortailDetail((d) => (d ? { ...d, stage: newStage } : d));
        onUpdated?.({ stage: newStage });
      }
      return true;
    } catch (error) {
      setStatusActionError(
        getErrorMessage(error, `Impossible de passer l'opportunité à ${opportunityStageLabel(stage)}`),
      );
      return false;
    } finally {
      setStatusActionStage(null);
    }
  }

  function currentBonDeCommandeRef(): string | null {
    return portailDetail?.bonDeCommandeRef ?? opp?.bonDeCommandeRef ?? null;
  }

  async function handleSaveBonCommande() {
    if (!opp) return;
    setPortailBusy('bc');
    setPortailError(null);
    try {
      const refTrim = bcInput.trim();
      await apiFetchWithSession(`/api/opportunities/${opp.id}/bon-commande`, {
        method: 'PATCH',
        body: JSON.stringify({ bonDeCommandeRef: refTrim }),
      });
      const bc = refTrim || null;
      setPortailDetail((d) =>
        d
          ? { ...d, bonDeCommandeRef: bc }
          : { bundle: displayBundle, stage: displayStage, bonDeCommandeRef: bc },
      );
      onUpdated?.({
        bonDeCommandeRef: bc,
        bcMissing: rowBcMissing(bc, displayStage),
      });
    } catch (e) {
      setPortailError(getErrorMessage(e, 'Enregistrement du bon de commande impossible'));
    } finally {
      setPortailBusy(null);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 ${zOverlay} bg-black/20 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 ${zDrawer} flex w-full max-w-[46.8rem] flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {opp && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="w-[15rem] shrink-0 break-words">
                  {opp.companyId ? (
                    <Link
                      href={`/clients/${opp.companyId}`}
                      className="block text-lg font-bold leading-snug text-primary-700 hover:text-primary-600 hover:underline transition-colors"
                      onClick={onClose}
                    >
                      {opp.companyName ?? opp.name}
                    </Link>
                  ) : (
                    <p className="text-lg font-bold leading-snug text-primary-700">
                      {opp.companyName ?? opp.name}
                    </p>
                  )}
                  {(opp.companyPostcode || opp.companyCity) && (
                    <p className="mt-0.5 break-words text-sm leading-snug text-gray-400">
                      {[opp.companyPostcode, opp.companyCity].filter(Boolean).join(' ')}
                    </p>
                  )}
                  {opp.companyStreet && (
                    <p className="break-words text-xs leading-snug text-gray-400">
                      {opp.companyStreet}
                    </p>
                  )}
                </div>
                <div className="w-px shrink-0 self-stretch bg-gray-200" aria-hidden="true" />
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-lg font-bold leading-snug text-primary-700">{opp.name}</p>
                  {opp.numeroDevis && (
                    <p className="mt-0.5 break-all font-mono text-sm text-gray-500">
                      {opp.numeroDevis}
                    </p>
                  )}
                  {opp.dateDevis && (
                    <p className="mt-1 text-xs text-gray-400">
                      Devis du {formatDate(opp.dateDevis)}
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={`/opportunities/${opp.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                  aria-label="Éditer la fiche complète"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Badge variant={opportunityStageBadgeVariant(displayStage)} className="whitespace-nowrap">
                  {opportunityStageLabel(displayStage)}
                </Badge>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Montant + liste devis */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={portailBusy !== null || devisLayer !== null || portailLoading}
                    onClick={() => setDevisLayer({ mode: 'create' })}
                  >
                    + Nouveau Devis
                  </Button>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                  <div className="shrink-0 sm:min-w-[7rem]">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Montant
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {opp.amountEur != null ? formatCurrency(opp.amountEur) : '—'}
                    </p>
                    {opp.amountEur != null &&
                      opp.montantInitialEur != null &&
                      opp.tauxRemise != null &&
                      opp.tauxRemise > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="text-gray-400 line-through">
                            {formatCurrency(opp.montantInitialEur)}
                          </span>
                          <span className="font-medium text-green-600">-{opp.tauxRemise}%</span>
                        </div>
                      )}
                  </div>
                  <div className="min-w-0 flex-1 border-gray-200 sm:border-l sm:pl-6">
                    {portailLoading && (
                      <p className="text-sm text-gray-400">Chargement des devis…</p>
                    )}
                    {portailError && displayBundle.quotes.length === 0 && (
                      <p className="mb-2 text-sm text-red-600">{portailError}</p>
                    )}
                    {!portailLoading && (
                      <DevisListCompact
                        bundle={displayBundle}
                        onSelectQuote={(quoteId) =>
                          setDevisLayer({ mode: 'edit', quoteId })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Prestations */}
              {opp.prestation.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Prestations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {opp.prestation.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                      >
                        {PRESTATION_LABELS[p] ?? p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <OpportunityStageCapsules
                currentStage={displayStage}
                updatingStage={statusActionStage}
                errorMessage={statusActionError}
                onSelectStage={handleUpdateOpportunityStage}
              />

              {(displayStage === OPPORTUNITY_STAGES.WON || displayStage === 'GAGNE') && (
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Bon de commande
                  </p>
                  {rowBcMissing(bcInput || null, displayStage) && (
                    <p className="mb-2 text-sm text-amber-800">
                      Opportunité gagnée sans référence BC renseignée.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="min-w-[12rem] flex-1"
                      value={bcInput}
                      onChange={(e) => setBcInput(e.target.value)}
                      placeholder="Réf. bon de commande"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={portailBusy !== null}
                      onClick={() => void handleSaveBonCommande()}
                    >
                      {portailBusy === 'bc' ? '…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              )}


              {/* Contacts */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Contacts
                  </p>
                  <div className="flex items-center gap-2">
                    {contactsLoading && (
                      <span className="text-[11px] text-gray-400">Chargement des contacts…</span>
                    )}
                    {opp.companyId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setShowNewContactForm((current) => !current);
                          setContactActionError(null);
                          setContactActionSuccess(null);
                        }}
                      >
                        {showNewContactForm ? 'Annuler' : 'Nouveau contact'}
                      </Button>
                    )}
                  </div>
                </div>
                {contacts.length > 0 ? (
                  <div className="space-y-3">
                    {contacts.map((contact) => {
                      const phoneHref = formatPhoneHref(contact.phone, contact.phoneCode);
                      const phoneLabel = formatPhoneDisplay(contact.phone, contact.phoneCode);
                      const primaryLine = formatContactPrimaryLine(contact);
                      const firstNameLabel = formatContactFirstName(contact.firstName);
                      const isUpdating = updatingContactId === contact.id;
                      return (
                        <div
                          key={contact.id}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                                {primaryLine}
                              </p>
                              {firstNameLabel && (
                                <p className="text-sm text-gray-600">{firstNameLabel}</p>
                              )}
                              {contact.jobTitle && (
                                <p className="mt-1 text-xs text-gray-500">{contact.jobTitle}</p>
                              )}
                            </div>
                            {contact.isOpportunityContact ? (
                              <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                                Point de contact opportunité
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isUpdating}
                                onClick={() => handleAssignOpportunityContact(contact.id)}
                              >
                                {isUpdating ? 'Affectation…' : 'Définir pour l’opportunité'}
                              </Button>
                            )}
                          </div>
                          <div className="mt-3 space-y-2">
                            {contact.phone && (
                              <a
                                href={phoneHref ? `tel:${phoneHref}` : undefined}
                                className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.0 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                                </svg>
                                {phoneLabel}
                              </a>
                            )}
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                className="flex items-center gap-2 break-all text-sm text-gray-700 hover:text-primary-600"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                                  <path d="M2 7l10 7 10-7"/>
                                </svg>
                                {contact.email}
                              </a>
                            )}
                            {!contact.phone && !contact.email && (
                              <p className="text-sm text-gray-400">Aucune coordonnée disponible.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
                    Aucun contact rattaché à ce client sur sa fiche. Recherchez un interlocuteur dans
                    l&apos;annuaire ci-dessous.
                  </div>
                )}

                {opp.companyId && (
                  <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Annuaire des contacts
                    </p>
                    <ContactDirectorySearch
                      opportunityCompanyId={opp.companyId}
                      disabled={contactSaving || updatingContactId !== null}
                      onSelect={(contact) => void handleAssignOpportunityContact(contact.id)}
                    />
                  </div>
                )}

                {showNewContactForm && opp.companyId && (
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

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateContactAndAssign}
                        disabled={contactSaving}
                      >
                        {contactSaving ? 'Création…' : 'Créer et affecter'}
                      </Button>
                    </div>
                  </div>
                )}

                {contactActionError && (
                  <p className="mt-3 text-sm text-red-600">{contactActionError}</p>
                )}
                {contactActionSuccess && (
                  <p className="mt-3 text-sm text-green-600">{contactActionSuccess}</p>
                )}
              </div>

              {/* Note */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Historique des notes
                  </p>
               
                </div>
                <div className="mb-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  {notesLoading && (
                    <p className="text-sm text-gray-400">Chargement des notes…</p>
                  )}
                  {!notesLoading && sortedNotes.length === 0 && (
                    <p className="text-sm text-gray-400">Aucune note pour cette opportunité.</p>
                  )}
                  {sortedNotes.map((note) => {
                    const content = note.body?.trim() || note.title?.trim() || 'Note sans contenu';
                    return (
                      <div key={note.id} className="flex justify-start">
                        <div className="max-w-[85%]">
                          <p className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            {formatDateTime(note.createdAt)}
                          </p>
                          <div className="rounded-2xl rounded-tl-md border border-primary-200 bg-primary-50 px-4 py-2 shadow-sm">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                              {content}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Ajouter une note
                    </p>
                  </div>
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Saisir une note liée à cette opportunité…"
                    className="min-h-28 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  {noteError && (
                    <p className="mt-2 text-sm text-red-600">{noteError}</p>
                  )}
                  {noteSuccess && (
                    <p className="mt-2 text-sm text-green-600">{noteSuccess}</p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateNote}
                      disabled={noteSaving || !noteBody.trim()}
                    >
                      {noteSaving ? 'Ajout…' : 'Ajouter la note'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Rappel */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Rappels positionnés
                  </p>
                </div>
                <div className="mb-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  {remindersLoading && (
                    <p className="text-sm text-gray-400">Chargement des rappels…</p>
                  )}
                  {!remindersLoading && (remindersData?.reminders.length ?? 0) === 0 && (
                    <p className="text-sm text-gray-400">Aucun rappel pour cette opportunité.</p>
                  )}
                  {(remindersData?.reminders ?? []).map((reminder) => {
                    const content = reminder.body?.trim() || 'Rappel sans contenu';
                    const isUpdating = updatingReminderId === reminder.id;
                    const isDone = reminder.status === 'DONE';

                    return (
                      <div key={reminder.id} className="rounded-2xl border border-primary-100 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={`min-w-0 flex-1 whitespace-pre-wrap pr-2 text-sm leading-relaxed ${
                              isDone ? 'text-gray-500 line-through' : 'text-gray-800'
                            }`}
                          >
                            {content}
                          </p>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              {reminder.dueAt
                                ? `Prévu le ${formatDateTime(reminder.dueAt)}`
                                : `Créé le ${formatDateTime(reminder.createdAt)}`}
                            </p>
                            <Badge variant={reminderStatusBadgeVariant(reminder.status)}>
                              {reminderStatusLabel(reminder.status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
                            <Button
                              key={status}
                              type="button"
                              size="sm"
                              variant={
                                status === 'DONE'
                                  ? 'success'
                                  : status === reminder.status
                                    ? 'primary'
                                    : 'secondary'
                              }
                              className="min-w-[92px]"
                              disabled={isUpdating || status === reminder.status}
                              onClick={() => handleUpdateReminderStatus(reminder.id, status)}
                            >
                              {reminderStatusLabel(status)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Ajouter un rappel
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                    />
                  </div>
                  <textarea
                    value={reminderText}
                    onChange={(e) => setReminderText(e.target.value)}
                    placeholder="Texte du rappel…"
                    className="mt-3 min-h-24 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                  {reminderError && (
                    <p className="mt-2 text-sm text-red-600">{reminderError}</p>
                  )}
                  {reminderSuccess && (
                    <p className="mt-2 text-sm text-green-600">{reminderSuccess}</p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateReminder}
                      disabled={reminderSaving}
                    >
                      {reminderSaving ? 'Création…' : 'Créer le rappel'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Dates complémentaires */}
              {(opp.dateRelance || opp.closeDate) && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Échéances
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                  {opp.dateRelance && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date relance</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{formatDate(opp.dateRelance)}</p>
                    </div>
                  )}
                  {opp.closeDate && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date clôture</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{formatDate(opp.closeDate)}</p>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {devisLayer && opp && (
        <DevisLayer
          opportunityId={opp.id}
          companyName={opp.companyName}
          mode={devisLayer.mode}
          quoteId={devisLayer.mode === 'edit' ? devisLayer.quoteId : null}
          bundle={displayBundle}
          stage={displayStage}
          terminalOpp={isTerminalStage(displayStage)}
          onClose={() => setDevisLayer(null)}
          onSaved={(bundle, stage) =>
            applyPortailServerRow(bundle, stage, currentBonDeCommandeRef())
          }
        />
      )}
    </>
  );
}
