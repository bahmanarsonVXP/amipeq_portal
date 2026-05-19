'use client'

export function RealisationsPanel() {
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const offset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const events: Record<number, 'scolaire' | 'mairie'> = {
    8: 'scolaire', 11: 'mairie', 14: 'scolaire', 16: 'mairie', 22: 'scolaire',
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>

        <h2 className="text-base font-bold text-gray-600 mb-2">
          Réalisations — Planning terrain
        </h2>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          Section en cours de développement.<br/>
          Gestion des interventions, déplacements et facturation
          après acceptation du devis.
        </p>

        <div className="bg-white border border-gray-200 rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now)}
          </p>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const event = events[day]
              const isToday = day === today
              return (
                <div
                  key={day}
                  className={[
                    'h-9 rounded-lg flex items-center justify-center text-sm font-medium',
                    isToday
                      ? 'bg-yellow-400 text-gray-900'
                      : event === 'scolaire'
                      ? 'bg-blue-100 text-blue-900'
                      : event === 'mairie'
                      ? 'bg-green-100 text-green-900'
                      : 'bg-gray-50 text-gray-500',
                  ].join(' ')}
                >
                  {day}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-center gap-6 mt-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-blue-100 inline-block" />
            Intervention scolaire
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-green-100 inline-block" />
            Intervention mairie
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-yellow-400 inline-block" />
            Aujourd'hui
          </span>
        </div>
      </div>
    </div>
  )
}
