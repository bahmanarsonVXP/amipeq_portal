# PROMPT 01b — DashboardTabs : squelette de navigation complet

## Prérequis

Prompts `00_SOCLE` et `01_PAGE_HEADER` terminés.
`KpiStrip` s'affiche avec des données réelles dans la bande header.

---

## Objectif

Créer `DashboardTabs.tsx` **une seule fois, complet**, avec les 4 slots de panels.
Les prompts 02/03/04 ajouteront uniquement leurs composants — ils ne touchent plus à ce fichier.

---

## Fichier à créer

`frontend/src/components/dashboard/DashboardTabs.tsx`

```tsx
'use client'

import type { DashboardData } from '@/types'

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

// ── Placeholder générique affiché tant que le panel n'est pas implémenté ──
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className="text-xs text-gray-300 mt-1">Panel en cours d'implémentation</p>
      </div>
    </div>
  )
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
          // → Composant PipelinePanel ajouté dans le prompt 02_PIPELINE
          <ComingSoon label="Pipeline — prompt 02" />
        )}

        {activeTab === 'prios' && (
          // → Composant PriosPanel ajouté dans le prompt 03_PRIOS
          <ComingSoon label="Prios — prompt 03" />
        )}

        {activeTab === 'realisations' && (
          // → Composant RealisationsPanel ajouté dans le prompt 04_PORTEFEUILLE
          <ComingSoon label="Réalisations — prompt 04" />
        )}

        {activeTab === 'portefeuille' && (
          // → Composant PortefeuillePanel ajouté dans le prompt 04_PORTEFEUILLE
          <ComingSoon label="Portefeuille — prompt 04" />
        )}

      </div>
    </div>
  )
}
```

---

## Mise à jour de `dashboard/page.tsx`

Vérifier que la page importe bien `DashboardTabs` et `TabId` depuis ce fichier :

```tsx
'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { KpiStrip } from '@/components/dashboard/KpiStrip'
import { DashboardTabs, type TabId } from '@/components/dashboard/DashboardTabs'

export default function DashboardPage() {
  const { data, loading } = useDashboard()
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
```

---

## Vérification

- Les 4 onglets sont cliquables et changent l'état actif
- Chaque onglet affiche le placeholder "en cours d'implémentation"
- La `KpiStrip` reste visible en permanence au-dessus des onglets
- Aucune erreur TypeScript

**Ne pas modifier ce fichier dans les prompts suivants.**
Les prompts 02/03/04 remplacent uniquement le `<ComingSoon />` de leur onglet
par leur composant dédié.

Passe au prompt `02_PIPELINE.md`.
