'use client'

import type { DashboardData } from '@/types'
import { PipelinePanel } from './PipelinePanel'
import { PriosPanel } from './PriosPanel'
import { RealisationsPanel } from './RealisationsPanel'
import { PortefeuillePanel } from './PortefeuillePanel'

export type TabId = 'pipeline' | 'prios' | 'realisations' | 'portefeuille'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pipeline',     label: 'Pipeline' },
  { id: 'prios',        label: 'Prios' },
  { id: 'realisations', label: 'Réalisations' },
  { id: 'portefeuille', label: 'Portefeuille' },
]

interface DashboardTabsProps {
  data: DashboardData | null
  loading: boolean
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function DashboardTabs({
  data,
  loading,
  activeTab,
  onTabChange,
}: DashboardTabsProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Tab bar ── */}
      <div className="px-6 pt-4 pb-0 bg-white border-b border-gray-200">
        <div className="inline-flex bg-gray-50 border border-gray-200 rounded-xl p-1 gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={[
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none',
                'focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1',
                activeTab === tab.id
                  ? 'bg-yellow-400 text-gray-900 font-bold shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panels ── */}
      <div className="flex-1 px-6 py-5 overflow-auto">

        {activeTab === 'pipeline' && (
          <PipelinePanel
            columns={data?.pipeline ?? []}
            loading={loading}
          />
        )}

        {activeTab === 'prios' && (
          <PriosPanel
            prios={data?.prios ?? { enRetard: [], aujourdhui: [], realiseSemaine: [], resteSemaine: [] }}
            loading={loading}
          />
        )}

        {activeTab === 'realisations' && (
          <RealisationsPanel />
        )}

        {activeTab === 'portefeuille' && (
          <PortefeuillePanel
            data={data?.portefeuille ?? {
              totalActifs: 0, totalProspects: 0, totalInactifs: 0,
              parType: [], parPrestation: [], topDepartements: [], topClients: [],
            }}
            loading={loading}
          />
        )}

      </div>
    </div>
  )
}
