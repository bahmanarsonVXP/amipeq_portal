# PROMPT 01 — Page Header : KPIs permanents

## Prérequis

Prompt `00_SOCLE.md` terminé et validé.
`useDashboard()` retourne des données réelles depuis Twenty.

---

## Objectif

La zone blanche sous le topbar (actuellement "Dashboard / Vue d'ensemble de l'activité")
devient une **bande KPI permanente** : toujours visible, quelle que soit l'onglet actif
(Pipeline, Prios, Réalisations, Portefeuille).

Elle remplace le simple titre par une combinaison titre + 4 métriques clés.

---

## Fichier à modifier

`frontend/src/app/(portal)/dashboard/page.tsx`

La page est un **Client Component** (`'use client'`).
Elle importe `useDashboard` et gère l'état de l'onglet actif.

---

## Structure de la page

```tsx
'use client'

import { useState } from 'react'
import { useDashboard } from '@/hooks/useDashboard'
import { KpiStrip } from '@/components/dashboard/KpiStrip'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
// Les panels sont importés dans DashboardTabs (prompt suivants)

type TabId = 'pipeline' | 'prios' | 'realisations' | 'portefeuille'

export default function DashboardPage() {
  const { data, loading, error } = useDashboard()
  const [activeTab, setActiveTab] = useState<TabId>('pipeline')

  return (
    <div className="flex flex-col min-h-0">
      {/* ── Zone header permanente ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Opérationnel — données en temps réel</p>
          </div>
        </div>
        <KpiStrip kpis={data?.kpis ?? null} loading={loading} />
      </div>

      {/* ── Onglets + contenu ── */}
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

## Composant `KpiStrip`

Créer `frontend/src/components/dashboard/KpiStrip.tsx` :

```tsx
'use client'

import type { DashboardKpis } from '@/types'

interface KpiStripProps {
  kpis: DashboardKpis | null
  loading: boolean
}

const CARDS = [
  {
    key: 'caMois' as const,
    label: 'CA du mois',
    accentColor: '#f8b829',
    format: (v: number) => new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(v),
    delta: (kpis: DashboardKpis) =>
      kpis.caVariationPct !== 0
        ? `${kpis.caVariationPct > 0 ? '↑ +' : '↓ '}${kpis.caVariationPct} % vs mois N-1`
        : null,
    deltaColor: (kpis: DashboardKpis) =>
      kpis.caVariationPct >= 0 ? 'text-green-600' : 'text-red-500',
  },
  {
    key: 'devisEnAttente' as const,
    label: 'Devis en attente',
    accentColor: '#f59e0b',
    format: (v: number) => String(v),
    delta: (kpis: DashboardKpis) =>
      `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis.potentielEnAttente)} de potentiel`,
    deltaColor: () => 'text-amber-600',
  },
  {
    key: 'tauxTransformation' as const,
    label: 'Taux de transformation',
    accentColor: '#22c55e',
    format: (v: number) => `${v} %`,
    delta: () => 'Gagnés / (Gagnés + Refusés)',
    deltaColor: () => 'text-gray-400',
  },
  {
    key: 'relancesEnRetard' as const,
    label: 'Relances en retard',
    accentColor: '#ef4444',
    format: (v: number) => String(v),
    delta: (kpis: DashboardKpis) =>
      kpis.relancesEnRetard > 0 ? 'À traiter maintenant' : 'Tout est à jour',
    deltaColor: (kpis: DashboardKpis) =>
      kpis.relancesEnRetard > 0 ? 'text-red-500' : 'text-green-600',
  },
]

function Skeleton() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

export function KpiStrip({ kpis, loading }: KpiStripProps) {
  if (loading) return <Skeleton />

  return (
    <div className="grid grid-cols-4 gap-3">
      {CARDS.map(card => {
        const value = kpis ? kpis[card.key] : null
        const delta = kpis ? card.delta(kpis) : null
        const deltaColor = kpis ? card.deltaColor(kpis) : 'text-gray-400'

        return (
          <div
            key={card.key}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3"
            style={{ borderTopWidth: 3, borderTopColor: card.accentColor }}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {card.label}
            </p>
            <p className="text-xl font-bold text-gray-900 mb-1">
              {value !== null ? card.format(value) : '—'}
            </p>
            {delta && (
              <p className={`text-xs font-medium ${deltaColor}`}>{delta}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

---

## Règles visuelles

- Police : Montserrat (déjà configurée dans globals.css)
- Accent top-border : 3px, couleur spécifique par KPI
  - CA : `#f8b829` (jaune AMIPEQ)
  - En attente : `#f59e0b` (amber)
  - Taux : `#22c55e` (vert)
  - Retard : `#ef4444` (rouge)
- Skeleton pendant le loading : `animate-pulse` Tailwind
- La `KpiStrip` ne dépend d'aucun onglet — elle reste montée en permanence

---

## Vérification

La bande KPI doit rester visible quand on change d'onglet.
Les valeurs doivent correspondre aux données réelles de Twenty.
Le skeleton doit s'afficher pendant le premier chargement.

Passe au prompt `02_PIPELINE.md` une fois validé.
