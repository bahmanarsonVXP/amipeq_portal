'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useOpportunities } from '@/hooks/useOpportunities';
import { formatCurrency } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';
import type { OpportunityRow } from '@/types';

const STAGE_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'DEVIS_ENVOYE', label: 'Devis envoyé' },
  { value: 'GAGNE', label: 'Gagné' },
  { value: 'PERDU', label: 'Perdu' },
];

const PRESTATION_OPTIONS = [
  { value: '', label: 'Toutes prestations' },
  { value: 'DUERP', label: 'DUERP' },
  { value: 'PPMS', label: 'PPMS' },
  { value: 'RPS', label: 'RPS' },
  { value: 'PSE', label: 'PSE' },
  { value: 'RGPD', label: 'RGPD' },
];

function prestationFromName(name: string): string {
  const found = PRESTATION_OPTIONS.slice(1).find((p) =>
    name.toUpperCase().includes(p.value),
  );
  return found ? found.label : name;
}

function deptFromPostcode(postcode: string | null): string | null {
  if (!postcode) return null;
  return postcode.startsWith('97') ? postcode.slice(0, 3) : postcode.slice(0, 2);
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
  const { data, error, isLoading, mutate } = useOpportunities();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [prestationFilter, setPrestationFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const depts = useMemo(() => allDepts(data?.opportunities ?? []), [data]);

  const rows = useMemo(() => {
    let list = data?.opportunities ?? [];
    if (search.trim()) {
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
      list = list.filter((o) => o.name.toUpperCase().includes(prestationFilter));
    if (deptFilter)
      list = list.filter((o) => deptFromPostcode(o.companyPostcode) === deptFilter);
    return list;
  }, [data, search, stageFilter, prestationFilter, deptFilter]);

  return (
    <div>
      <Header title="Opportunités" subtitle="Devis et pipeline commercial" />
      <div className="p-6 md:p-8">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] max-w-xl">
            <Input
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={prestationFilter}
            onChange={(e) => setPrestationFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {PRESTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les dép.</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <Button
            type="button"
            variant="primary"
            onClick={() => router.push('/opportunities/new')}
            className="ml-auto"
          >
            + Nouvelle opportunité
          </Button>
        </div>

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

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3 w-16">Dép.</th>
                  <th className="px-6 py-3">Prestation</th>
                  <th className="px-6 py-3">Montant</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                      Aucune opportunité trouvée.
                    </td>
                  </tr>
                )}
                {rows.map((o) => {
                  const dept = deptFromPostcode(o.companyPostcode);
                  const prestation = prestationFromName(o.name);
                  const isGagne = o.stage === 'GAGNE';
                  const isEnAttente = o.stage === 'EN_ATTENTE' || o.stage === 'DEVIS_ENVOYE';
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => router.push(`/opportunities/${o.id}`)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">
                          {o.companyName ?? o.name}
                        </p>
                        {(o.companyPostcode || o.companyCity) && (
                          <p className="text-xs font-light text-gray-400">
                            {[o.companyPostcode, o.companyCity].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500">
                        {dept ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{prestation}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {o.amountEur != null ? formatCurrency(o.amountEur) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={opportunityStageBadgeVariant(o.stage)}>
                          {opportunityStageLabel(o.stage)}
                        </Badge>
                      </td>
                      <td
                        className="px-6 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {isEnAttente && (
                            <>
                              <button
                                className="rounded-md border border-green-300 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                onClick={() => router.push(`/opportunities/${o.id}?action=gagne`)}
                              >
                                Gagné
                              </button>
                              <button
                                className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                onClick={() => router.push(`/opportunities/${o.id}?action=relancer`)}
                              >
                                Relancer
                              </button>
                            </>
                          )}
                          {isGagne && (
                            <button
                              className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              onClick={() => router.push(`/opportunities/${o.id}?action=duerp`)}
                            >
                              Envoyer DUERP
                            </button>
                          )}
                          {o.stage === 'PERDU' && (
                            <button
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-400 hover:bg-gray-50"
                              onClick={() => router.push(`/opportunities/${o.id}`)}
                            >
                              Voir détail
                            </button>
                          )}
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
