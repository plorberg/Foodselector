import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DecisionRoundCard } from '../components/DecisionRoundCard'
import { restaurantsApi } from '../lib/restaurants'
import {
  decideApi,
  decisionRoundsApi,
  localNow,
  type DecisionRound,
  type ScoredRestaurant,
} from '../lib/decide'
import type { Restaurant } from '../types/restaurant'
import { useAuth } from '../lib/AuthContext'

// Captured once per page load — render must not call Date.now() directly.
const PAGE_LOADED_AT = Date.now()

export function Dashboard() {
  const { activeWorkspace } = useAuth()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [suggestion, setSuggestion] = useState<ScoredRestaurant | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState<DecisionRound | null>(null)

  // Re-fetch when the user switches groups in the header. Deferred so the
  // effect body itself performs no synchronous setState.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setSuggestion(null)
      setError(null)
      restaurantsApi.list().then(setRestaurants).catch(() => {})
      decisionRoundsApi.current().then(setRound).catch(() => {})
    })
  }, [activeWorkspace?.id])

  async function quickDecide() {
    setLoading(true)
    setError(null)
    try {
      // "Schnellvorschlag" means right now — skip restaurants known to be closed.
      const res = await decideApi.decide({ mode: 'balanced', openNow: true, now: localNow() })
      setSuggestion(res.suggestion)
      if (!res.suggestion) {
        setError('Kein passendes Restaurant gefunden — Filter auf der Entscheiden-Seite lockern.')
      }
    } catch {
      setError('Vorschlag konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  const active = restaurants.filter((r) => !r.blacklisted)

  const recentlyVisited = [...active]
    .filter((r) => r.lastVisitedAt)
    .sort((a, b) => (b.lastVisitedAt ?? '').localeCompare(a.lastVisitedAt ?? ''))
    .slice(0, 5)

  const categoryCounts = active.reduce<Record<string, number>>((acc, r) => {
    for (const c of r.categories) acc[c] = (acc[c] ?? 0) + 1
    return acc
  }, {})

  const stats = {
    total: active.length,
    neu: active.filter((r) => r.classification === 'NEW').length,
    empfehlung: active.filter((r) => r.classification === 'RECOMMENDATION').length,
    favoriten: active.filter((r) => r.favorite).length,
  }

  // "Long time no visit": never visited, or last visit > 60 days ago.
  const sixtyDaysAgo = PAGE_LOADED_AT - 60 * 24 * 60 * 60 * 1000
  const longTimeNoVisit = active
    .filter((r) => !r.lastVisitedAt || new Date(r.lastVisitedAt).getTime() < sixtyDaysAgo)
    .sort((a, b) => (a.lastVisitedAt ?? '').localeCompare(b.lastVisitedAt ?? ''))
    .slice(0, 5)

  if (restaurants.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-4xl">🍽️</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">
            Willkommen beim Food Selector!
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Füge deine ersten Restaurants hinzu — am schnellsten geht's, indem du einen
            Google-Maps-Link oder Text über die Analyse einliest. Danach schlägt dir der
            Foodselector vor, wo es hingeht.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
            <Link
              to="/analyze"
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-dark"
            >
              Restaurant analysieren
            </Link>
            <Link
              to="/restaurants/new"
              className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100"
            >
              Manuell anlegen
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {round && round.status === 'OPEN' && <DecisionRoundCard round={round} onUpdate={setRound} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Restaurants" value={stats.total} />
        <StatCard label="Neu" value={stats.neu} accent="text-blue-700" />
        <StatCard label="Empfehlung" value={stats.empfehlung} accent="text-green-700" />
        <StatCard label="Favoriten" value={stats.favoriten} accent="text-amber-500" />
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Entscheide für mich</h2>
            <p className="text-sm text-slate-500">
              {restaurants.length} Restaurant(s) in der Datenbank.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={quickDecide}
              disabled={loading}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {loading ? 'Wählt…' : suggestion ? '🎲 Neu würfeln' : '🎲 Schnellvorschlag'}
            </button>
            <Link
              to="/decide"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Mehr Optionen
            </Link>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {suggestion && (
          <div className="animate-reveal mt-4 rounded-md border border-accent/40 bg-accent/5 p-3">
            <Link
              to={`/restaurants/${suggestion.restaurant.id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {suggestion.restaurant.name}
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              {suggestion.reasons.join(' · ') || 'Vorschlag generiert.'}
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Zuletzt besucht</h2>
          {recentlyVisited.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Besuche.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentlyVisited.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <Link to={`/restaurants/${r.id}`} className="text-slate-700 hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {r.lastVisitedAt ? new Date(r.lastVisitedAt).toLocaleDateString('de-DE') : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Lange nicht besucht</h2>
          {longTimeNoVisit.length === 0 ? (
            <p className="text-sm text-slate-500">Alles frisch besucht. 🎉</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {longTimeNoVisit.map((r) => (
                <li key={r.id} className="flex justify-between">
                  <Link to={`/restaurants/${r.id}`} className="text-slate-700 hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {r.lastVisitedAt
                      ? new Date(r.lastVisitedAt).toLocaleDateString('de-DE')
                      : 'nie'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Kategorien</h2>
        {Object.keys(categoryCounts).length === 0 ? (
          <p className="text-sm text-slate-500">Keine Kategorien.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <span key={cat} className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-700">
                  {cat} <span className="text-slate-400">{count}</span>
                </span>
              ))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Schnellzugriff</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/analyze" className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
            Restaurant analysieren
          </Link>
          <Link
            to="/restaurants/new"
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
          >
            Restaurant hinzufügen
          </Link>
          <Link
            to="/restaurants"
            className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
          >
            Alle Restaurants
          </Link>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className={`text-2xl font-semibold ${accent ?? 'text-slate-900'}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
