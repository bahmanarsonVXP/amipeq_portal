# PROMPT 00 — Socle Dashboard : types, hook, route Gateway

## Contexte

Portail AMIPEQ — `localhost:3000`. Stack : Next.js 14 static export (Cloudflare Pages) +
Gateway Hono (Cloudflare Workers) + Twenty CRM (Railway, GraphQL).

Le frontend appelle **uniquement** le Gateway via `NEXT_PUBLIC_API_URL`.
Jamais Twenty directement.

Lis `PROMPT_PORTAL.md` pour l'architecture complète avant de commencer.

---

## Objectif de ce prompt

Poser les fondations communes utilisées par tous les autres prompts dashboard :
1. Types TypeScript partagés
2. Route Gateway `/api/stats/dashboard`
3. Hook React `useDashboard`

Ne pas toucher au layout, topbar, auth, ni aux autres pages.

---

## ÉTAPE 1 — Types TypeScript

Ajouter dans `frontend/src/types/index.ts` (à la suite des types existants) :

```typescript
// ─── Dashboard ────────────────────────────────────────────────

export interface DashboardKpis {
  caMois: number              // € gagnés mois courant
  caVariationPct: number      // % vs même mois N-1 (0 si indispo)
  devisEnAttente: number      // nombre d'opps EN_ATTENTE
  potentielEnAttente: number  // € total des opps EN_ATTENTE
  tauxTransformation: number  // % arrondi : GAGNE/(GAGNE+REFUSE)*100
  relancesEnRetard: number    // opps EN_ATTENTE avec dateRelance < today
}

export interface OpportunityCard {
  id: string
  numeroDevis: string
  companyName: string
  companyId: string
  departement: string       // ex: "13", "69", "2A"
  montant: number           // euros
  prestations: string[]     // ['DUERP','PPMS',...]
  stage: string
  statutDevis: 'GAGNE' | 'REFUSE' | 'EN_ATTENTE'
  dateRelance: string | null
}

export interface PrioCard {
  id: string
  companyName: string
  departement: string
  montant: number
  prestations: string[]
  dateRelance: string
  joursRetard: number       // négatif = en retard, 0 = aujourd'hui, positif = à venir
}

export interface PipelineColumn {
  stage: string
  label: string             // label d'affichage
  count: number
  totalMontant: number
  cards: OpportunityCard[]  // 10 premières max
}

export interface PortefeuilleData {
  totalActifs: number
  totalProspects: number
  totalInactifs: number
  parType: { type: string; label: string; count: number }[]
  parPrestation: { prestation: string; count: number }[]
  topDepartements: { dept: string; count: number; ca: number }[]
  topClients: { id: string; name: string; type: string; ca: number }[]
}

export interface PriosData {
  enRetard: PrioCard[]
  aujourdhui: PrioCard[]
  realiseSemaine: PrioCard[]
  resteSemaine: PrioCard[]
}

export interface DashboardData {
  kpis: DashboardKpis
  pipeline: PipelineColumn[]
  prios: PriosData
  portefeuille: PortefeuilleData
}
```

---

## ÉTAPE 2 — Route Gateway `/api/stats/dashboard`

Fichier : `gateway/src/routes/stats.ts`

Ajouter le handler `GET /dashboard` à la route stats existante.
Il exécute **3 requêtes GraphQL en parallèle** vers Twenty puis agrège.

### Helpers internes

```typescript
const PIPELINE_ORDER = [
  { stage: 'NOUVEAU',            label: 'Nouveau' },
  { stage: 'DEVIS_EN_COURS',     label: 'Devis en cours' },
  { stage: 'DEVIS_EN_RELECTURE', label: 'En relecture' },
  { stage: 'DEVIS_ENVOYE',       label: 'Devis envoyé' },
  { stage: 'RELANCE',            label: 'Relancé' },
  { stage: 'GAGNE',              label: 'Gagné' },
]

function toEuros(amountMicros: number | undefined): number {
  return Math.round((amountMicros ?? 0) / 1_000_000)
}

function getDept(company: any): string {
  return (company?.address?.addressState ?? '').trim() || '—'
}

function joursRetard(dateRelance: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateRelance); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return d >= mon && d <= sun
}

function startOfMonth(): string {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}
```

### Requêtes GraphQL

```typescript
// Requête 1 : opportunities du mois (pipeline + KPIs)
const Q_MOIS = `
  query OpsMois($dateDebut: DateTime!, $dateFin: DateTime!) {
    opportunities(
      filter: { dateDevis: { gte: $dateDebut, lte: $dateFin } }
      orderBy: { dateDevis: DescNullsLast }
    ) {
      edges { node {
        id numeroDevis stage statutDevis
        amount { amountMicros currencyCode }
        prestation naturePrestation
        dateDevis dateRelance
        company { id name typeClient address { addressState } }
      }}
    }
  }
`

// Requête 2 : prios (EN_ATTENTE avec dateRelance dans les 7 prochains jours + passées)
const Q_PRIOS = `
  query Prios($dateMax: DateTime!) {
    opportunities(
      filter: {
        statutDevis: { eq: "EN_ATTENTE" }
        dateRelance: { lte: $dateMax }
      }
      orderBy: { dateRelance: AscNullsLast }
    ) {
      edges { node {
        id numeroDevis stage
        amount { amountMicros }
        prestation dateRelance
        company { id name address { addressState } }
      }}
    }
  }
`

// Requête 3 : portefeuille companies
const Q_PORTEFEUILLE = `
  query Portefeuille {
    companies(
      filter: { statutClient: { in: ["CLIENT_ACTIF", "PROSPECT", "CLIENT_INACTIF"] } }
    ) {
      edges { node {
        id typeClient statutClient address { addressState }
      }}
    }
  }
`

// Requête 4 : top clients (opportunities GAGNE année courante)
const Q_TOP = `
  query TopClients($annee: Float!) {
    opportunities(
      filter: { statutDevis: { eq: "GAGNE" }, anneeDevis: { eq: $annee } }
    ) {
      edges { node {
        amount { amountMicros }
        company { id name typeClient }
      }}
    }
  }
`
```

### Logique d'agrégation

```typescript
statsRoutes.get('/dashboard', async (c) => {
  const twenty = getTwentyClient(c)  // client GraphQL existant dans gateway/src/lib/twenty.ts
  const today = new Date(); today.setHours(0,0,0,0)
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7)
  const annee = today.getFullYear()

  // Exécution parallèle
  const [rMois, rPrios, rPortefeuille, rTop] = await Promise.all([
    twenty.query(Q_MOIS, { dateDebut: startOfMonth(), dateFin: endOfMonth() }),
    twenty.query(Q_PRIOS, { dateMax: in7days.toISOString() }),
    twenty.query(Q_PORTEFEUILLE, {}),
    twenty.query(Q_TOP, { annee }),
  ])

  const opsMois = rMois.opportunities.edges.map((e: any) => e.node)
  const opsPrios = rPrios.opportunities.edges.map((e: any) => e.node)
  const companies = rPortefeuille.companies.edges.map((e: any) => e.node)
  const opsTop = rTop.opportunities.edges.map((e: any) => e.node)

  // ── KPIs ──────────────────────────────────────────
  const gagnes = opsMois.filter((o: any) => o.statutDevis === 'GAGNE')
  const refuses = opsMois.filter((o: any) => o.statutDevis === 'REFUSE')
  const enAttente = opsMois.filter((o: any) => o.statutDevis === 'EN_ATTENTE')
  const caMois = gagnes.reduce((s: number, o: any) => s + toEuros(o.amount?.amountMicros), 0)
  const potentiel = enAttente.reduce((s: number, o: any) => s + toEuros(o.amount?.amountMicros), 0)
  const tx = gagnes.length + refuses.length > 0
    ? Math.round(gagnes.length / (gagnes.length + refuses.length) * 100)
    : 0

  // Relances en retard = EN_ATTENTE globales avec dateRelance < today
  const enRetard = opsPrios.filter((o: any) => joursRetard(o.dateRelance) < 0)

  // ── Pipeline ──────────────────────────────────────
  const pipeline = PIPELINE_ORDER.map(({ stage, label }) => {
    const cols = opsMois
      .filter((o: any) => o.stage === stage && o.statutDevis !== 'REFUSE')
    return {
      stage, label,
      count: cols.length,
      totalMontant: cols.reduce((s: number, o: any) => s + toEuros(o.amount?.amountMicros), 0),
      cards: cols.slice(0, 10).map((o: any): OpportunityCard => ({
        id: o.id,
        numeroDevis: o.numeroDevis ?? '',
        companyName: o.company?.name ?? '—',
        companyId: o.company?.id ?? '',
        departement: getDept(o.company),
        montant: toEuros(o.amount?.amountMicros),
        prestations: Array.isArray(o.prestation) ? o.prestation : [],
        stage: o.stage,
        statutDevis: o.statutDevis,
        dateRelance: o.dateRelance ?? null,
      })),
    }
  })

  // ── Prios ─────────────────────────────────────────
  const toPrioCard = (o: any): PrioCard => ({
    id: o.id,
    companyName: o.company?.name ?? '—',
    departement: getDept(o.company),
    montant: toEuros(o.amount?.amountMicros),
    prestations: Array.isArray(o.prestation) ? o.prestation : [],
    dateRelance: o.dateRelance,
    joursRetard: joursRetard(o.dateRelance),
  })

  // GAGNE cette semaine = depuis opsMois
  const gagnesSemaine = opsMois
    .filter((o: any) => o.statutDevis === 'GAGNE' && isThisWeek(o.dateDevis))
    .map((o: any): PrioCard => ({
      id: o.id,
      companyName: o.company?.name ?? '—',
      departement: getDept(o.company),
      montant: toEuros(o.amount?.amountMicros),
      prestations: Array.isArray(o.prestation) ? o.prestation : [],
      dateRelance: o.dateDevis,
      joursRetard: 0,
    }))

  const prios = {
    enRetard: opsPrios.filter((o: any) => joursRetard(o.dateRelance) < 0).map(toPrioCard),
    aujourdhui: opsPrios.filter((o: any) => joursRetard(o.dateRelance) === 0).map(toPrioCard),
    realiseSemaine: gagnesSemaine,
    resteSemaine: opsPrios.filter((o: any) => joursRetard(o.dateRelance) > 0).map(toPrioCard),
  }

  // ── Portefeuille ──────────────────────────────────
  const actifs = companies.filter((c: any) => c.statutClient === 'CLIENT_ACTIF')
  const prospects = companies.filter((c: any) => c.statutClient === 'PROSPECT')
  const inactifs = companies.filter((c: any) => c.statutClient === 'CLIENT_INACTIF')

  const TYPE_LABELS: Record<string, string> = {
    ETABLISSEMENT_SCOLAIRE: 'Scolaire',
    MAIRIE_COLLECTIVITE: 'Mairie',
    ENTREPRISE_TPE_PME: 'Entreprise',
    AUTRE: 'Autre',
  }
  const byType = Object.entries(
    actifs.reduce((acc: any, c: any) => {
      const k = c.typeClient ?? 'AUTRE'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([type, count]) => ({ type, label: TYPE_LABELS[type] ?? type, count: count as number }))
    .sort((a, b) => b.count - a.count)

  // Top départements
  const deptMap: Record<string, { count: number; ca: number }> = {}
  opsTop.forEach((o: any) => {
    const dept = getDept(o.company)
    if (dept === '—') return
    if (!deptMap[dept]) deptMap[dept] = { count: 0, ca: 0 }
    deptMap[dept].count++
    deptMap[dept].ca += toEuros(o.amount?.amountMicros)
  })
  // Compléter avec companies actives
  actifs.forEach((c: any) => {
    const dept = getDept(c)
    if (dept === '—') return
    if (!deptMap[dept]) deptMap[dept] = { count: 0, ca: 0 }
    deptMap[dept].count++
  })
  const topDepts = Object.entries(deptMap)
    .map(([dept, v]) => ({ dept, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Top clients
  const clientMap: Record<string, { id: string; name: string; type: string; ca: number }> = {}
  opsTop.forEach((o: any) => {
    const c = o.company
    if (!c) return
    if (!clientMap[c.id]) clientMap[c.id] = { id: c.id, name: c.name, type: c.typeClient ?? 'AUTRE', ca: 0 }
    clientMap[c.id].ca += toEuros(o.amount?.amountMicros)
  })
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5)

  // Prestations (depuis opsMois GAGNE)
  const prestMap: Record<string, number> = {}
  gagnes.forEach((o: any) => {
    ;(o.prestation ?? []).forEach((p: string) => {
      prestMap[p] = (prestMap[p] ?? 0) + 1
    })
  })
  const parPrestation = Object.entries(prestMap)
    .map(([prestation, count]) => ({ prestation, count }))
    .sort((a, b) => b.count - a.count)

  return c.json({
    kpis: {
      caMois,
      caVariationPct: 0,   // TODO: requête N-1 en phase ultérieure
      devisEnAttente: enAttente.length,
      potentielEnAttente: potentiel,
      tauxTransformation: tx,
      relancesEnRetard: enRetard.length,
    },
    pipeline,
    prios,
    portefeuille: {
      totalActifs: actifs.length,
      totalProspects: prospects.length,
      totalInactifs: inactifs.length,
      parType: byType,
      parPrestation,
      topDepartements: topDepts,
      topClients,
    },
  })
})
```

Enregistrer la route dans `gateway/src/index.ts` si pas déjà fait :
```typescript
app.route('/api/stats', statsRoutes)
```

---

## ÉTAPE 3 — Hook `useDashboard`

Remplacer le contenu de `frontend/src/hooks/useDashboard.ts` :

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import type { DashboardData } from '@/types'

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await apiFetch('/api/stats/dashboard')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setData(json)
    } catch (e: any) {
      setError(e.message ?? 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refresh: load }
}
```

---

## Vérification

Une fois les 3 étapes terminées, vérifier :

```bash
# 1. Le Gateway répond
curl http://localhost:8787/api/stats/dashboard \
  -H "Authorization: Bearer <ton_jwt_de_test>"

# La réponse doit avoir la forme :
# { kpis: {...}, pipeline: [...], prios: {...}, portefeuille: {...} }

# 2. Le hook ne plante pas dans la page dashboard
# Ajouter temporairement dans dashboard/page.tsx :
# const { data, loading } = useDashboard()
# console.log('dashboard data', data)
```

**Ce prompt ne touche pas au rendu visuel.**
Passe au prompt `01_PAGE_HEADER.md` une fois cette étape validée.
