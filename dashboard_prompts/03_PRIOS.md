# PROMPT 03 — Onglet Prios

## Prérequis

Prompts `00`, `01`, `02` terminés.
Le Kanban Pipeline fonctionne avec des données réelles.

---

## Objectif

Implémenter l'onglet **Prios** : 4 colonnes d'actions commerciales à mener,
triées par urgence, avec actions directes sur chaque carte.

---

## Colonnes (de gauche à droite = urgence décroissante)

| Colonne             | Couleur    | Contenu                                              |
|---------------------|------------|------------------------------------------------------|
| En retard           | Rouge      | `joursRetard < 0` — dateRelance dépassée             |
| À faire aujourd'hui | Amber      | `joursRetard === 0`                                  |
| Réalisé cette sem.  | Vert       | Devis GAGNE cette semaine (lecture seule)            |
| Reste cette semaine | Bleu       | `joursRetard > 0` jusqu'à fin de semaine             |

---

## Fichier à créer : `frontend/src/components/dashboard/PriosPanel.tsx`

```tsx
'use client'

import type { PriosData, PrioCard } from '@/types'
import { formatEuros } from '@/lib/utils'

interface PriosPanelProps {
  prios: PriosData
  loading: boolean
}

// ── Config visuelle par colonne ──────────────────────────────────
const COLUMNS = [
  {
    key:   'enRetard' as const,
    title: 'En retard',
    countColor: 'text-red-500',
    headBg:  'bg-red-50',
    headBorder: 'border-red-200',
    bodyBorder: 'border-red-200',
    cardBg:  'bg-red-50',
    cardBorder: 'border-red-200',
    badge: (card: PrioCard) => ({
      label: `${Math.abs(card.joursRetard)} j`,
      style: { background: '#fef2f2', color: '#b91c1c' },
    }),
    showActions: true,
  },
  {
    key:   'aujourdhui' as const,
    title: "À faire aujourd'hui",
    countColor: 'text-amber-600',
    headBg:  'bg-amber-50',
    headBorder: 'border-amber-200',
    bodyBorder: 'border-amber-200',
    cardBg:  'bg-amber-50',
    cardBorder: 'border-amber-200',
    badge: () => ({ label: 'Auj.', style: { background: '#fffbeb', color: '#92400e' } }),
    showActions: true,
  },
  {
    key:   'realiseSemaine' as const,
    title: 'Réalisé cette semaine',
    countColor: 'text-green-600',
    headBg:  'bg-green-50',
    headBorder: 'border-green-200',
    bodyBorder: 'border-green-200',
    cardBg:  'bg-green-50',
    cardBorder: 'border-green-200',
    badge: () => ({ label: 'Gagné', style: { background: '#f0fdf4', color: '#15803d' } }),
    showActions: false,  // lecture seule
  },
  {
    key:   'resteSemaine' as const,
    title: 'Reste cette semaine',
    countColor: 'text-blue-600',
    headBg:  'bg-blue-50',
    headBorder: 'border-blue-200',
    bodyBorder: 'border-blue-200',
    cardBg:  'bg-blue-50',
    cardBorder: 'border-blue-200',
    badge: (card: PrioCard) => {
      const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
      const d = new Date(card.dateRelance)
      return { label: days[d.getDay()], style: { background: '#eff6ff', color: '#1d4ed8' } }
    },
    showActions: true,
  },
]

// ── Carte Prio ───────────────────────────────────────────────────
function PrioCardItem({
  card,
  col,
}: {
  card: PrioCard
  col: typeof COLUMNS[number]
}) {
  const badge = col.badge(card)

  return (
    <div
      className={`rounded-xl p-3 border ${col.cardBg} ${col.cardBorder}`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight pr-2">
          {card.companyName}
        </p>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={badge.style}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-xs text-gray-600 mb-2">
        {card.prestations.join(' + ')} · {formatEuros(card.montant)} · Dept. {card.departement}
      </p>

      {col.showActions && (
        <div className="flex flex-wrap gap-1.5">
          <button
            className="text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ background: '#f8b829', color: '#111827' }}
          >
            Appeler
          </button>
          <button
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-600"
          >
            Email
          </button>
          <button
            className="text-xs font-medium px-2.5 py-1 rounded-lg"
            style={{ background: '#dcfce7', color: '#15803d' }}
          >
            Gagné
          </button>
          <button
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-500"
          >
            Reporter
          </button>
        </div>
      )}
    </div>
  )
}

// ── Colonne Prio ─────────────────────────────────────────────────
function PrioColumn({
  col,
  cards,
}: {
  col: typeof COLUMNS[number]
  cards: PrioCard[]
}) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* En-tête */}
      <div
        className={`rounded-t-xl px-3 py-2.5 border border-b-0 ${col.headBg} ${col.headBorder}`}
      >
        <p className={`text-xs font-bold ${col.countColor}`}>{col.title}</p>
        <p className={`text-xs font-medium mt-0.5 ${col.countColor}`}>
          {cards.length} action{cards.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Corps */}
      <div
        className={`flex-1 border border-t-0 rounded-b-xl p-2 flex flex-col gap-2 bg-white min-h-[360px] ${col.bodyBorder}`}
      >
        {cards.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-gray-300">Aucune action</span>
          </div>
        ) : (
          cards.map(card => (
            <PrioCardItem key={card.id} card={card} col={col} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[0,1,2,3].map(i => (
        <div key={i} className="h-96 bg-gray-50 rounded-xl animate-pulse border border-gray-100" />
      ))}
    </div>
  )
}

export function PriosPanel({ prios, loading }: PriosPanelProps) {
  if (loading) return <Skeleton />

  return (
    <div className="grid grid-cols-4 gap-3">
      {COLUMNS.map(col => (
        <PrioColumn key={col.key} col={col} cards={prios[col.key]} />
      ))}
    </div>
  )
}
```

---

## Intégration dans `DashboardTabs`

`DashboardTabs.tsx` a été créé dans le prompt `01b_TABS.md` — **ne pas le recréer**.

Remplacer uniquement le `<ComingSoon label="Prios — prompt 03" />` par :

```tsx
// Ajouter l'import en haut de DashboardTabs.tsx :
import { PriosPanel } from './PriosPanel'

// Remplacer le slot prios :
{activeTab === 'prios' && (
  <PriosPanel
    prios={data?.prios ?? { enRetard: [], aujourdhui: [], realiseSemaine: [], resteSemaine: [] }}
    loading={loading}
  />
)}
```

---

## Comportement des boutons d'action

Pour cette version, les boutons affichent une confirmation simple.
L'intégration complète (mutation Twenty) sera faite dans une phase ultérieure.

```tsx
// Ajouter dans PrioCardItem, sur le bouton "Gagné" :
onClick={() => {
  if (confirm(`Marquer "${card.companyName}" comme Gagné ?`)) {
    // TODO: appel PATCH /api/opportunities/:id/status { statutDevis: 'GAGNE' }
    alert('Fonctionnalité à connecter — mutation Twenty à implémenter')
  }
}}

// Sur "Reporter" :
onClick={() => {
  // TODO: appel PATCH /api/opportunities/:id { dateRelance: demain }
  alert('Reporter d\'un jour — mutation Twenty à implémenter')
}}
```

---

## Vérification

- 4 colonnes visibles avec les bonnes couleurs
- Les cartes "En retard" affichent le nombre de jours de retard (ex: "3 j")
- Les cartes "Réalisé cette semaine" n'ont pas de boutons d'action
- Les cartes "Reste cette semaine" affichent le jour de la semaine (ex: "Lun.")
- Le total des 4 colonnes correspond aux données réelles de Twenty

Passe au prompt `04_PORTEFEUILLE.md` une fois validé.
