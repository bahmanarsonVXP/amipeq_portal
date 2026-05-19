'use client';

import { formatPrestationsSummary, quoteDisplayStatusLabel } from '@/lib/devisConstants';
import { formatCurrency } from '@/lib/utils';
import type { PortailBundle, PortailQuote } from '@/types';

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      className={filled ? 'shrink-0 text-primary-500' : 'shrink-0 text-gray-300'}
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function formatAmounts(brut: number | null, net: number | null): string {
  if (brut != null && net != null && brut !== net) {
    return `${formatCurrency(brut)} / ${formatCurrency(net)}`;
  }
  if (net != null) return formatCurrency(net);
  if (brut != null) return formatCurrency(brut);
  return '—';
}

interface QuoteLineProps {
  quote: PortailQuote;
  isPilot: boolean;
  onClick: () => void;
}

function QuoteLine({ quote, isPilot, onClick }: QuoteLineProps) {
  const prestations = formatPrestationsSummary(quote.prestations);
  const amounts = formatAmounts(quote.montantBrutEur, quote.montantNetEur);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs transition hover:bg-white/80"
      >
        <StarIcon filled={isPilot} />
        <span className="shrink-0 font-semibold text-gray-900 group-hover:text-primary-700">
          {quote.label}
        </span>
        <span className="shrink-0 text-gray-600">
          {prestations !== '—' ? prestations : '—'}
        </span>
        <span className="shrink-0 font-medium tabular-nums text-gray-800">{amounts}</span>
        <span
          className="ml-auto shrink-0 rounded-full border border-gray-200/90 bg-white px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-600"
          title={quoteDisplayStatusLabel(quote)}
        >
          {quoteDisplayStatusLabel(quote)}
        </span>
      </button>
    </li>
  );
}

interface Props {
  bundle: PortailBundle;
  onSelectQuote: (quoteId: string) => void;
}

export function DevisListCompact({ bundle, onSelectQuote }: Props) {
  const count = bundle.quotes.length;
  const pilotEff =
    bundle.pilotageId ?? (bundle.quotes.length === 1 ? bundle.quotes[0]!.id : null);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-gray-900">
        {count} Devis :
      </p>
      {count === 0 ? (
        <p className="text-sm text-gray-500">Aucun devis pour cette opportunité.</p>
      ) : (
        <ul className="space-y-0.5">
          {bundle.quotes.map((q) => (
            <QuoteLine
              key={q.id}
              quote={q}
              isPilot={pilotEff === q.id}
              onClick={() => onSelectQuote(q.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
