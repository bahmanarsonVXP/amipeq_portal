/** Calculs montants devis (OFFRE 1 / remise % / OFFRE 2). */

export const REMISE_PRESETS = [0, 5, 10, 15, 20] as const;

/** Arrondi half-up à 2 décimales. */
export function roundMoneyEur(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Net = brut × (1 − %/100). */
export function calcMontantNetFromBrutAndPct(brutEur: number, tauxRemise: number): number {
  const pct = Math.max(0, Math.min(100, tauxRemise));
  return roundMoneyEur(brutEur * (1 - pct / 100));
}

export function calcRemiseEurFromBrutAndNet(brutEur: number, netEur: number): number {
  return roundMoneyEur(Math.max(0, brutEur - netEur));
}

export function eurToAmountMicros(eur: number): number {
  return Math.round(roundMoneyEur(eur) * 1_000_000);
}

export function amountMicrosToEur(micros: number): number {
  return roundMoneyEur(micros / 1_000_000);
}
