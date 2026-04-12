'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useOpportunities } from '@/hooks/useOpportunities';
import { formatCurrency } from '@/lib/utils';
import {
  opportunityStageBadgeVariant,
  opportunityStageLabel,
} from '@/lib/opportunityLabels';

export default function OpportunitiesPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useOpportunities();

  const rows = data?.opportunities ?? [];

  return (
    <div>
      <Header title="Opportunités" subtitle="Devis et pipeline (Twenty CRM)" />
      <div className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Les données sont lues et créées via le gateway → Twenty.
          </p>
          <Button type="button" variant="primary" onClick={() => router.push('/opportunities/new')}>
            Nouvelle opportunité
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50" padding="md">
            <p className="text-sm text-red-800">
              Impossible de charger les opportunités. Vérifiez la session et le gateway (
              <code className="rounded bg-red-100 px-1">NEXT_PUBLIC_API_URL</code>).
            </p>
            <Button type="button" variant="secondary" className="mt-3" size="sm" onClick={() => mutate()}>
              Réessayer
            </Button>
          </Card>
        )}

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Opportunité</th>
                  <th className="px-4 py-3">Société</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Étape</th>
                  <th className="px-4 py-3">Clôture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Aucune opportunité.{' '}
                      <Link href="/opportunities/new" className="font-medium text-primary-600 hover:underline">
                        Créer la première
                      </Link>
                    </td>
                  </tr>
                )}
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.name}</td>
                    <td className="px-4 py-3 text-gray-600">{o.companyName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {o.amountEur != null ? formatCurrency(o.amountEur) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={opportunityStageBadgeVariant(o.stage)}>
                        {opportunityStageLabel(o.stage)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {o.closeDate ? new Date(o.closeDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
