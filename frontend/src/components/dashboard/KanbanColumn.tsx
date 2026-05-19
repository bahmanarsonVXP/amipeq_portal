'use client'

import type { PipelineColumn } from '@/types'
import { KanbanCard } from './KanbanCard'
import { formatEuros } from '@/lib/utils'

interface KanbanColumnProps {
  column: PipelineColumn
  accentColor: string
}

export function KanbanColumn({ column, accentColor }: KanbanColumnProps) {
  return (
    <div className="flex-none w-48 flex flex-col">
      {/* En-tête colonne */}
      <div
        className="bg-white border border-gray-200 border-b-0 rounded-t-xl px-3 py-2.5"
        style={{ borderTopWidth: 3, borderTopColor: accentColor }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold" style={{ color: accentColor }}>
            {column.label}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {column.count}
          </span>
        </div>
        {column.totalMontant > 0 && (
          <div className="text-xs font-semibold text-gray-900">
            {formatEuros(column.totalMontant)}
          </div>
        )}
      </div>

      {/* Corps colonne */}
      <div className="flex-1 bg-gray-50 border border-gray-200 border-t-0 rounded-b-xl p-2 flex flex-col gap-1.5 min-h-[400px]">
        {column.cards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-gray-300">Aucun devis</span>
          </div>
        ) : (
          <>
            {column.cards.map(card => (
              <KanbanCard key={card.id} card={card} />
            ))}
            {column.count > column.cards.length && (
              <p className="text-center text-xs text-gray-400 pt-1">
                + {column.count - column.cards.length} autres
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
