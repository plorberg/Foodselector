import { useState } from 'react'
import { Link } from 'react-router-dom'
import { decideApi, type DecisionMode, type DecisionResult, type ScoredRestaurant } from '../lib/decide'

const MODES: { key: DecisionMode; label: string }[] = [
  { key: 'balanced', label: 'Ausgewogen' },
  { key: 'safe', label: 'Sicher' },
  { key: 'new', label: 'Neu' },
  { key: 'cheap', label: 'Günstig' },
  { key: 'near', label: 'Nah' },
  { key: 'group', label: 'Gruppe' },
  { key: 'date', label: 'Date' },
  { key: 'quick', label: 'Schnell' },
  { key: 'cozy', label: 'Gemütlich' },
  { key: 'surprise', label: 'Überrasch mich' },
]

export function Decide() {
  const [mode, setMode] = useState<DecisionMode>('balanced')
  const [preferFavorites, setPreferFavorites] = useState(false)
  const [maxPriceLevel, setMaxPriceLevel] = useState('')
  const [repeatBlockDays, setRepeatBlockDays] = useState('14')
  const [result, setResult] = useState<DecisionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [responded, setResponded] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setResponded(null)
    try {
      const res = await decideApi.decide({
        mode,
        preferFavorites,
        maxPriceLevel: maxPriceLevel ? Number(maxPriceLevel) : undefined,
        repeatBlockDays: repeatBlockDays ? Number(repeatBlockDays) : undefined,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Entscheidung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  async function respond(accepted: boolean) {
    if (!result?.suggestion) return
    await decideApi.respond(result.suggestion.restaurant.id, mode, accepted)
    setResponded(accepted ? 'akzeptiert' : 'abgelehnt')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Entscheide für mich</h1>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === m.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={preferFavorites}
              onChange={(e) => setPreferFavorites(e.target.checked)}
            />
            Favoriten bevorzugen
          </label>
          <label className="flex items-center gap-1.5">
            max. Preis
            <select
              value={maxPriceLevel}
              onChange={(e) => setMaxPriceLevel(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            >
              <option value="">egal</option>
              <option value="1">€</option>
              <option value="2">€€</option>
              <option value="3">€€€</option>
              <option value="4">€€€€</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Wiederholungssperre (Tage)
            <input
              type="number"
              min={0}
              value={repeatBlockDays}
              onChange={(e) => setRepeatBlockDays(e.target.value)}
              className="w-16 rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Wählt aus…' : 'Vorschlag generieren'}
        </button>
      </section>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {result && !result.suggestion && (
        <p className="text-sm text-slate-500">
          Kein passendes Restaurant gefunden ({result.excludedCount} ausgeschlossen). Filter lockern
          oder mehr Restaurants anlegen.
        </p>
      )}

      {result?.suggestion && (
        <section className="mb-6 rounded-md border-2 border-slate-900 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Hauptvorschlag</p>
          <Suggestion scored={result.suggestion} highlight />
          {responded ? (
            <p className="mt-3 text-sm text-green-700">Vorschlag {responded}.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => respond(true)}
                className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600"
              >
                Akzeptieren
              </button>
              <button
                onClick={() => respond(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Ablehnen
              </button>
              <button
                onClick={run}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Neu würfeln
              </button>
            </div>
          )}
        </section>
      )}

      {result && result.alternatives.length > 0 && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Alternativen</h2>
          <div className="space-y-3">
            {result.alternatives.map((alt) => (
              <Suggestion key={alt.restaurant.id} scored={alt} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Suggestion({ scored, highlight }: { scored: ScoredRestaurant; highlight?: boolean }) {
  const r = scored.restaurant
  return (
    <div>
      <Link
        to={`/restaurants/${r.id}`}
        className={highlight ? 'text-xl font-semibold text-slate-900 hover:underline' : 'font-medium text-slate-800 hover:underline'}
      >
        {r.name}
      </Link>
      <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-slate-500">
        {r.city && <span>{r.city}</span>}
        {r.categories.map((c) => (
          <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5">
            {c}
          </span>
        ))}
        {r.priceLevel && <span>{'€'.repeat(r.priceLevel)}</span>}
        {r.personalRating != null && <span>★ {r.personalRating}</span>}
        <span className="text-slate-400">Score {scored.score.toFixed(2)}</span>
      </div>
      {scored.reasons.length > 0 && (
        <ul className="mt-1 text-xs text-slate-500">
          {scored.reasons.map((reason, i) => (
            <li key={i}>• {reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
