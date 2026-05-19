import * as Portail from '../opportunityPortailBundle';
import { BUNDLE_FIELD } from '../opportunityGraphql';

export function bundleFromRecord(record: Record<string, unknown>): Portail.PortailBundle {
  const raw = record[BUNDLE_FIELD];
  const opportunityId = typeof record.id === 'string' ? record.id : undefined;
  return Portail.parsePortailBundle(
    typeof raw === 'string' ? raw : null,
    Portail.opportunityAmountsFromRecord(record),
    opportunityId,
  );
}

export function stageFromRecord(record: Record<string, unknown>): string {
  return typeof record.stage === 'string' ? record.stage : '';
}

export function quoteRootFromRecord(record: Record<string, unknown>): string {
  const legacy = Portail.opportunityAmountsFromRecord(record);
  if (legacy.numeroDevis?.trim()) return Portail.stripNumeroSuffix(legacy.numeroDevis);
  return 'DEVIS';
}
