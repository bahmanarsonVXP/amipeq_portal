import { isOpenOpportunityStage } from '@/lib/opportunityLabels';

export const OPPORTUNITY_UPDATED_WITHIN_OPTIONS = [
  { value: '', label: 'Toutes opportunités' },
  { value: '1', label: '<= 1 mois' },
  { value: '2', label: '<= 2 mois' },
  { value: '3', label: '<= 3 mois' },
  { value: '6', label: '<= 6 mois' },
  { value: '12', label: '<= 1 an' },
] as const;

export function parseOpportunityUpdatedWithinMonths(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function subtractMonths(referenceDate: Date, months: number): Date {
  const threshold = new Date(referenceDate);
  threshold.setMonth(threshold.getMonth() - months);
  return threshold;
}

export function isUpdatedWithinMonths(
  updatedAt: string | null | undefined,
  months: number,
  referenceDate = new Date(),
): boolean {
  if (!updatedAt) return false;
  const updatedAtDate = new Date(updatedAt);
  if (Number.isNaN(updatedAtDate.getTime())) return false;
  return updatedAtDate >= subtractMonths(referenceDate, months);
}

export function matchesOpenOpportunityUpdatedWithin(
  opportunity: { stage: string; updatedAt: string | null | undefined },
  months: number,
): boolean {
  return isOpenOpportunityStage(opportunity.stage) && isUpdatedWithinMonths(opportunity.updatedAt, months);
}

export function sumCaSinceYear(
  caByYear: Record<string, number>,
  startYear: number,
): number {
  return Object.entries(caByYear).reduce((sum, [year, value]) => {
    return Number.parseInt(year, 10) >= startYear ? sum + value : sum;
  }, 0);
}
