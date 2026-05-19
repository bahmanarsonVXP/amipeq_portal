# PROMPT 02 — Onglet Pipeline (Kanban)

## Prérequis

Prompts `00` et `01` terminés.
`useDashboard()` fonctionne, `KpiStrip` s'affiche avec des données réelles.

---

## Objectif

Implémenter l'onglet **Pipeline** : Kanban à 6 colonnes connecté au champ `stage` de Twenty.
C'est l'onglet par défaut du dashboard.

---

## Colonnes Kanban (ordre fixe)

| Stage Twenty        | Label affiché   | Couleur accent |
|---------------------|-----------------|----------------|
| `NOUVEAU`           | Nouveau         | `#ef4444` rouge |
| `DEVIS_EN_COURS`    | Devis en cours  | `#a855f7` violet |
| `DEVIS_EN_RELECTURE`| En relecture    | `#3b82f6` bleu |
| `DEVIS_ENVOYE`      | Devis envoyé    | `#06b6d4` cyan |
| `RELANCE`           | Relancé         | `#f59e0b` amber |
| `GAGNE`             | Gagné           | `#22c55e` vert |

**`REFUSE` est exclu du Kanban** — filtré côté Gateway (déjà fait dans le prompt 00).

---

## Fichiers à créer

### `frontend/src/components/dashboard/PipelinePanel.tsx`

```tsx
'use client'

import type { PipelineColumn } from '@/types'
import { KanbanColumn } from './KanbanColumn'

const COLUMN_COLORS: Record<string, string> = {
  NOUVEAU:            '#ef4444',
  DEVIS_EN_COURS:     '#a855f7',
  DEVIS_EN_RELECTURE: '#3b82f6',
  DEVIS_ENVOYE:       '#06b6d4',
  RELANCE:            '#f59e0b',
  GAGNE:              '#22c55e',
}

interface PipelinePanelProps {
  columns: PipelineColumn[]
  loading: boolean
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-4">
      {[0,1,2,3,4,5].map(i => (
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
```

### `frontend/src/components/dashboard/KanbanColumn.tsx`

```tsx
'use client'

import type { PipelineColumn, OpportunityCard } from '@/types'
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
          <span
            className="text-xs font-bold"
            style={{ color: accentColor }}
          >
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
```

### `frontend/src/components/dashboard/KanbanCard.tsx`

```tsx
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

// Liseré gauche rouge si relance en retard
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
      {/* Nom client */}
      <p className="text-xs font-semibold text-gray-900 leading-tight mb-1">
        {card.companyName}
      </p>

      {/* Département */}
      <p className="text-xs text-gray-400 mb-1.5">
        Dept. {card.departement}
      </p>

      {/* Montant */}
      {card.montant > 0 && (
        <p className="text-sm font-bold text-gray-900 mb-1.5">
          {formatEuros(card.montant)}
        </p>
      )}

      {/* Tags prestations */}
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
```

---

## Utilitaire à ajouter dans `frontend/src/lib/utils.ts`

```typescript
export function formatEuros(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(montant)
}
```

---

## Intégration dans `DashboardTabs`

`DashboardTabs.tsx` a été créé dans le prompt `01b_TABS.md` — **ne pas le recréer**.

Remplacer uniquement le `<ComingSoon label="Pipeline — prompt 02" />` par :

```tsx
// Dans DashboardTabs.tsx, ajouter l'import en haut :
import { PipelinePanel } from './PipelinePanel'

// Remplacer le slot pipeline :
{activeTab === 'pipeline' && (
  <PipelinePanel
    columns={data?.pipeline ?? []}
    loading={loading}
  />
)}
```

---

## Vérification

- Les 6 colonnes s'affichent avec les bons labels et couleurs
- Chaque carte montre : nom client, département, montant, tags prestations
- Les colonnes vides affichent "Aucun devis"
- Le scroll horizontal fonctionne si les 6 colonnes dépassent la largeur
- Les cartes dans "Relancé" avec dateRelance dépassée ont un liseré gauche rouge

Passe au prompt `03_PRIOS.md` une fois validé.
