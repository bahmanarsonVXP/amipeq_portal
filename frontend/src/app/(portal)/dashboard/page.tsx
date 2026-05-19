'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { KpiStrip } from '@/components/dashboard/KpiStrip'
import { DashboardTabs, type TabId } from '@/components/dashboard/DashboardTabs'

export default function DashboardPage() {
  const { data, loading, error } = useDashboard()
  const [activeTab, setActiveTab] = useState<TabId>('pipeline')

  return (
    <div className="flex flex-col min-h-0">
      {/* Bande KPI permanente */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Opérationnel — données en temps réel
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-500 mb-2">Erreur de chargement : {error}</p>
        )}
        <KpiStrip kpis={data?.kpis ?? null} loading={loading} />
      </div>

      {/* Navigation + panels */}
      <DashboardTabs
        data={data}
        loading={loading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}
