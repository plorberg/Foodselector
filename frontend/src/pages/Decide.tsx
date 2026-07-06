import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DecisionRoundCard } from '../components/DecisionRoundCard'
import { StarRating } from '../components/StarRating'
import { VisitDialog } from '../components/VisitDialog'
import {
  decideApi,
  decisionProfilesApi,
  decisionRoundsApi,
  localNow,
  type DecisionMode,
  type DecisionProfile,
  type DecisionResult,
  type DecisionRound,
  type ScoredRestaurant,
} from '../lib/decide'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'

const MODES: { key: DecisionMode; label: string }[] = [
  { key: 'balanced', label: 'Ausgewogen' },
  { key: 'cheap', label: 'Günstig' },
  { key: 'surprise', label: 'Überrasch mich' },
]

const CLASSIFICATIONS: { key: '' | 'NEW' | 'RECOMMENDATION'; label: string }[] = [
  { key: '', label: 'Alle' },
  { key: 'NEW', label: 'Neu' },
  { key: 'RECOMMENDATION', label: 'Empfehlung' },
]

const REVEAL_MS = 900

export function Decide() {
  const toast = useToast()
  const { activeWorkspace } = useAuth()
  const [mode, setMode] = useState<DecisionMode>('balanced')
  const [classification, setClassification] = useState<'' | 'NEW' | 'RECOMMENDATION'>('')
  const [preferFavorites, setPreferFavorites] = useState(false)
  const [openNow, setOpenNow] = useState(false)
  const [maxPriceLevel, setMaxPriceLevel] = useState('')
  const [repeatBlockDays, setRepeatBlockDays] = useState('14')
  const [result, setResult] = useState<DecisionResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [responded, setResponded] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<DecisionProfile[]>([])
  const [profileId, setProfileId] = useState('')
  const [round, setRound] = useState<DecisionRound | null>(null)
  const [visitFor, setVisitFor] = useState<ScoredRestaurant | null>(null)

  // Profiles and the open round are per group — refetch on group switch.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setProfileId('')
      setResult(null)
      decisionProfilesApi.list().then(setProfiles).catch(() => {})
      decisionRoundsApi.current().then(setRound).catch(() => {})
    })
  }, [activeWorkspace?.id])

  function currentFilters() {
    return {
      mode,
      classification: classification || undefined,
      preferFavorites,
      openNow,
      maxPriceLevel: maxPriceLevel ? Number(maxPriceLevel) : undefined,
    }
  }

  function applyProfile(id: string) {
    setProfileId(id)
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const f = p.filters
    if (f.mode) setMode(f.mode)
    setClassification((f.classification as '' | 'NEW' | 'RECOMMENDATION') ?? '')
    setPreferFavorites(Boolean(f.preferFavorites))
    setOpenNow(Boolean(f.openNow))
    setMaxPriceLevel(f.maxPriceLevel ? String(f.maxPriceLevel) : '')
    setRepeatBlockDays(String(p.repeatBlockDays))
  }

  async function saveProfile() {
    const name = window.prompt('Name für dieses Profil (z. B. „Freitagabend“):')
    if (!name?.trim()) return
    try {
      const created = await decisionProfilesApi.create({
        name: name.trim(),
        filters: currentFilters(),
        repeatBlockDays: repeatBlockDays ? Number(repeatBlockDays) : undefined,
      })
      setProfiles((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setProfileId(created.id)
      toast(`Profil „${created.name}“ gespeichert.`)
    } catch {
      toast('Profil konnte nicht gespeichert werden (Name schon vergeben?).')
    }
  }

  async function deleteProfile() {
    const p = profiles.find((x) => x.id === profileId)
    if (!p || !window.confirm(`Profil „${p.name}“ löschen?`)) return
    await decisionProfilesApi.remove(p.id)
    setProfiles((prev) => prev.filter((x) => x.id !== p.id))
    setProfileId('')
  }

  async function run() {
    setRolling(true)
    setError(null)
    setResponded(null)
    const started = Date.now()
    try {
      const res = await decideApi.decide({
        ...currentFilters(),
        now: openNow ? localNow() : undefined,
        repeatBlockDays: repeatBlockDays ? Number(repeatBlockDays) : undefined,
      })
      // Keep the roll animation on screen briefly — the reveal is the moment.
      const remaining = REVEAL_MS - (Date.now() - started)
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Entscheidung fehlgeschlagen.')
    } finally {
      setRolling(false)
    }
  }

  async function respond(accepted: boolean) {
    if (!result?.suggestion) return
    await decideApi.respond(result.suggestion.restaurant.id, mode, accepted)
    setResponded(accepted ? 'akzeptiert' : 'abgelehnt')
  }

  async function startVote() {
    if (!result?.suggestion) return
    const r = await decisionRoundsApi.start(result.suggestion.restaurant.id)
    setRound(r)
    toast('Abstimmung gestartet — deine Gruppe kann jetzt voten.')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Entscheide für mich</h1>

      {round && round.status === 'OPEN' && (
        <div className="mb-6">
          <DecisionRoundCard round={round} onUpdate={setRound} />
        </div>
      )}

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
        {profiles.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Profil
            </label>
            <select
              value={profileId}
              onChange={(e) => applyProfile(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">— kein Profil —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {profileId && (
              <button onClick={deleteProfile} className="text-xs text-red-600 hover:underline">
                löschen
              </button>
            )}
          </div>
        )}

        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Klassifizierung
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {CLASSIFICATIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => setClassification(c.key)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                classification === c.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Modus
        </div>
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
              checked={openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
            />
            nur jetzt geöffnete
          </label>
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={run}
            disabled={rolling}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {rolling ? 'Würfelt…' : '🎲 Vorschlag generieren'}
          </button>
          <button
            onClick={saveProfile}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
            title="Aktuelle Filter als Profil speichern"
          >
            Filter als Profil speichern
          </button>
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {rolling && (
        <div className="mb-6 flex flex-col items-center rounded-md border border-slate-200 bg-white p-10">
          <span className="animate-dice text-5xl">🎲</span>
          <p className="mt-3 text-sm text-slate-500">Der Foodselector überlegt…</p>
        </div>
      )}

      {!rolling && result && !result.suggestion && (
        <p className="text-sm text-slate-500">
          Kein passendes Restaurant gefunden ({result.excludedCount} ausgeschlossen). Filter lockern
          oder mehr Restaurants anlegen.
        </p>
      )}

      {!rolling && result?.suggestion && (
        <SuggestionCard
          scored={result.suggestion}
          responded={responded}
          onRespond={respond}
          onReroll={run}
          onVisit={setVisitFor}
          onStartVote={startVote}
        />
      )}

      {!rolling && result && result.alternatives.length > 0 && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Alternativen</h2>
          <div className="space-y-3">
            {result.alternatives.map((alt) => (
              <Suggestion key={alt.restaurant.id} scored={alt} />
            ))}
          </div>
        </section>
      )}

      {visitFor && (
        <VisitDialog
          restaurantId={visitFor.restaurant.id}
          restaurantName={visitFor.restaurant.name}
          onDone={() => {
            setVisitFor(null)
            toast('Besuch eingetragen. Guten Appetit! 🍽️')
          }}
          onClose={() => setVisitFor(null)}
        />
      )}
    </div>
  )
}

function mapsUrl(r: ScoredRestaurant['restaurant']): string {
  if (r.googleMapsLink) return r.googleMapsLink
  const query = encodeURIComponent([r.name, r.address].filter(Boolean).join(', '))
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function SuggestionCard({
  scored,
  responded,
  onRespond,
  onReroll,
  onVisit,
  onStartVote,
}: {
  scored: ScoredRestaurant
  responded: string | null
  onRespond: (accepted: boolean) => void
  onReroll: () => void
  onVisit: (scored: ScoredRestaurant) => void
  onStartVote: () => void
}) {
  return (
    <section className="animate-reveal mb-6 rounded-lg border-2 border-accent bg-white p-5 shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        🍽️ Heute geht's hierhin
      </p>
      <Suggestion scored={scored} highlight />
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={mapsUrl(scored.restaurant)}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          In Google Maps öffnen
        </a>
        <button
          onClick={() => onVisit(scored)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          Besuch eintragen
        </button>
        <button
          onClick={onStartVote}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          title="Gruppenmitglieder stimmen über den Vorschlag ab"
        >
          Zur Abstimmung stellen
        </button>
        <button
          onClick={onReroll}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          🎲 Neu würfeln
        </button>
      </div>
      {responded ? (
        <p className="mt-3 text-sm text-green-700">Vorschlag {responded}.</p>
      ) : (
        <div className="mt-3 flex gap-3 text-sm">
          <button onClick={() => onRespond(true)} className="text-green-700 hover:underline">
            Akzeptieren
          </button>
          <button onClick={() => onRespond(false)} className="text-slate-500 hover:underline">
            Ablehnen
          </button>
        </div>
      )}
    </section>
  )
}

function Suggestion({ scored, highlight }: { scored: ScoredRestaurant; highlight?: boolean }) {
  const r = scored.restaurant
  return (
    <div>
      <Link
        to={`/restaurants/${r.id}`}
        className={highlight ? 'text-2xl font-bold text-slate-900 hover:underline' : 'font-medium text-slate-800 hover:underline'}
      >
        {r.name}
      </Link>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {r.address && <span>{r.address}</span>}
        {r.classification && (
          <span className="text-slate-600">
            {r.classification === 'NEW' ? 'Neu' : 'Empfehlung'}
          </span>
        )}
        {r.categories.map((c) => (
          <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5">
            {c}
          </span>
        ))}
        {r.priceLevel && <span>{'€'.repeat(r.priceLevel)}</span>}
        <StarRating value={r.personalRating} size="text-xs" />
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
