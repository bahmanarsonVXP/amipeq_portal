'use client'

import { useState, useEffect, type ReactElement } from 'react'
import type { DashboardKpis, CaData, CaPeriode } from '@/types'
import { apiFetch } from '@/lib/api'

interface KpiStripProps {
  kpis: DashboardKpis | null
  loading: boolean
}

// ── Helpers ────────────────────────────────────────────────────

/** Montant en milliers d'euros, ex. 358,2 K€ */
function keuros(v: number): string {
  const k = v / 1000
  const n = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(k)
  return `${n}\u00a0K€`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function yearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

function DeltaPair({ n1, n2 }: { n1: number | null | undefined; n2: number | null | undefined }) {
  const a = n1 ?? null
  const b = n2 ?? null
  if (a === null && b === null) {
    return <span className="text-gray-300 text-xs">—</span>
  }
  const seg = (pct: number | null) => {
    if (pct === null) return <span className="text-gray-300">—</span>
    const up = pct >= 0
    return (
      <span className={up ? 'text-green-600' : 'text-red-500'}>
        {up ? '+' : ''}{pct}%
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold whitespace-nowrap">
      {seg(a)}
      <span className="text-gray-400 mx-0.5">/</span>
      {seg(b)}
    </span>
  )
}

// ── Skeleton ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="h-6 w-40 ml-auto bg-gray-100 rounded animate-pulse" />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

// ── Colonnes CA / Devis (3 périodes) ───────────────────────────

const caColKeys: { key: keyof CaData; label: (dda: string, mois: string) => string }[] = [
  { key: 'dda', label: dda => dda },
  { key: 'glissant12M', label: () => '12M glissants' },
  { key: 'moisCourant', label: (_, mois) => mois },
]

function CaMatriceGrid({
  ca,
  ddaLabel,
  moisLabel,
  children,
}: {
  ca: CaData
  ddaLabel: string
  moisLabel: string
  children: (ctx: {
    cols: { key: keyof CaData; label: string }[]
    period: (key: keyof CaData) => CaPeriode
  }) => ReactElement
}) {
  const cols = caColKeys.map(({ key, label }) => ({
    key,
    label: label(ddaLabel, moisLabel),
  }))
  const period = (key: keyof CaData) => ca[key]
  return <>{children({ cols, period })}</>
}

function SharedCaDateBar({
  loading,
  selectedDate,
  onDateChange,
}: {
  loading: boolean
  selectedDate: string
  onDateChange: (d: string) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1.5 mb-0.5">
      {loading && (
        <span className="w-3 h-3 border border-gray-300 border-t-yellow-500 rounded-full animate-spin flex-shrink-0" />
      )}
      <input
        type="date"
        value={selectedDate}
        min={yearStart()}
        max={todayStr()}
        onChange={e => onDateChange(e.target.value)}
        className="text-xs text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-400 bg-white"
      />
    </div>
  )
}

function CaCard({ ca, ddaLabel, moisLabel }: { ca: CaData; ddaLabel: string; moisLabel: string }) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-white border border-gray-200 rounded-xl px-4 py-3"
      style={{ borderTopWidth: 3, borderTopColor: '#f8b829' }}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Chiffre d&apos;affaires
      </p>
      <CaMatriceGrid ca={ca} ddaLabel={ddaLabel} moisLabel={moisLabel}>
        {({ cols, period }) => (
          <div className="grid" style={{ gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '0 8px' }}>
            <div />
            {cols.map(({ key, label }) => (
              <div key={key} className="text-center pb-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 truncate block">{label}</span>
              </div>
            ))}
            <div className="pt-2.5 pr-3">
              <span className="text-xs text-gray-400 whitespace-nowrap">CA gagné</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-2.5 text-center">
                  <span className="text-sm font-bold text-gray-900">{keuros(p.valeur)}</span>
                </div>
              )
            })}
            <div className="pt-1 pr-3 pb-2.5">
              <span className="text-xs text-gray-300 whitespace-nowrap">vs N-1 / N-2</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-1 pb-2.5 text-center">
                  <DeltaPair n1={p.deltaN1Pct} n2={p.deltaN2Pct} />
                </div>
              )
            })}
          </div>
        )}
      </CaMatriceGrid>
    </div>
  )
}

function DevisProductionCard({ ca, ddaLabel, moisLabel }: { ca: CaData; ddaLabel: string; moisLabel: string }) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-white border border-gray-200 rounded-xl px-4 py-3"
      style={{ borderTopWidth: 3, borderTopColor: '#94a3b8' }}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Production de devis
      </p>
      <CaMatriceGrid ca={ca} ddaLabel={ddaLabel} moisLabel={moisLabel}>
        {({ cols, period }) => (
          <div className="grid" style={{ gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '0 8px' }}>
            <div />
            {cols.map(({ key, label }) => (
              <div key={key} className="text-center pb-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 truncate block">{label}</span>
              </div>
            ))}
            <div className="pt-2.5 pr-3">
              <span className="text-xs text-gray-400 whitespace-nowrap">Nb devis</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-2.5 text-center">
                  <span className="text-sm font-bold text-gray-700">{p.nbDevis}</span>
                </div>
              )
            })}
            <div className="pt-1 pr-3">
              <span className="text-xs text-gray-300 whitespace-nowrap">vs N-1 / N-2</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-1 text-center">
                  <DeltaPair n1={p.deltaNbDevisN1Pct} n2={p.deltaNbDevisN2Pct} />
                </div>
              )
            })}
            <div className="pt-2.5 pr-3 border-t border-gray-100">
              <span className="text-xs text-gray-400 whitespace-nowrap">Montant</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-2.5 text-center border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">{keuros(p.montantDevis)}</span>
                </div>
              )
            })}
            <div className="pt-1 pr-3 pb-2.5">
              <span className="text-xs text-gray-300 whitespace-nowrap">vs N-1 / N-2</span>
            </div>
            {cols.map(({ key }) => {
              const p = period(key)
              return (
                <div key={key} className="pt-1 pb-2.5 text-center">
                  <DeltaPair n1={p.deltaMontantDevisN1Pct} n2={p.deltaMontantDevisN2Pct} />
                </div>
              )
            })}
          </div>
        )}
      </CaMatriceGrid>
    </div>
  )
}

function CaDevisSection({
  ca,
  ddaLabel,
  moisLabel,
  loading,
  selectedDate,
  onDateChange,
}: {
  ca: CaData
  ddaLabel: string
  moisLabel: string
  loading: boolean
  selectedDate: string
  onDateChange: (d: string) => void
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <SharedCaDateBar
        loading={loading}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
      />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:items-stretch">
        <CaCard ca={ca} ddaLabel={ddaLabel} moisLabel={moisLabel} />
        <DevisProductionCard ca={ca} ddaLabel={ddaLabel} moisLabel={moisLabel} />
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────

export function KpiStrip({ kpis, loading }: KpiStripProps) {
  const [selectedDate, setSelectedDate] = useState<string>(todayStr())
  const [caData, setCaData] = useState<CaData | null>(null)
  const [caLoading, setCaLoading] = useState(false)

  useEffect(() => {
    if (kpis?.ca) setCaData(kpis.ca)
  }, [kpis])

  useEffect(() => {
    if (!kpis) return
    if (selectedDate === todayStr()) return

    setCaLoading(true)
    apiFetch<CaData>(`/api/stats/ca?date=${selectedDate}`)
      .then(data => setCaData(data))
      .catch(() => {})
      .finally(() => setCaLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  if (loading) return <Skeleton />
  if (!kpis) return null

  const ca = caData ?? kpis.ca

  const dateObj   = new Date(selectedDate + 'T00:00:00')
  const annee     = dateObj.getFullYear()
  const ddaLabel  = `DDA ${annee}`
  const moisLabel = ca.moisCourant.nomMois ??
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(dateObj)
      .replace(/^./, c => c.toUpperCase())

  return (
    <CaDevisSection
      ca={ca}
      ddaLabel={ddaLabel}
      moisLabel={moisLabel}
      loading={caLoading}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
    />
  )
}
