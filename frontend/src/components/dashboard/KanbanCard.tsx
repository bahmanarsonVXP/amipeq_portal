'use client'

import type { OpportunityCard } from '@/types'
import { formatEuros } from '@/lib/utils'

const PRESTATION_STYLES: Record<string, { bg: string; text: string }> = {
  DUERP: { bg: '#fef9c3', text: '#713f12' },
  PPMS:  { bg: '#dbeafe', text: '#1e3a8a' },
  RPS:   { bg: '#dcfce7', text: '#14532d' },
  PSE:   { bg: '#fce7f3', text: '#831843' },
  RGPD:  { bg: '#ede9fe', text: '#4c1d95' },
  COVID: { bg: '#fee2e2', text: '#7f1d1d' },
  AUTRE: { bg: '#f3f4f6', text: '#4b5563' },
}

function isLate(card: OpportunityCard): boolean {
  if (!card.dateRelance) return false
  return new Date(card.dateRelance) < new Date()
}

interface KanbanCardProps {
  card: OpportunityCard
}

export function KanbanCard({ card }: KanbanCardProps) {
  const late = isLate(card)

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-yellow-400 transition-colors"
      style={late ? { borderLeftWidth: 3, borderLeftColor: '#ef4444', borderRadius: 8 } : {}}
    >
      <p className="text-xs font-semibold text-gray-900 leading-tight mb-1">
        {card.companyName}
      </p>

      <p className="text-xs text-gray-400 mb-1.5">
        Dept. {card.departement}
      </p>

      {card.montant > 0 && (
        <p className="text-sm font-bold text-gray-900 mb-1.5">
          {formatEuros(card.montant)}
        </p>
      )}

      {card.prestations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.prestations.map(p => {
            const style = PRESTATION_STYLES[p] ?? PRESTATION_STYLES.AUTRE
            return (
              <span
                key={p}
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ background: style.bg, color: style.text }}
              >
                {p}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
