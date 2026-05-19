'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CompanyDrawer } from '@/components/clients/CompanyDrawer';
import { OpportunityDrawer } from '@/components/opportunities/OpportunityDrawer';
import { useClientOverview } from '@/hooks/useClientOverview';
import { apiFetchWithSession, ApiError } from '@/lib/api';
import { formatCreatedUpdatedMeta } from '@/lib/metaDates';
import {
  OPPORTUNITY_UPDATED_WITHIN_OPTIONS,
  matchesOpenOpportunityUpdatedWithin,
  parseOpportunityUpdatedWithinMonths,
  sumCaSinceYear,
} from '@/lib/opportunityFilters';
import { formatCurrency } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';
import { caHistoryYears } from '@/lib/clientMetrics';
import type { ClientOverviewItem, OpportunityRow } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  ETABLISSEMENT_SCOLAIRE: 'Éducation',
  MAIRIE_COLLECTIVITE: 'Collectivité',
  ENTREPRISE_TPE_PME: 'Entreprise',
  AUTRE: 'Autre',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous les types' },
  { value: 'ETABLISSEMENT_SCOLAIRE', label: TYPE_LABELS.ETABLISSEMENT_SCOLAIRE },
  { value: 'MAIRIE_COLLECTIVITE', label: TYPE_LABELS.MAIRIE_COLLECTIVITE },
  { value: 'ENTREPRISE_TPE_PME', label: TYPE_LABELS.ENTREPRISE_TPE_PME },
  { value: 'AUTRE', label: TYPE_LABELS.AUTRE },
] as const;

function typeBadgeVariant(t: string | null | undefined): 'info' | 'success' | 'warning' | 'neutral' {
  if (t === 'ETABLISSEMENT_SCOLAIRE') return 'info';
  if (t === 'MAIRIE_COLLECTIVITE') return 'success';
  if (t === 'ENTREPRISE_TPE_PME') return 'warning';
  return 'neutral';
}

function fallbackDeptFromPostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  return postcode.startsWith('97') ? postcode.slice(0, 3) : postcode.slice(0, 2);
}

function companyDept(company: ClientOverviewItem): string {
  return company.departementNumero?.trim() || fallbackDeptFromPostcode(company.address.postcode) || '—';
}

function allClientDepts(companies: ClientOverviewItem[]): string[] {
  const set = new Set<string>();
  for (const company of companies) {
    const dept = companyDept(company);
    if (dept !== '—') set.add(dept);
  }
  return Array.from(set).sort();
}

function formatCaLines(
  caByYear: Record<string, number>,
  years: number[],
): { label: string; value: string }[] {
  return years.map((year) => {
    const value = caByYear[String(year)] ?? 0;
    return {
      label: String(year),
      value: value > 0 ? formatCurrency(value) : '—',
    };
  });
}

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [opportunityUpdatedWithinFilter, setOpportunityUpdatedWithinFilter] = useState('');
  const [caSinceYearFilter, setCaSinceYearFilter] = useState('');
  const {
    data: overviewData,
    error: overviewError,
    isLoading: overviewLoading,
    mutate: mutOverview,
  } = useClientOverview(search.trim() || undefined);

  const companies = overviewData?.companies ?? [];
  const depts = useMemo(() => allClientDepts(companies), [companies]);

  const currentYear = new Date().getFullYear();
  const historyYears = useMemo(
    () => overviewData?.years ?? caHistoryYears(currentYear),
    [currentYear, overviewData?.years],
  );

  const [sheetCompanyId, setSheetCompanyId] = useState<string | null>(null);
  const [oppsModalCompany, setOppsModalCompany] = useState<ClientOverviewItem | null>(null);
  const [detailOpp, setDetailOpp] = useState<OpportunityRow | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<ClientOverviewItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteCompany() {
    if (!companyToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetchWithSession(`/api/companies/${companyToDelete.id}`, {
        method: 'DELETE',
      });
      await mutOverview();
      setCompanyToDelete(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur lors de la suppression';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  const rows = useMemo(() => {
    const opportunityUpdatedWithinMonths =
      parseOpportunityUpdatedWithinMonths(opportunityUpdatedWithinFilter);
    const caSinceYear = Number.parseInt(caSinceYearFilter, 10);
    let filteredCompanies = companies;

    if (typeFilter) {
      filteredCompanies = filteredCompanies.filter((company) => company.typeClient === typeFilter);
    }
    if (deptFilter) {
      filteredCompanies = filteredCompanies.filter((company) => companyDept(company) === deptFilter);
    }
    if (opportunityUpdatedWithinMonths != null) {
      filteredCompanies = filteredCompanies.filter((company) =>
        company.openOpportunities.some((opportunity) =>
          matchesOpenOpportunityUpdatedWithin(opportunity, opportunityUpdatedWithinMonths),
        ),
      );
    }
    if (Number.isFinite(caSinceYear)) {
      filteredCompanies = filteredCompanies.filter(
        (company) => sumCaSinceYear(company.caByYear, caSinceYear) > 0,
      );
    }

    return filteredCompanies.map((c) => {
      return {
        company: c,
        caLines: formatCaLines(c.caByYear, historyYears),
        openCount: c.openCount,
        openTotal: c.openTotalEur,
      };
    });
  }, [
    caSinceYearFilter,
    companies,
    deptFilter,
    historyYears,
    opportunityUpdatedWithinFilter,
    typeFilter,
  ]);

  return (
    <div>
      <ConfirmDialog
        open={companyToDelete !== null}
        title="Supprimer ce client ?"
        description={
          companyToDelete && (
            <>
              Êtes-vous sûr de vouloir supprimer définitivement le client{' '}
              <span className="font-semibold text-gray-900">{companyToDelete.name}</span>
              {companyToDelete.numeroSociete && (
                <>
                  {' '}(N° {companyToDelete.numeroSociete})
                </>
              )}
              ? Les opportunités et contacts liés peuvent également être affectés. Cette action est irréversible.
            </>
          )
        }
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        errorMessage={deleteError}
        onConfirm={handleDeleteCompany}
        onClose={() => {
          if (deleting) return;
          setCompanyToDelete(null);
          setDeleteError(null);
        }}
      />
      <OpportunityDrawer
        opp={detailOpp}
        stack="nested"
        onClose={() => setDetailOpp(null)}
        onUpdated={(patch) => {
          setDetailOpp((current) => (current ? { ...current, ...patch } : current));
        }}
      />
      <CompanyDrawer
        companyId={sheetCompanyId}
        onClose={() => setSheetCompanyId(null)}
        onSelectOpportunity={(row) => {
          setDetailOpp(row);
        }}
      />

      {/* Layer opportunités ouvertes */}
      {oppsModalCompany && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            aria-label="Fermer"
            onClick={() => setOppsModalCompany(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl flex flex-col">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Opportunités en cours</h2>
                  <p className="text-sm text-gray-500">{oppsModalCompany.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOppsModalCompany(null)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
                  aria-label="Fermer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-3">
                {oppsModalCompany.openOpportunities.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOppsModalCompany(null);
                        setDetailOpp(row);
                      }}
                      className="w-full rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-left transition hover:border-primary-200 hover:bg-primary-50/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={opportunityStageBadgeVariant(row.stage)}>
                          {opportunityStageLabel(row.stage)}
                        </Badge>
                        {row.numeroDevis && (
                          <span className="rounded bg-white px-2 py-0.5 font-mono text-xs text-gray-600">
                            {row.numeroDevis}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 font-medium text-gray-900">{row.name}</p>
                      <p className="mt-1 text-sm font-semibold">
                        {row.amountEur != null ? formatCurrency(row.amountEur) : '—'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {oppsModalCompany.openOpportunities.length === 0 && (
                <p className="text-sm text-gray-500">Aucune opportunité en cours.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Header
        title="Clients"
        subtitle="Base clients et prospects"
        action={{
          label: 'Nouveau client',
          onClick: () => router.push('/opportunities/new?mode=new-client'),
        }}
      />

      <div className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1 max-w-[25rem]">
            <Input
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="min-w-[180px]">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
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
              {depts.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
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

          <div className="min-w-[170px]">
            <select
              value={caSinceYearFilter}
              onChange={(e) => setCaSinceYearFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Avec CA depuis…</option>
              {historyYears.map((year) => (
                <option key={year} value={String(year)}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {overviewError && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">
              Impossible de charger les données. Vérifiez la session et le gateway.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => mutOverview()}>
                Réessayer
              </Button>
            </div>
          </Card>
        )}

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[11%]" />
                <col className="w-[6%]" />
                <col className="w-[17%]" />
                <col className="w-[38%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3">Opportunités en cours</th>
                  <th className="px-4 py-3">Historique CA</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overviewLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!overviewLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Aucun client trouvé.
                    </td>
                  </tr>
                )}
                {rows.map(({ company: c, caLines, openCount, openTotal }) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-gray-50/80"
                    onClick={() => setSheetCompanyId(c.id)}
                  >
                    <td className="max-w-0 px-4 py-3">
                      <div className="flex min-w-0 flex-col">
                        <p
                          className="truncate leading-tight font-semibold text-primary-700"
                          title={c.name}
                        >
                          {c.name}
                        </p>
                        {(c.address.postcode || c.address.city) && (
                          <p className="mt-0.5 truncate text-xs leading-tight font-light text-gray-800">
                            {[c.address.postcode, c.address.city].filter(Boolean).join(' ')}
                          </p>
                        )}
                        <p className="mt-auto truncate pt-2 text-[11px] italic leading-3 text-gray-600">
                          {formatCreatedUpdatedMeta(c.createdAt, c.updatedAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={typeBadgeVariant(c.typeClient)}>
                        {TYPE_LABELS[c.typeClient ?? ''] ?? c.typeClient ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">
                      {companyDept(c)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOppsModalCompany(c);
                        }}
                        className="min-w-0 text-left hover:opacity-90"
                      >
                        <p className="font-semibold text-gray-900">
                          #{openCount}{' '}
                          <span className="font-normal text-gray-500">
                            opportunité{openCount > 1 ? 's' : ''}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Total :{' '}
                          <span className="font-semibold text-gray-900">
                            {openCount > 0 ? formatCurrency(openTotal) : '—'}
                          </span>
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid w-full min-w-0 grid-cols-4 gap-2">
                        {caLines.map((line) => (
                          <div
                            key={line.label}
                            className="min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-center"
                          >
                            <p className="text-[10px] font-semibold uppercase leading-none text-gray-500">
                              {line.label}
                            </p>
                            <p
                              className="mt-1 truncate text-xs font-semibold leading-none tabular-nums text-gray-900"
                              title={line.value}
                            >
                              {line.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <RowActionsMenu
                          ariaLabel={`Actions pour ${c.name}`}
                          actions={[
                            {
                              label: 'Supprimer',
                              danger: true,
                              onClick: () => {
                                setDeleteError(null);
                                setCompanyToDelete(c);
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {!overviewLoading && rows.length > 0 && (
          <p className="mt-3 text-right text-xs text-gray-400">
            {rows.length} client{rows.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
