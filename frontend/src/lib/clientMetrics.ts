import { isOpenOpportunityStage } from '@/lib/opportunityLabels';
import type { OpportunityRow } from '@/types';

/** CA par année (`anneeDevis`) — uniquement devis gagnés, montant actuel. */
export function caByYearForCompany(
  opportunities: OpportunityRow[],
  companyId: string,
): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of opportunities) {
    if (o.companyId !== companyId) continue;
    if (o.statutDevis !== 'GAGNE') continue;
    if (o.anneeDevis == null) continue;
    const add = o.amountEur ?? 0;
    m.set(o.anneeDevis, (m.get(o.anneeDevis) ?? 0) + add);
  }
  return m;
}

export function openOpportunitiesForCompany(
  opportunities: OpportunityRow[],
  companyId: string,
): OpportunityRow[] {
  return opportunities.filter(
    (o) => o.companyId === companyId && isOpenOpportunityStage(o.stage),
  );
}

/** Années de l’historique affiché : année courante + 3 précédentes. */
export function caHistoryYears(currentYear: number, count = 4): number[] {
  return Array.from({ length: count }, (_, index) => currentYear - index);
}
