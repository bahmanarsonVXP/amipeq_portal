/** Normalise un nœud opportunité Twenty → payload aligné sur GET /api/opportunities */

import {
  bcMissing,
  effectiveWidgetFlags,
  parsePortailBundle,
} from './opportunityPortailBundle';

export type TwentyOppAmount = { amountMicros: string | number; currencyCode: string } | null;
export type TwentyOppRemise = { amountMicros: string | number; currencyCode: string } | null;

export type TwentyOppNode = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  name: string;
  stage: string;
  amount: TwentyOppAmount;
  montantRemise: TwentyOppRemise;
  tauxRemise: number | null;
  prestation: string[] | null;
  closeDate: string | null;
  numeroDevis: string | null;
  statutDevis: string | null;
  dateDevis: string | null;
  dateRelance: string | null;
  anneeDevis: number | null;
  bonDeCommandeRef?: string | null;
  /** Champ JSON Twenty (nom GraphQL en minuscules). */
  devisportailbundle?: unknown;
  /** Alias legacy / anciennes requêtes — préférer `devisportailbundle`. */
  devisPortailBundle?: unknown;
  pointOfContact: {
    id: string;
    genre?: string | null;
    name: { firstName: string; lastName: string } | null;
    phones: { primaryPhoneNumber: string; primaryPhoneCallingCode: string } | null;
    emails: { primaryEmail: string } | null;
  } | null;
};

function customFieldToString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'primaryLinkLabel' in value) {
    const v = (value as { primaryLinkLabel?: string }).primaryLinkLabel;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

/** Champ custom JSON Twenty : renvoie une chaîne JSON pour `parsePortailBundle`. */
export function customFieldToPortailBundleJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

/** Bundle JSON renvoyé par Twenty (clé réelle `devisportailbundle`, pas l’alias GraphQL). */
export function bundleJsonFromOpportunityNode(n: TwentyOppNode): string | null {
  return customFieldToPortailBundleJson(n.devisportailbundle ?? n.devisPortailBundle);
}

/** Enregistrement pseudo-REST pour `bundleFromRecord` / `opportunityAmountsFromRecord`. */
export function opportunityNodeToRestRecord(
  n: TwentyOppNode,
  bundleFieldKey = 'devisPortailBundle',
): Record<string, unknown> {
  return {
    id: n.id,
    stage: n.stage,
    numeroDevis: n.numeroDevis,
    statutDevis: n.statutDevis,
    tauxRemise: n.tauxRemise,
    prestation: n.prestation ?? [],
    amount: n.amount,
    montantRemise: n.montantRemise,
    bonDeCommandeRef: n.bonDeCommandeRef,
    [bundleFieldKey]: bundleJsonFromOpportunityNode(n),
  };
}

export type CompanyAddr = {
  addressPostcode?: string | null;
  addressCity?: string | null;
  addressStreet1?: string | null;
} | null;

export function mapOpportunityRow(
  n: TwentyOppNode,
  company: { id: string; name: string; address?: CompanyAddr } | null,
) {
  const micros = n.amount?.amountMicros;
  const amountMicros =
    typeof micros === 'string' ? parseInt(micros, 10) : typeof micros === 'number' ? micros : 0;
  const bonDeCommandeRef = customFieldToString(n.bonDeCommandeRef);
  const remiseMicros =
    n.montantRemise == null
      ? null
      : typeof n.montantRemise.amountMicros === 'string'
        ? parseInt(n.montantRemise.amountMicros, 10)
        : n.montantRemise.amountMicros;
  const portailBundle = parsePortailBundle(bundleJsonFromOpportunityNode(n), {
    numeroDevis: n.numeroDevis ?? null,
    stage: n.stage,
    statutDevis: n.statutDevis ?? null,
    montantBrutEur:
      Number.isFinite(amountMicros) && remiseMicros != null && Number.isFinite(remiseMicros)
        ? (amountMicros + remiseMicros) / 1_000_000
        : Number.isFinite(amountMicros)
          ? amountMicros / 1_000_000
          : null,
    montantNetEur: Number.isFinite(amountMicros) ? amountMicros / 1_000_000 : null,
    tauxRemise: n.tauxRemise ?? null,
    prestations: n.prestation ?? [],
  });
  const portailWidgets = effectiveWidgetFlags(portailBundle, n.stage);
  return {
    id: n.id,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
    name: n.name,
    stage: n.stage,
    amountEur: Number.isFinite(amountMicros) ? amountMicros / 1_000_000 : null,
    montantRemiseEur:
      n.montantRemise == null
        ? null
        : (() => {
            const remiseMicros =
              typeof n.montantRemise.amountMicros === 'string'
                ? parseInt(n.montantRemise.amountMicros, 10)
                : n.montantRemise.amountMicros;
            return Number.isFinite(remiseMicros) ? remiseMicros / 1_000_000 : null;
          })(),
    montantInitialEur:
      n.montantRemise == null
        ? null
        : (() => {
            const remiseMicros =
              typeof n.montantRemise.amountMicros === 'string'
                ? parseInt(n.montantRemise.amountMicros, 10)
                : n.montantRemise.amountMicros;
            if (!Number.isFinite(amountMicros) || !Number.isFinite(remiseMicros)) return null;
            return (amountMicros + remiseMicros) / 1_000_000;
          })(),
    tauxRemise: n.tauxRemise ?? null,
    currencyCode: n.amount?.currencyCode ?? 'EUR',
    prestation: n.prestation ?? [],
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companyPostcode: company?.address?.addressPostcode ?? null,
    companyCity: company?.address?.addressCity ?? null,
    companyStreet: company?.address?.addressStreet1 ?? null,
    closeDate: n.closeDate,
    numeroDevis: n.numeroDevis ?? null,
    statutDevis: n.statutDevis ?? null,
    dateDevis: n.dateDevis ?? null,
    dateRelance: n.dateRelance ?? null,
    anneeDevis: n.anneeDevis ?? null,
    bonDeCommandeRef,
    bcMissing: bcMissing(bonDeCommandeRef, n.stage),
    portailBundle,
    portailWidgets,
    contact: n.pointOfContact
      ? {
          id: n.pointOfContact.id,
          civility: n.pointOfContact.genre ?? null,
          firstName: n.pointOfContact.name?.firstName ?? '',
          lastName: n.pointOfContact.name?.lastName ?? '',
          phone: n.pointOfContact.phones?.primaryPhoneNumber ?? null,
          phoneCode: n.pointOfContact.phones?.primaryPhoneCallingCode ?? null,
          email: n.pointOfContact.emails?.primaryEmail ?? null,
        }
      : null,
  };
}
