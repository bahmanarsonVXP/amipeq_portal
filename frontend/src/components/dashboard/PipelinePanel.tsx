'use client'

import type { PipelineColumn } from '@/types'
import { KanbanColumn } from './KanbanColumn'

const COLUMN_COLORS: Record<string, string> = {
  OPP_NEW: '#ef4444',
  OPP_QUOTE_PREP: '#a855f7',
  OPP_CLIENT_PENDING: '#06b6d4',
  OPP_FOLLOWUP: '#f59e0b',
  OPP_STANDBY: '#6b7280',
  OPP_WON: '#22c55e',
  OPP_LOST: '#ef4444',
  NOUVEAU: '#ef4444',
  DEVIS_EN_COURS: '#a855f7',
  DEVIS_EN_RELECTURE: '#3b82f6',
  DEVIS_ENVOYE: '#06b6d4',
  RELANCE: '#f59e0b',
  GAGNE: '#22c55e',
}

interface PipelinePanelProps {
  columns: PipelineColumn[]
  loading: boolean
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-4">
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="flex-none w-48 space-y-2">
          <div className="h-16 bg-gray-100 rounded-t-xl animate-pulse" />
          <div className="h-64 bg-gray-50 rounded-b-xl animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function PipelinePanel({ columns, loading }: PipelinePanelProps) {
  if (loading) return <KanbanSkeleton />

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-4 min-h-[480px]">
      {columns.map(col => (
        <KanbanColumn
          key={col.stage}
          column={col}
          accentColor={COLUMN_COLORS[col.stage] ?? '#6b7280'}
        />
      ))}
    </div>
  )
}
