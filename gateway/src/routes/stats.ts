import { Hono } from 'hono';
import { queryTwenty } from '../lib/twenty';
import { cache, TTL } from '../lib/cache';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

/** Suffixe clés cache DDA (fetchDDA / fetchDevisDDA) : incrémenter si la définition YTD change. */
const DDA_CACHE_TAG = 'ytd-gte-jan1'

/**
 * Sans `first`, Twenty tronque souvent les listes (ex. 100–200) : les totaux 12M / DDA deviennent faux
 * (ex. montant DDA > 12M car la fenêtre la plus large est incomplète).
 */
const OPPS_AGG_FIRST = 10_000

// ── Helpers ────────────────────────────────────────────────────

const PIPELINE_ORDER = [
  { stage: 'OPP_NEW', label: 'Nouvelle' },
  { stage: 'OPP_QUOTE_PREP', label: 'Devis en cours' },
  { stage: 'OPP_CLIENT_PENDING', label: 'Attente retour client' },
  { stage: 'OPP_FOLLOWUP', label: 'Suivi client actif' },
  { stage: 'OPP_STANDBY', label: 'Standby / report' },
  { stage: 'OPP_WON', label: 'Gagné' },
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

function nomMois(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
    .format(date)
    .replace(/^./, c => c.toUpperCase())
}

function delta(valeur: number, ref: number): number | null {
  if (ref === 0) return null
  return Math.round((valeur - ref) / ref * 100)
}

// ── Cache helper (module-level) ────────────────────────────────

async function fetchOrCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key)
  if (cached !== null) return cached
  const value = await fetcher()
  cache.set(key, value, ttl)
  return value
}

// ── Requêtes CA (module-level, prennent env en paramètre) ──────

// DDA : YTD — même année civile que `annee`, entre le 1er janv. et le plafond (cohérent avec le 12M glissant basé sur dateDevis)
async function fetchDDA(env: Env, annee: number, dateCeil: Date): Promise<number> {
  const yearStart = new Date(annee, 0, 1)
  yearStart.setHours(0, 0, 0, 0)
  const r = await queryTwenty<any>(env, `query {
    opportunities(filter: { and: [
      { statutDevis: { eq: GAGNE } },
      { anneeDevis: { eq: ${annee} } },
      { dateDevis: { gte: "${yearStart.toISOString()}" } },
      { dateDevis: { lte: "${dateCeil.toISOString()}" } }
    ]}, first: ${OPPS_AGG_FIRST}) { edges { node { amount { amountMicros } } } }
  }`)
  return r.opportunities.edges.reduce((s: number, e: any) => s + toEuros(e.node.amount?.amountMicros), 0)
}

// Période libre : par plage de dateDevis (pour 12M glissants)
async function fetchCaPeriode(env: Env, debut: Date, fin: Date): Promise<number> {
  const r = await queryTwenty<any>(env, `query {
    opportunities(filter: { and: [
      { statutDevis: { eq: GAGNE } },
      { dateDevis: { gte: "${debut.toISOString()}" } },
      { dateDevis: { lte: "${fin.toISOString()}" } }
    ]}, first: ${OPPS_AGG_FIRST}) { edges { node { amount { amountMicros } } } }
  }`)
  return r.opportunities.edges.reduce((s: number, e: any) => s + toEuros(e.node.amount?.amountMicros), 0)
}

// Devis produits DDA : tous statuts, YTD — dateDevis dans [1er janv. année ; plafond] pour rester inclus dans le 12M glissant
async function fetchDevisDDA(env: Env, annee: number, dateCeil: Date): Promise<{ nb: number; montant: number }> {
  const yearStart = new Date(annee, 0, 1)
  yearStart.setHours(0, 0, 0, 0)
  const r = await queryTwenty<any>(env, `query {
    opportunities(filter: { and: [
      { anneeDevis: { eq: ${annee} } },
      { dateDevis: { gte: "${yearStart.toISOString()}" } },
      { dateDevis: { lte: "${dateCeil.toISOString()}" } }
    ]}, first: ${OPPS_AGG_FIRST}) { edges { node { amount { amountMicros } } } }
  }`)
  const edges = r.opportunities.edges
  return {
    nb: edges.length,
    montant: edges.reduce((s: number, e: any) => s + toEuros(e.node.amount?.amountMicros), 0),
  }
}

// Devis produits période libre : tous statuts
async function fetchDevisPeriode(env: Env, debut: Date, fin: Date): Promise<{ nb: number; montant: number }> {
  const r = await queryTwenty<any>(env, `query {
    opportunities(filter: { and: [
      { dateDevis: { gte: "${debut.toISOString()}" } },
      { dateDevis: { lte: "${fin.toISOString()}" } }
    ]}, first: ${OPPS_AGG_FIRST}) { edges { node { amount { amountMicros } } } }
  }`)
  const edges = r.opportunities.edges
  return {
    nb: edges.length,
    montant: edges.reduce((s: number, e: any) => s + toEuros(e.node.amount?.amountMicros), 0),
  }
}

// Taux historique N-1/N-2
async function fetchTauxHistorique(env: Env, annee: number, dateCeil: Date): Promise<number> {
  const r = await queryTwenty<any>(env, `query {
    opportunities(filter: { and: [
      { anneeDevis: { eq: ${annee} } },
      { dateDevis: { lte: "${dateCeil.toISOString()}" } },
      { statutDevis: { in: [GAGNE, PERDU] } }
    ]}, first: ${OPPS_AGG_FIRST}) { edges { node { statutDevis } } }
  }`)
  const nodes = r.opportunities.edges.map((e: any) => e.node)
  const g = nodes.filter((n: any) => n.statutDevis === 'GAGNE').length
  const t = nodes.length
  return t > 0 ? Math.round(g / t * 100) : 0
}

// ── Requêtes GraphQL de base ────────────────────────────────────

const Q_MOIS = `
  query OpsMois($dateDebut: DateTime!, $dateFin: DateTime!) {
    opportunities(
      filter: { and: [{ dateDevis: { gte: $dateDebut } }, { dateDevis: { lte: $dateFin } }] }
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

const Q_PRIOS = `
  query Prios($dateMax: DateTime!) {
    opportunities(
      filter: {
        statutDevis: { eq: EN_ATTENTE }
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

const Q_PORTEFEUILLE = `
  query Portefeuille {
    companies(
      filter: { statutClient: { in: [CLIENT_ACTIF, PROSPECT, CLIENT_INACTIF] } }
    ) {
      edges { node {
        id typeClient statutClient address { addressState }
      }}
    }
  }
`

const Q_TOP = `
  query TopClients($annee: Float!) {
    opportunities(
      filter: { statutDevis: { eq: GAGNE }, anneeDevis: { eq: $annee } }
    ) {
      edges { node {
        amount { amountMicros }
        company { id name typeClient }
      }}
    }
  }
`

// ── Route /ca — CA par date de référence ──────────────────────

app.get('/ca', async (c) => {
  // Parsing et validation de la date
  const dateParam = c.req.query('date')
  const todayRaw = new Date()
  let refDate = new Date(todayRaw)

  if (dateParam) {
    const parsed = new Date(dateParam)
    if (!isNaN(parsed.getTime())) {
      const janFirst = new Date(todayRaw.getFullYear(), 0, 1)
      refDate = parsed > todayRaw ? todayRaw : parsed < janFirst ? janFirst : parsed
    }
  }
  refDate.setHours(23, 59, 59, 999)

  const dateKey  = refDate.toISOString().slice(0, 10)
  const isToday  = dateKey === todayRaw.toISOString().slice(0, 10)
  const ttlCur   = isToday ? TTL.COURANT : TTL.HISTORIQUE

  const annee   = refDate.getFullYear()
  const anneeN1 = annee - 1
  const anneeN2 = annee - 2
  const mois    = refDate.getMonth()

  // Fenêtres temporelles
  const memeJourN1 = new Date(refDate); memeJourN1.setFullYear(anneeN1)
  const memeJourN2 = new Date(refDate); memeJourN2.setFullYear(anneeN2)

  const debut12M  = new Date(refDate); debut12M.setFullYear(annee - 1)
  const debut24M  = new Date(refDate); debut24M.setFullYear(annee - 2)
  const debut36M  = new Date(refDate); debut36M.setFullYear(annee - 3)

  const debutMois   = new Date(annee,   mois, 1)
  const finMois     = new Date(annee,   mois + 1, 0, 23, 59, 59)
  const debutMoisN1 = new Date(anneeN1, mois, 1)
  const finMoisN1   = new Date(anneeN1, mois + 1, 0, 23, 59, 59)
  const debutMoisN2 = new Date(anneeN2, mois, 1)
  const finMoisN2   = new Date(anneeN2, mois + 1, 0, 23, 59, 59)

  // Clés de cache
  const KEY_DDA      = `dda:${DDA_CACHE_TAG}:${annee}:${dateKey}`
  const KEY_DDA_N1   = `dda:${DDA_CACHE_TAG}:${anneeN1}:${memeJourN1.toISOString().slice(0, 10)}`
  const KEY_DDA_N2   = `dda:${DDA_CACHE_TAG}:${anneeN2}:${memeJourN2.toISOString().slice(0, 10)}`
  const KEY_12M      = `12m:${debut12M.toISOString().slice(0, 10)}:${dateKey}`
  const KEY_12M_N1   = `12m:${debut24M.toISOString().slice(0, 10)}:${debut12M.toISOString().slice(0, 10)}`
  const KEY_12M_N2   = `12m:${debut36M.toISOString().slice(0, 10)}:${debut24M.toISOString().slice(0, 10)}`
  const KEY_MOIS     = `mois:${annee}-${mois}:${dateKey}`
  const KEY_MOIS_N1  = `mois:${anneeN1}-${mois}`
  const KEY_MOIS_N2  = `mois:${anneeN2}-${mois}`

  const KEY_DV_DDA   = `dv:dda:${DDA_CACHE_TAG}:${annee}:${dateKey}`
  const KEY_DV_DDA_N1 = `dv:dda:${DDA_CACHE_TAG}:${anneeN1}:${memeJourN1.toISOString().slice(0, 10)}`
  const KEY_DV_DDA_N2 = `dv:dda:${DDA_CACHE_TAG}:${anneeN2}:${memeJourN2.toISOString().slice(0, 10)}`
  const KEY_DV_12M    = `dv:12m:${debut12M.toISOString().slice(0, 10)}:${dateKey}`
  const KEY_DV_12M_N1 = `dv:12m:${debut24M.toISOString().slice(0, 10)}:${debut12M.toISOString().slice(0, 10)}`
  const KEY_DV_12M_N2 = `dv:12m:${debut36M.toISOString().slice(0, 10)}:${debut24M.toISOString().slice(0, 10)}`
  const KEY_DV_MOIS   = `dv:mois:${annee}-${mois}:${dateKey}`
  const KEY_DV_MOIS_N1 = `dv:mois:${anneeN1}-${mois}`
  const KEY_DV_MOIS_N2 = `dv:mois:${anneeN2}-${mois}`

  const [
    ddaN, ddaN1, ddaN2, m12N, m12N1, m12N2, moisN, moisN1, moisN2,
    dvDDA, dvDDA_N1, dvDDA_N2,
    dv12M, dv12M_N1, dv12M_N2,
    dvMois, dvMois_N1, dvMois_N2,
  ] = await Promise.all([
    fetchOrCache(KEY_DDA,     ttlCur,         () => fetchDDA(c.env, annee,   refDate)),
    fetchOrCache(KEY_DDA_N1,  TTL.HISTORIQUE, () => fetchDDA(c.env, anneeN1, memeJourN1)),
    fetchOrCache(KEY_DDA_N2,  TTL.HISTORIQUE, () => fetchDDA(c.env, anneeN2, memeJourN2)),
    fetchOrCache(KEY_12M,     ttlCur,         () => fetchCaPeriode(c.env, debut12M, refDate)),
    fetchOrCache(KEY_12M_N1,  TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debut24M, debut12M)),
    fetchOrCache(KEY_12M_N2,  TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debut36M, debut24M)),
    fetchOrCache(KEY_MOIS,    ttlCur,         () => fetchCaPeriode(c.env, debutMois, finMois)),
    fetchOrCache(KEY_MOIS_N1, TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debutMoisN1, finMoisN1)),
    fetchOrCache(KEY_MOIS_N2, TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debutMoisN2, finMoisN2)),
    fetchOrCache(KEY_DV_DDA,  ttlCur,         () => fetchDevisDDA(c.env, annee, refDate)),
    fetchOrCache(KEY_DV_DDA_N1, TTL.HISTORIQUE, () => fetchDevisDDA(c.env, anneeN1, memeJourN1)),
    fetchOrCache(KEY_DV_DDA_N2, TTL.HISTORIQUE, () => fetchDevisDDA(c.env, anneeN2, memeJourN2)),
    fetchOrCache(KEY_DV_12M,  ttlCur,         () => fetchDevisPeriode(c.env, debut12M, refDate)),
    fetchOrCache(KEY_DV_12M_N1, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debut24M, debut12M)),
    fetchOrCache(KEY_DV_12M_N2, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debut36M, debut24M)),
    fetchOrCache(KEY_DV_MOIS, ttlCur,         () => fetchDevisPeriode(c.env, debutMois, finMois)),
    fetchOrCache(KEY_DV_MOIS_N1, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debutMoisN1, finMoisN1)),
    fetchOrCache(KEY_DV_MOIS_N2, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debutMoisN2, finMoisN2)),
  ])

  return c.json({
    dda: {
      valeur: ddaN, n1: ddaN1, n2: ddaN2,
      deltaN1Pct: delta(ddaN, ddaN1),
      deltaN2Pct: delta(ddaN, ddaN2),
      nbDevis: dvDDA.nb, montantDevis: dvDDA.montant,
      deltaNbDevisN1Pct: delta(dvDDA.nb, dvDDA_N1.nb),
      deltaNbDevisN2Pct: delta(dvDDA.nb, dvDDA_N2.nb),
      deltaMontantDevisN1Pct: delta(dvDDA.montant, dvDDA_N1.montant),
      deltaMontantDevisN2Pct: delta(dvDDA.montant, dvDDA_N2.montant),
    },
    glissant12M: {
      valeur: m12N, n1: m12N1, n2: m12N2,
      deltaN1Pct: delta(m12N, m12N1),
      deltaN2Pct: delta(m12N, m12N2),
      nbDevis: dv12M.nb, montantDevis: dv12M.montant,
      deltaNbDevisN1Pct: delta(dv12M.nb, dv12M_N1.nb),
      deltaNbDevisN2Pct: delta(dv12M.nb, dv12M_N2.nb),
      deltaMontantDevisN1Pct: delta(dv12M.montant, dv12M_N1.montant),
      deltaMontantDevisN2Pct: delta(dv12M.montant, dv12M_N2.montant),
    },
    moisCourant: {
      valeur: moisN, nomMois: nomMois(refDate), n1: moisN1, n2: moisN2,
      deltaN1Pct: delta(moisN, moisN1),
      deltaN2Pct: delta(moisN, moisN2),
      nbDevis: dvMois.nb, montantDevis: dvMois.montant,
      deltaNbDevisN1Pct: delta(dvMois.nb, dvMois_N1.nb),
      deltaNbDevisN2Pct: delta(dvMois.nb, dvMois_N2.nb),
      deltaMontantDevisN1Pct: delta(dvMois.montant, dvMois_N1.montant),
      deltaMontantDevisN2Pct: delta(dvMois.montant, dvMois_N2.montant),
    },
  })
})

// ── Route /dashboard ───────────────────────────────────────────

app.get('/dashboard', async (c) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7)
  const annee   = today.getFullYear()
  const anneeN1 = annee - 1
  const anneeN2 = annee - 2
  const mois    = today.getMonth()

  const memeJourN1 = new Date(today); memeJourN1.setFullYear(anneeN1)
  const memeJourN2 = new Date(today); memeJourN2.setFullYear(anneeN2)
  const debutMois   = new Date(annee,   mois, 1)
  const finMois     = new Date(annee,   mois + 1, 0, 23, 59, 59)
  const debutMoisN1 = new Date(anneeN1, mois, 1)
  const finMoisN1   = new Date(anneeN1, mois + 1, 0, 23, 59, 59)
  const debutMoisN2 = new Date(anneeN2, mois, 1)
  const finMoisN2   = new Date(anneeN2, mois + 1, 0, 23, 59, 59)
  const debut12M    = new Date(today); debut12M.setFullYear(annee - 1)
  const debut24M    = new Date(today); debut24M.setFullYear(annee - 2)
  const debut36M    = new Date(today); debut36M.setFullYear(annee - 3)

  const todayKey = today.toISOString().slice(0, 10)

  const KEY_DDA      = `dda:${DDA_CACHE_TAG}:${annee}:${todayKey}`
  const KEY_DDA_N1   = `dda:${DDA_CACHE_TAG}:${anneeN1}:${memeJourN1.toISOString().slice(0, 10)}`
  const KEY_DDA_N2   = `dda:${DDA_CACHE_TAG}:${anneeN2}:${memeJourN2.toISOString().slice(0, 10)}`
  const KEY_12M      = `12m:${debut12M.toISOString().slice(0, 10)}:${todayKey}`
  const KEY_12M_N1   = `12m:${debut24M.toISOString().slice(0, 10)}:${debut12M.toISOString().slice(0, 10)}`
  const KEY_12M_N2   = `12m:${debut36M.toISOString().slice(0, 10)}:${debut24M.toISOString().slice(0, 10)}`
  const KEY_MOIS     = `mois:${annee}-${mois}:${todayKey}`
  const KEY_MOIS_N1  = `mois:${anneeN1}-${mois}`
  const KEY_MOIS_N2  = `mois:${anneeN2}-${mois}`
  const KEY_TX_N1    = `tx:${anneeN1}:j:${mois}-${today.getDate()}`
  const KEY_TX_N2    = `tx:${anneeN2}:j:${mois}-${today.getDate()}`
  const KEY_DV_DDA    = `dv:dda:${DDA_CACHE_TAG}:${annee}:${todayKey}`
  const KEY_DV_DDA_N1 = `dv:dda:${DDA_CACHE_TAG}:${anneeN1}:${memeJourN1.toISOString().slice(0, 10)}`
  const KEY_DV_DDA_N2 = `dv:dda:${DDA_CACHE_TAG}:${anneeN2}:${memeJourN2.toISOString().slice(0, 10)}`
  const KEY_DV_12M    = `dv:12m:${debut12M.toISOString().slice(0, 10)}:${todayKey}`
  const KEY_DV_12M_N1 = `dv:12m:${debut24M.toISOString().slice(0, 10)}:${debut12M.toISOString().slice(0, 10)}`
  const KEY_DV_12M_N2 = `dv:12m:${debut36M.toISOString().slice(0, 10)}:${debut24M.toISOString().slice(0, 10)}`
  const KEY_DV_MOIS    = `dv:mois:${annee}-${mois}:${todayKey}`
  const KEY_DV_MOIS_N1 = `dv:mois:${anneeN1}-${mois}`
  const KEY_DV_MOIS_N2 = `dv:mois:${anneeN2}-${mois}`

  const [
    rMois, rPrios, rPortefeuille, rTop,
    ddaN, ddaN1, ddaN2,
    m12N, m12N1, m12N2,
    moisN, moisN1, moisN2,
    txN1, txN2,
    dvDDA, dvDDA_N1, dvDDA_N2,
    dv12M, dv12M_N1, dv12M_N2,
    dvMois, dvMois_N1, dvMois_N2,
  ] = await Promise.all([
    queryTwenty<any>(c.env, Q_MOIS, { dateDebut: debutMois.toISOString(), dateFin: finMois.toISOString() }),
    queryTwenty<any>(c.env, Q_PRIOS, { dateMax: in7days.toISOString() }),
    queryTwenty<any>(c.env, Q_PORTEFEUILLE, {}),
    queryTwenty<any>(c.env, Q_TOP, { annee }),
    fetchOrCache(KEY_DDA,     TTL.COURANT,    () => fetchDDA(c.env, annee,   today)),
    fetchOrCache(KEY_DDA_N1,  TTL.HISTORIQUE, () => fetchDDA(c.env, anneeN1, memeJourN1)),
    fetchOrCache(KEY_DDA_N2,  TTL.HISTORIQUE, () => fetchDDA(c.env, anneeN2, memeJourN2)),
    fetchOrCache(KEY_12M,     TTL.COURANT,    () => fetchCaPeriode(c.env, debut12M, today)),
    fetchOrCache(KEY_12M_N1,  TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debut24M, debut12M)),
    fetchOrCache(KEY_12M_N2,  TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debut36M, debut24M)),
    fetchOrCache(KEY_MOIS,    TTL.COURANT,    () => fetchCaPeriode(c.env, debutMois, finMois)),
    fetchOrCache(KEY_MOIS_N1, TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debutMoisN1, finMoisN1)),
    fetchOrCache(KEY_MOIS_N2, TTL.HISTORIQUE, () => fetchCaPeriode(c.env, debutMoisN2, finMoisN2)),
    fetchOrCache(KEY_TX_N1,   TTL.HISTORIQUE, () => fetchTauxHistorique(c.env, anneeN1, memeJourN1)),
    fetchOrCache(KEY_TX_N2,   TTL.HISTORIQUE, () => fetchTauxHistorique(c.env, anneeN2, memeJourN2)),
    fetchOrCache(KEY_DV_DDA,  TTL.COURANT,    () => fetchDevisDDA(c.env, annee, today)),
    fetchOrCache(KEY_DV_DDA_N1, TTL.HISTORIQUE, () => fetchDevisDDA(c.env, anneeN1, memeJourN1)),
    fetchOrCache(KEY_DV_DDA_N2, TTL.HISTORIQUE, () => fetchDevisDDA(c.env, anneeN2, memeJourN2)),
    fetchOrCache(KEY_DV_12M,  TTL.COURANT,    () => fetchDevisPeriode(c.env, debut12M, today)),
    fetchOrCache(KEY_DV_12M_N1, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debut24M, debut12M)),
    fetchOrCache(KEY_DV_12M_N2, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debut36M, debut24M)),
    fetchOrCache(KEY_DV_MOIS, TTL.COURANT, () => fetchDevisPeriode(c.env, debutMois, finMois)),
    fetchOrCache(KEY_DV_MOIS_N1, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debutMoisN1, finMoisN1)),
    fetchOrCache(KEY_DV_MOIS_N2, TTL.HISTORIQUE, () => fetchDevisPeriode(c.env, debutMoisN2, finMoisN2)),
  ])

  const opsMois   = rMois.opportunities.edges.map((e: any) => e.node)
  const opsPrios  = rPrios.opportunities.edges.map((e: any) => e.node)
  const companies = rPortefeuille.companies.edges.map((e: any) => e.node)
  const opsTop    = rTop.opportunities.edges.map((e: any) => e.node)

  // ── KPIs ───────────────────────────────────────────────────
  const gagnes    = opsMois.filter((o: any) => o.statutDevis === 'GAGNE')
  const perdus    = opsMois.filter((o: any) => o.statutDevis === 'PERDU')
  const enAttente = opsMois.filter((o: any) => o.statutDevis === 'EN_ATTENTE')
  const potentiel = enAttente.reduce((s: number, o: any) => s + toEuros(o.amount?.amountMicros), 0)
  const tx = gagnes.length + perdus.length > 0
    ? Math.round(gagnes.length / (gagnes.length + perdus.length) * 100)
    : 0

  const enRetardCount   = opsPrios.filter((o: any) => joursRetard(o.dateRelance) < 0).length
  const aujourdhuiCount = opsPrios.filter((o: any) => joursRetard(o.dateRelance) === 0).length

  // ── Pipeline ───────────────────────────────────────────────
  const pipeline = PIPELINE_ORDER.map(({ stage, label }) => {
    const cols = opsMois.filter((o: any) => o.stage === stage && o.statutDevis !== 'PERDU')
    return {
      stage, label,
      count: cols.length,
      totalMontant: cols.reduce((s: number, o: any) => s + toEuros(o.amount?.amountMicros), 0),
      cards: cols.slice(0, 10).map((o: any) => ({
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

  // ── Prios ──────────────────────────────────────────────────
  const toPrioCard = (o: any) => ({
    id: o.id,
    companyName: o.company?.name ?? '—',
    departement: getDept(o.company),
    montant: toEuros(o.amount?.amountMicros),
    prestations: Array.isArray(o.prestation) ? o.prestation : [],
    dateRelance: o.dateRelance,
    joursRetard: joursRetard(o.dateRelance),
  })

  const gagnesSemaine = opsMois
    .filter((o: any) => o.statutDevis === 'GAGNE' && isThisWeek(o.dateDevis))
    .map((o: any) => ({
      id: o.id,
      companyName: o.company?.name ?? '—',
      departement: getDept(o.company),
      montant: toEuros(o.amount?.amountMicros),
      prestations: Array.isArray(o.prestation) ? o.prestation : [],
      dateRelance: o.dateDevis,
      joursRetard: 0,
    }))

  const prios = {
    enRetard:       opsPrios.filter((o: any) => joursRetard(o.dateRelance) < 0).map(toPrioCard),
    aujourdhui:     opsPrios.filter((o: any) => joursRetard(o.dateRelance) === 0).map(toPrioCard),
    realiseSemaine: gagnesSemaine,
    resteSemaine:   opsPrios.filter((o: any) => joursRetard(o.dateRelance) > 0).map(toPrioCard),
  }

  // ── Portefeuille ───────────────────────────────────────────
  const actifs    = companies.filter((c: any) => c.statutClient === 'CLIENT_ACTIF')
  const prospects = companies.filter((c: any) => c.statutClient === 'PROSPECT')
  const inactifs  = companies.filter((c: any) => c.statutClient === 'CLIENT_INACTIF')

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

  const deptMap: Record<string, { count: number; ca: number }> = {}
  opsTop.forEach((o: any) => {
    const dept = getDept(o.company)
    if (dept === '—') return
    if (!deptMap[dept]) deptMap[dept] = { count: 0, ca: 0 }
    deptMap[dept].count++
    deptMap[dept].ca += toEuros(o.amount?.amountMicros)
  })
  actifs.forEach((c: any) => {
    const dept = getDept(c)
    if (dept === '—') return
    if (!deptMap[dept]) deptMap[dept] = { count: 0, ca: 0 }
    deptMap[dept].count++
  })
  const topDepartements = Object.entries(deptMap)
    .map(([dept, v]) => ({ dept, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const clientMap: Record<string, { id: string; name: string; type: string; ca: number }> = {}
  opsTop.forEach((o: any) => {
    const co = o.company
    if (!co) return
    if (!clientMap[co.id]) clientMap[co.id] = { id: co.id, name: co.name, type: co.typeClient ?? 'AUTRE', ca: 0 }
    clientMap[co.id].ca += toEuros(o.amount?.amountMicros)
  })
  const topClients = Object.values(clientMap).sort((a, b) => b.ca - a.ca).slice(0, 5)

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
      ca: {
        dda: {
          valeur: ddaN, n1: ddaN1, n2: ddaN2,
          deltaN1Pct: delta(ddaN, ddaN1),
          deltaN2Pct: delta(ddaN, ddaN2),
          nbDevis: dvDDA.nb, montantDevis: dvDDA.montant,
          deltaNbDevisN1Pct: delta(dvDDA.nb, dvDDA_N1.nb),
          deltaNbDevisN2Pct: delta(dvDDA.nb, dvDDA_N2.nb),
          deltaMontantDevisN1Pct: delta(dvDDA.montant, dvDDA_N1.montant),
          deltaMontantDevisN2Pct: delta(dvDDA.montant, dvDDA_N2.montant),
        },
        glissant12M: {
          valeur: m12N, n1: m12N1, n2: m12N2,
          deltaN1Pct: delta(m12N, m12N1),
          deltaN2Pct: delta(m12N, m12N2),
          nbDevis: dv12M.nb, montantDevis: dv12M.montant,
          deltaNbDevisN1Pct: delta(dv12M.nb, dv12M_N1.nb),
          deltaNbDevisN2Pct: delta(dv12M.nb, dv12M_N2.nb),
          deltaMontantDevisN1Pct: delta(dv12M.montant, dv12M_N1.montant),
          deltaMontantDevisN2Pct: delta(dv12M.montant, dv12M_N2.montant),
        },
        moisCourant: {
          valeur: moisN, nomMois: nomMois(today), n1: moisN1, n2: moisN2,
          deltaN1Pct: delta(moisN, moisN1),
          deltaN2Pct: delta(moisN, moisN2),
          nbDevis: dvMois.nb, montantDevis: dvMois.montant,
          deltaNbDevisN1Pct: delta(dvMois.nb, dvMois_N1.nb),
          deltaNbDevisN2Pct: delta(dvMois.nb, dvMois_N2.nb),
          deltaMontantDevisN1Pct: delta(dvMois.montant, dvMois_N1.montant),
          deltaMontantDevisN2Pct: delta(dvMois.montant, dvMois_N2.montant),
        },
      },
      devisEnAttente: enAttente.length,
      potentielEnAttente: potentiel,
      devisEnRetard: enRetardCount,
      devisARelancerAujourdhui: aujourdhuiCount,
      tauxTransformation: tx,
      tauxTransformationN1: txN1,
      tauxTransformationN2: txN2,
      facturesAEnvoyer: 0,
      montantFacturesAEnvoyer: 0,
      facturesImpayees: 0,
      montantFacturesImpayees: 0,
      deplacementsAPlanifier: 0,
    },
    pipeline,
    prios,
    portefeuille: {
      totalActifs: actifs.length,
      totalProspects: prospects.length,
      totalInactifs: inactifs.length,
      parType: byType,
      parPrestation,
      topDepartements,
      topClients,
    },
  })
})

// DELETE /api/stats/cache
app.delete('/cache', async (c) => {
  cache.clear()
  return c.json({ cleared: true, timestamp: new Date().toISOString() })
})

export { app as statsRoutes };
