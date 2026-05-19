'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  OpportunityDrawer,
  type OpportunityDevisIntent,
} from '@/components/opportunities/OpportunityDrawer';
import { useOpportunities } from '@/hooks/useOpportunities';
import { apiFetchWithSession, ApiError } from '@/lib/api';
import {
  formatContactFirstName,
  formatContactPrimaryLine,
} from '@/lib/contactDisplay';
import {
  defaultPortailBundle,
  effectiveWidgetFlags,
} from '@/lib/portailBundle';
import { formatCreatedUpdatedMeta } from '@/lib/metaDates';
import {
  OPPORTUNITY_UPDATED_WITHIN_OPTIONS,
  matchesOpenOpportunityUpdatedWithin,
  parseOpportunityUpdatedWithinMonths,
} from '@/lib/opportunityFilters';
import { formatPhoneDisplay } from '@/lib/phone';
import { formatCurrency } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';
import {
  getOpportunityRowActions,
  rowActionButtonClass,
} from '@/lib/opportunityRowActions';
import {
  mapLegacyStageToOpp,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_SELECT_OPTIONS,
} from '@/lib/opportunityStages';
import type { BcManquantReportResponse, OpportunityRow } from '@/types';

const STAGE_OPTIONS = [{ value: '', label: 'Tous les statuts' }, ...OPPORTUNITY_STAGE_SELECT_OPTIONS];

const PRESTATION_OPTIONS = [
  { value: '', label: 'Toutes prestations' },
  { value: 'DU', label: 'DU' },
  { value: 'MAJ_DU', label: 'MAJ DU' },
  { value: 'MAJ_DU_DEMAT', label: 'MAJ DU Démat.' },
  { value: 'DUERP', label: 'DUERP' },
  { value: 'MAJ_DUERP', label: 'MAJ DUERP' },
  { value: 'MAJ_DU_DISTANCE', label: 'MAJ DU à Distance' },
  { value: 'DU_SITE_DISTANCE', label: 'DU Sur SITE ou à DISTANCE' },
  { value: 'PPMS', label: 'PPMS' },
  { value: 'MAJ_PPMS', label: 'MAJ PPMS' },
  { value: 'DU_DISTANCE', label: 'DU à Distance' },
  { value: 'RPS', label: 'RPS' },
  { value: 'RPS_ENTRETIENS', label: 'RPS avec Entretiens' },
  { value: 'RPS_ET_ENTRETIENS', label: 'RPS et/ou Entretiens' },
];

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

function deptFromPostcode(postcode: string | null): string | null {
  if (!postcode) return null;
  return postcode.startsWith('97') ? postcode.slice(0, 3) : postcode.slice(0, 2);
}

function opportunityRowFromBcReport(r: BcManquantReportResponse['opportunities'][number]): OpportunityRow {
  const portailBundle = defaultPortailBundle();
  return {
    id: r.id,
    createdAt: null,
    updatedAt: null,
    name: r.name,
    stage: r.stage,
    amountEur: null,
    montantInitialEur: null,
    montantRemiseEur: null,
    tauxRemise: null,
    currencyCode: 'EUR',
    prestation: [],
    companyId: r.companyId,
    companyName: r.companyName,
    companyPostcode: null,
    companyCity: null,
    companyStreet: null,
    closeDate: null,
    numeroDevis: r.numeroDevis,
    statutDevis: null,
    dateDevis: null,
    dateRelance: null,
    anneeDevis: null,
    bonDeCommandeRef: r.bonDeCommandeRef,
    bcMissing: r.bcMissing,
    portailBundle,
    portailWidgets: effectiveWidgetFlags(portailBundle, r.stage),
    contact: null,
  };
}

function allDepts(opportunities: OpportunityRow[]): string[] {
  const set = new Set<string>();
  for (const o of opportunities) {
    const dept = deptFromPostcode(o.companyPostcode);
    if (dept) set.add(dept);
  }
  return Array.from(set).sort();
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [extendedSearch, setExtendedSearch] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [prestationFilter, setPrestationFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [opportunityUpdatedWithinFilter, setOpportunityUpdatedWithinFilter] = useState('');
  const [bcMissingOnly, setBcMissingOnly] = useState(false);
  const [bcReport, setBcReport] = useState<BcManquantReportResponse['opportunities'] | null>(null);
  const [bcReportLoading, setBcReportLoading] = useState(false);
  const [bcReportError, setBcReportError] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<OpportunityRow | null>(null);
  const [oppToDelete, setOppToDelete] = useState<OpportunityRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [updatingStatusKey, setUpdatingStatusKey] = useState<string | null>(null);
  const [devisIntent, setDevisIntent] = useState<OpportunityDevisIntent>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const isExtendedSearchActive = extendedSearch && search.trim().length >= 2;
  const hasStructuredFilters = Boolean(
    stageFilter || prestationFilter || deptFilter || opportunityUpdatedWithinFilter || bcMissingOnly,
  );
  const { data, error, isLoading, mutate } = useOpportunities({
    search: isExtendedSearchActive ? search : undefined,
    extended: isExtendedSearchActive,
    limit: isExtendedSearchActive || hasStructuredFilters ? 2000 : 300,
  });
  const extendedInFlightRef = useRef(false);

  useEffect(() => {
    if (isExtendedSearchActive && isLoading) {
      extendedInFlightRef.current = true;
      return;
    }
    if (extendedInFlightRef.current && !isLoading) {
      // Mode "one-shot": après une recherche étendue, retour automatique au mode rapide.
      setExtendedSearch(false);
      extendedInFlightRef.current = false;
    }
  }, [isExtendedSearchActive, isLoading]);

  async function handleDeleteOpportunity() {
    if (!oppToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetchWithSession(`/api/opportunities/${oppToDelete.id}`, {
        method: 'DELETE',
      });
      await mutate();
      setOppToDelete(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur lors de la suppression';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateOpportunityStage(opportunity: OpportunityRow, stage: string) {
    const statusKey = `${opportunity.id}:${stage}`;
    setUpdatingStatusKey(statusKey);
    setStatusActionError(null);
    try {
      await apiFetchWithSession(`/api/opportunities/${opportunity.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: stage }),
      });
      setSelectedOpp((current) =>
        current?.id === opportunity.id ? { ...current, stage } : current,
      );
      await mutate();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : `Erreur lors du passage de l'opportunité à ${opportunityStageLabel(stage)}`;
      setStatusActionError(msg);
    } finally {
      setUpdatingStatusKey(null);
    }
  }

  async function handleDuplicateOpportunity(opportunity: OpportunityRow) {
    setDuplicatingId(opportunity.id);
    setDuplicateError(null);
    try {
      const res = await apiFetchWithSession<{ id: string }>(
        `/api/opportunities/${opportunity.id}/duplicate`,
        { method: 'POST' },
      );
      await mutate();
      const created = data?.opportunities.find((o) => o.id === res.id);
      setDevisIntent(null);
      setSelectedOpp(
        created ?? {
          ...opportunity,
          id: res.id,
          stage: OPPORTUNITY_STAGES.NEW,
          numeroDevis: null,
          portailBundle: defaultPortailBundle(),
          portailWidgets: effectiveWidgetFlags(defaultPortailBundle(), OPPORTUNITY_STAGES.NEW),
        },
      );
      setDuplicateError(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur lors de la duplication';
      setDuplicateError(msg);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleOpenDevisCreate(opportunity: OpportunityRow) {
    const normalized = mapLegacyStageToOpp(opportunity.stage);
    if (normalized === OPPORTUNITY_STAGES.NEW) {
      await handleUpdateOpportunityStage(opportunity, OPPORTUNITY_STAGES.QUOTE_PREP);
      setSelectedOpp({ ...opportunity, stage: OPPORTUNITY_STAGES.QUOTE_PREP });
    } else {
      setSelectedOpp(opportunity);
    }
    setDevisIntent('create');
  }

  function handleOpenDevisPilot(opportunity: OpportunityRow, quoteId: string | null) {
    setSelectedOpp(opportunity);
    if (quoteId) {
      setDevisIntent('edit-pilot');
    } else {
      setDevisIntent('create');
    }
  }

  async function handleLoadBcReport() {
    setBcReportLoading(true);
    setBcReportError(null);
    try {
      const res = await apiFetchWithSession<BcManquantReportResponse>(
        '/api/opportunities/reports/bc-manquant',
      );
      setBcReport(res.opportunities);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur rapport BC';
      setBcReportError(msg);
      setBcReport(null);
    } finally {
      setBcReportLoading(false);
    }
  }

  const depts = useMemo(() => allDepts(data?.opportunities ?? []), [data]);

  const rows = useMemo(() => {
    const opportunityUpdatedWithinMonths =
      parseOpportunityUpdatedWithinMonths(opportunityUpdatedWithinFilter);
    let list = data?.opportunities ?? [];
    if (search.trim() && !isExtendedSearchActive) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.companyName ?? '').toLowerCase().includes(q) ||
          (o.companyCity ?? '').toLowerCase().includes(q),
      );
    }
    if (stageFilter) list = list.filter((o) => o.stage === stageFilter);
    if (prestationFilter)
      list = list.filter((o) => o.prestation.includes(prestationFilter));
    if (deptFilter)
      list = list.filter((o) => deptFromPostcode(o.companyPostcode) === deptFilter);
    if (opportunityUpdatedWithinMonths != null) {
      list = list.filter((o) =>
        matchesOpenOpportunityUpdatedWithin(o, opportunityUpdatedWithinMonths),
      );
    }
    if (bcMissingOnly) list = list.filter((o) => o.bcMissing);
    return list;
  }, [
    data,
    deptFilter,
    isExtendedSearchActive,
    opportunityUpdatedWithinFilter,
    prestationFilter,
    search,
    stageFilter,
    bcMissingOnly,
  ]);

  return (
    <div>
      <OpportunityDrawer
        opp={selectedOpp}
        devisIntent={devisIntent}
        onDevisIntentConsumed={() => setDevisIntent(null)}
        onClose={() => {
          setDevisIntent(null);
          setSelectedOpp(null);
        }}
        onUpdated={(patch) => {
          setSelectedOpp((current) => (current ? { ...current, ...patch } : current));
          void mutate();
        }}
      />
      <ConfirmDialog
        open={oppToDelete !== null}
        title="Supprimer cette opportunité ?"
        description={
          oppToDelete && (
            <>
              Êtes-vous sûr de vouloir supprimer définitivement l'opportunité{' '}
              <span className="font-semibold text-gray-900">
                {oppToDelete.numeroDevis ?? oppToDelete.name}
              </span>
              {oppToDelete.companyName && (
                <>
                  {' '}pour{' '}
                  <span className="font-semibold text-gray-900">
                    {oppToDelete.companyName}
                  </span>
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
        onConfirm={handleDeleteOpportunity}
        onClose={() => {
          if (deleting) return;
          setOppToDelete(null);
          setDeleteError(null);
        }}
      />
      <Header
        title="Opportunités"
        subtitle="Devis et pipeline commercial"
        action={{ label: 'Nouvelle opportunité', onClick: () => router.push('/opportunities/new') }}
      />
      <div className="p-6 md:p-8">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1 max-w-xl">
            <Input
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-1 flex items-center justify-between gap-3 px-1">
              <button
                type="button"
                className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                onClick={() => setExtendedSearch((v) => !v)}
              >
                {extendedSearch ? 'Revenir à la recherche rapide' : 'Etendre la recherche'}
              </button>
              {extendedSearch && search.trim().length < 2 && (
                <span className="text-xs text-gray-400">
                  Saisissez au moins 2 caractères pour lancer la recherche étendue.
                </span>
              )}
              {isExtendedSearchActive && (
                <span className="text-xs text-gray-500">Recherche sur tout l'historique</span>
              )}
            </div>
          </div>

          <div className="min-w-[170px]">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[190px]">
            <select
              value={prestationFilter}
              onChange={(e) => setPrestationFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PRESTATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[145px]">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Tous les dép.</option>
              {depts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[170px]">
            <select
              value={opportunityUpdatedWithinFilter}
              onChange={(e) => setOpportunityUpdatedWithinFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {OPPORTUNITY_UPDATED_WITHIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
            <input
              type="checkbox"
              checked={bcMissingOnly}
              onChange={(e) => setBcMissingOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Sans BC (gagné)
          </label>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10 shrink-0"
            disabled={bcReportLoading}
            onClick={() => void handleLoadBcReport()}
          >
            {bcReportLoading ? 'Chargement…' : 'Rapport BC manquants'}
          </Button>
        </div>

        {bcReportError && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">{bcReportError}</p>
          </Card>
        )}
        {bcReport && bcReport.length > 0 && (
          <Card className="mb-6" padding="md">
            <p className="mb-3 text-sm font-semibold text-gray-900">
              Gagné sans référence BC ({bcReport.length})
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {bcReport.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-2">
                  <button
                    type="button"
                    className="text-left font-medium text-primary-700 hover:underline"
                    onClick={() => {
                      const full = data?.opportunities.find((x) => x.id === r.id);
                      setSelectedOpp(full ?? opportunityRowFromBcReport(r));
                    }}
                  >
                    {r.companyName ?? r.name}
                  </button>
                  <span className="font-mono text-xs text-gray-500">{r.numeroDevis ?? r.id.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {bcReport && bcReport.length === 0 && !bcReportLoading && (
          <Card className="mb-6 border-green-100 bg-green-50/80" padding="md">
            <p className="text-sm text-green-900">Aucune opportunité gagnée sans BC sur l’échantillon consulté.</p>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">
              Impossible de charger les opportunités. Vérifiez la session et le gateway.
            </p>
            <Button type="button" variant="secondary" className="mt-3" size="sm" onClick={() => mutate()}>
              Réessayer
            </Button>
          </Card>
        )}
        {statusActionError && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">{statusActionError}</p>
          </Card>
        )}
        {duplicateError && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">{duplicateError}</p>
          </Card>
        )}

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Opportunité</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-2 py-3">Dép.</th>
                  <th className="px-4 py-3">Prestation</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                      Aucune opportunité trouvée.
                    </td>
                  </tr>
                )}
                {rows.map((o) => {
                  const dept = deptFromPostcode(o.companyPostcode);
                  const rowActions = getOpportunityRowActions(o);
                  const isUpdatingRowStatus = updatingStatusKey?.startsWith(`${o.id}:`) ?? false;
                  const isDuplicating = duplicatingId === o.id;
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => {
                        setDevisIntent(null);
                        setSelectedOpp(o);
                      }}
                    >
                      <td className="h-full px-4 py-3 align-top">
                        <div className="flex h-full min-w-0 flex-col">
                          <p className="truncate leading-tight font-semibold text-primary-700">
                            {o.companyName ?? o.name}
                          </p>
                          {(o.companyPostcode || o.companyCity) && (
                            <p className="mt-0.5 text-xs leading-tight font-light text-gray-800">
                              {[o.companyPostcode, o.companyCity].filter(Boolean).join(' ')}
                            </p>
                          )}
                          <p className="mt-auto pt-2 text-[11px] italic leading-3 text-gray-600">
                            {formatCreatedUpdatedMeta(o.createdAt, o.updatedAt)}
                          </p>
                        </div>
                      </td>
                      
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold uppercase leading-tight text-gray-900">
                            {o.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] leading-tight text-gray-500">
                            {o.numeroDevis ?? '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {o.contact ? (
                          <div className="min-w-0">
                            {(() => {
                              const primaryLine = formatContactPrimaryLine(o.contact);
                              const firstNameLabel = formatContactFirstName(o.contact.firstName);
                              return (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-xs font-semibold uppercase leading-tight text-gray-900">
                                      {primaryLine}
                                    </p>
                                    {(o.contact.phone || o.contact.email) && (
                                      <div className="relative flex-shrink-0 group">
                                        <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold leading-none text-gray-900">
                                          i
                                        </span>
                                        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl group-hover:block">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                                            {primaryLine}
                                          </p>
                                          {firstNameLabel && (
                                            <p className="mt-0.5 text-xs text-gray-600">{firstNameLabel}</p>
                                          )}
                                          <div className="mt-2 space-y-1.5 text-xs text-gray-700">
                                            <p>
                                              <span className="font-medium text-gray-400">Tél. </span>
                                              {formatPhoneDisplay(o.contact.phone, o.contact.phoneCode)}
                                            </p>
                                            <p className="break-all">
                                              <span className="font-medium text-gray-400">Email </span>
                                              {o.contact.email ?? '—'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {firstNameLabel && (
                                    <p className="mt-0.5 text-[11px] leading-tight text-gray-500">
                                      {firstNameLabel}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-sm font-medium text-gray-500 align-top">
                        {dept ?? '—'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {o.prestation.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {o.prestation.map((p) => (
                              <span
                                key={p}
                                className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700"
                              >
                                {PRESTATION_LABELS[p] ?? p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-gray-900 whitespace-nowrap">
                          {o.amountEur != null ? formatCurrency(o.amountEur) : '—'}
                        </p>
                        {o.amountEur != null && o.montantInitialEur != null && o.tauxRemise != null && o.tauxRemise > 0 && (
                          <div className="mt-0.5 flex items-center gap-2 text-xs">
                            <span className="text-gray-400 line-through">
                              {formatCurrency(o.montantInitialEur)}
                            </span>
                            <span className="font-medium text-green-600">
                              -{o.tauxRemise}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          <Badge variant={opportunityStageBadgeVariant(o.stage)} className="w-fit whitespace-nowrap">
                            {opportunityStageLabel(o.stage)}
                          </Badge>
                          {o.bcMissing && (
                            <Badge variant="warning" className="w-fit whitespace-nowrap text-[10px]">
                              BC manquant
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-right align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {rowActions.map((action) => {
                            if (action.type === 'stage') {
                              const loading =
                                updatingStatusKey === `${o.id}:${action.stage}`;
                              return (
                                <button
                                  key={`${action.stage}-${action.label}`}
                                  type="button"
                                  className={rowActionButtonClass(action.variant)}
                                  disabled={isUpdatingRowStatus || isDuplicating}
                                  onClick={() =>
                                    void handleUpdateOpportunityStage(o, action.stage)
                                  }
                                >
                                  {loading ? `${action.label}…` : action.label}
                                </button>
                              );
                            }
                            if (action.type === 'open-devis-create') {
                              return (
                                <button
                                  key="create-devis"
                                  type="button"
                                  className={rowActionButtonClass('info')}
                                  disabled={isUpdatingRowStatus || isDuplicating}
                                  onClick={() => void handleOpenDevisCreate(o)}
                                >
                                  {action.label}
                                </button>
                              );
                            }
                            if (action.type === 'open-devis-pilot') {
                              return (
                                <button
                                  key="view-devis"
                                  type="button"
                                  className={rowActionButtonClass('info')}
                                  disabled={isUpdatingRowStatus || isDuplicating}
                                  onClick={() => handleOpenDevisPilot(o, action.quoteId)}
                                >
                                  {action.label}
                                </button>
                              );
                            }
                            if (action.type === 'duerp') {
                              return (
                                <button
                                  key="duerp"
                                  type="button"
                                  className={rowActionButtonClass('info')}
                                  disabled={isDuplicating}
                                  onClick={() => router.push(`/opportunities/${o.id}?action=duerp`)}
                                >
                                  {action.label}
                                </button>
                              );
                            }
                            return (
                              <button
                                key="open-drawer"
                                type="button"
                                className={rowActionButtonClass('neutral')}
                                disabled={isDuplicating}
                                onClick={() => setSelectedOpp(o)}
                              >
                                {action.label}
                              </button>
                            );
                          })}
                          <RowActionsMenu
                            ariaLabel={`Actions pour ${o.companyName ?? o.name}`}
                            actions={[
                              {
                                label: isDuplicating ? 'Duplication…' : 'Dupliquer',
                                onClick: () => void handleDuplicateOpportunity(o),
                                disabled: isDuplicating || isUpdatingRowStatus,
                              },
                              {
                                label: 'Supprimer',
                                danger: true,
                                onClick: () => {
                                  setDeleteError(null);
                                  setOppToDelete(o);
                                },
                                icon: (
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path
                                      d="M3 4h10M6 4V2.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V4m1 0v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4h6Z"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {!isLoading && rows.length > 0 && (
          <p className="mt-3 text-right text-xs text-gray-400">
            {rows.length} opportunité{rows.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
