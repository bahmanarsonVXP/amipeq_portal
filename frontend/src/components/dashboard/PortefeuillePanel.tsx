'use client'

import type { PortefeuilleData } from '@/types'
import { formatEuros } from '@/lib/utils'

interface PortefeuillePanelProps {
  data: PortefeuilleData
  loading: boolean
}

function Bar({ label, count, max, color, bg }: {
  label: string; count: number; max: number; color: string; bg: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-gray-600 font-medium w-20 text-right flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
        <div
          className="h-full rounded flex items-center px-2"
          style={{ width: `${pct}%`, background: bg }}
        >
          {pct > 15 && (
            <span className="text-xs font-semibold" style={{ color }}>{pct} %</span>
          )}
        </div>
      </div>
      <span className="text-xs text-gray-400 w-10 flex-shrink-0">{count}</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-64 bg-gray-50 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

export function PortefeuillePanel({ data, loading }: PortefeuillePanelProps) {
  if (loading) return <Skeleton />

  const typeMax = Math.max(...data.parType.map(t => t.count), 1)
  const prestMax = Math.max(...data.parPrestation.map(p => p.count), 1)
  const deptMax = data.topDepartements[0]?.count ?? 1

  const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
    ETABLISSEMENT_SCOLAIRE: { color: '#1e40af', bg: '#bfdbfe' },
    MAIRIE_COLLECTIVITE:    { color: '#15803d', bg: '#bbf7d0' },
    ENTREPRISE_TPE_PME:     { color: '#6d28d9', bg: '#ede9fe' },
    AUTRE:                  { color: '#6b7280', bg: '#f3f4f6' },
  }

  const PREST_COLORS: Record<string, { color: string; bg: string }> = {
    DUERP: { color: '#713f12', bg: '#fef9c3' },
    PPMS:  { color: '#1e3a8a', bg: '#dbeafe' },
    RPS:   { color: '#14532d', bg: '#dcfce7' },
    PSE:   { color: '#831843', bg: '#fce7f3' },
    AUTRE: { color: '#4b5563', bg: '#f3f4f6' },
  }

  const TYPE_LABELS: Record<string, string> = {
    ETABLISSEMENT_SCOLAIRE: 'Scolaire',
    MAIRIE_COLLECTIVITE:    'Mairie',
    ENTREPRISE_TPE_PME:     'Entreprise',
    AUTRE:                  'Autre',
  }

  const TYPE_PILL: Record<string, { bg: string; color: string; label: string }> = {
    ETABLISSEMENT_SCOLAIRE: { bg: '#dbeafe', color: '#1e3a8a', label: 'Scolaire' },
    MAIRIE_COLLECTIVITE:    { bg: '#dcfce7', color: '#15803d', label: 'Mairie' },
    ENTREPRISE_TPE_PME:     { bg: '#ede9fe', color: '#5b21b6', label: 'Entreprise' },
    AUTRE:                  { bg: '#f3f4f6', color: '#4b5563', label: 'Autre' },
  }

  return (
    <div className="flex flex-col gap-4">

      {/* KPIs synthèse */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Clients actifs',   value: data.totalActifs,    color: '#15803d' },
          { label: 'Prospects',         value: data.totalProspects, color: '#b45309' },
          { label: 'Clients inactifs',  value: data.totalInactifs,  color: '#6b7280' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value.toLocaleString('fr-FR')}</p>
          </div>
        ))}
      </div>

      {/* Grille 2 colonnes */}
      <div className="grid grid-cols-2 gap-4">

        {/* Répartition par type */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Répartition par type de client</p>
          <p className="text-xs text-gray-400 mb-4">Clients actifs uniquement</p>
          {data.parType.map(({ type, label, count }) => {
            const style = TYPE_COLORS[type] ?? TYPE_COLORS.AUTRE
            return (
              <Bar
                key={type}
                label={label ?? TYPE_LABELS[type] ?? type}
                count={count}
                max={typeMax}
                color={style.color}
                bg={style.bg}
              />
            )
          })}
        </div>

        {/* Mix prestations */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Mix prestations</p>
          <p className="text-xs text-gray-400 mb-4">Devis gagnés — mois courant</p>
          {data.parPrestation.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-6">Aucune donnée ce mois</p>
          ) : data.parPrestation.map(({ prestation, count }) => {
            const style = PREST_COLORS[prestation] ?? PREST_COLORS.AUTRE
            return (
              <Bar
                key={prestation}
                label={prestation}
                count={count}
                max={prestMax}
                color={style.color}
                bg={style.bg}
              />
            )
          })}
        </div>

        {/* Top départements */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Top départements</p>
          <p className="text-xs text-gray-400 mb-4">
            Par nombre de clients actifs · {data.topDepartements.length} depts couverts
          </p>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase w-16">Dept.</th>
                <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase">Clients</th>
                <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase">CA {new Date().getFullYear()}</th>
              </tr>
            </thead>
            <tbody>
              {data.topDepartements.map(({ dept, count, ca }) => (
                <tr key={dept} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-bold text-gray-900">{dept}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex-1 max-w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{ width: `${Math.round(count / deptMax * 100)}%` }}
                        />
                      </div>
                      <span className="font-semibold text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-medium text-gray-700">
                    {ca > 0 ? formatEuros(ca) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 5 clients */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Top 5 clients</p>
          <p className="text-xs text-gray-400 mb-4">Par CA gagné — année courante</p>

          {data.topClients.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-8">Aucune donnée</p>
          ) : (
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase w-6">#</th>
                  <th className="text-left pb-2 text-xs font-semibold text-gray-400 uppercase">Client</th>
                  <th className="text-right pb-2 text-xs font-semibold text-gray-400 uppercase">CA</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((client, i) => {
                  const pill = TYPE_PILL[client.type] ?? TYPE_PILL.AUTRE
                  return (
                    <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-gray-400 font-medium">{i + 1}</td>
                      <td className="py-2">
                        <p className="font-medium text-gray-900 truncate text-xs">{client.name}</p>
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: pill.bg, color: pill.color }}
                        >
                          {pill.label}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold text-gray-900">
                        {formatEuros(client.ca)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
