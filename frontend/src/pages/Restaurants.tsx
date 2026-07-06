import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StarRating } from '../components/StarRating'
import { VisitDialog } from '../components/VisitDialog'
import { restaurantsApi } from '../lib/restaurants'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import type { Restaurant } from '../types/restaurant'

export function Restaurants() {
  const toast = useToast()
  const { activeWorkspace } = useAuth()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [hideBlacklisted, setHideBlacklisted] = useState(true)
  const [classification, setClassification] = useState<'' | 'NEW' | 'RECOMMENDATION'>('')
  const [visitFor, setVisitFor] = useState<Restaurant | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function load(query = search) {
    setLoading(true)
    setError(null)
    try {
      const data = await restaurantsApi.list({
        search: query || undefined,
        favorite: favoriteOnly ? true : undefined,
        classification: classification || undefined,
      })
      setRestaurants(hideBlacklisted ? data.filter((r) => !r.blacklisted) : data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Deferred so the effect body itself performs no synchronous setState.
    void Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteOnly, hideBlacklisted, classification, activeWorkspace?.id])

  // Debounced live search — no submit button needed.
  function onSearchChange(value: string) {
    setSearch(value)
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => load(value), 300)
  }

  async function toggleFavorite(r: Restaurant) {
    const updated = await restaurantsApi.setFavorite(r.id, !r.favorite)
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
    toast(updated.favorite ? `${r.name} ist jetzt Favorit ★` : `${r.name} ist kein Favorit mehr.`)
  }

  async function toggleBlacklist(r: Restaurant) {
    const updated = await restaurantsApi.setBlacklisted(r.id, !r.blacklisted)
    setRestaurants((prev) =>
      hideBlacklisted && updated.blacklisted
        ? prev.filter((x) => x.id !== r.id)
        : prev.map((x) => (x.id === r.id ? updated : x))
    )
    if (updated.blacklisted) {
      toast(`${r.name} auf die Blacklist gesetzt.`, {
        undo: async () => {
          const restored = await restaurantsApi.setBlacklisted(r.id, false)
          setRestaurants((prev) => {
            const exists = prev.some((x) => x.id === r.id)
            return exists ? prev.map((x) => (x.id === r.id ? restored : x)) : [...prev, restored]
          })
        },
      })
    } else {
      toast(`${r.name} von der Blacklist entfernt.`)
    }
  }

  async function remove(r: Restaurant) {
    if (!confirm(`"${r.name}" wirklich löschen?`)) return
    await restaurantsApi.remove(r.id)
    setRestaurants((prev) => prev.filter((x) => x.id !== r.id))
    toast(`${r.name} gelöscht.`)
  }

  type Action = { label: string; onClick?: () => void; to?: string; danger?: boolean }
  function actions(r: Restaurant): Action[] {
    return [
      { label: 'Besuch eintragen', onClick: () => setVisitFor(r) },
      { label: r.blacklisted ? 'Entsperren' : 'Blacklist', onClick: () => toggleBlacklist(r) },
      { label: 'Bearbeiten', to: `/restaurants/${r.id}/edit` },
      { label: 'Löschen', onClick: () => remove(r), danger: true },
    ]
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Restaurants</h1>
        <Link
          to="/restaurants/new"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-dark"
        >
          + Neues Restaurant
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Suche nach Name…"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => setFavoriteOnly(e.target.checked)}
          />
          nur Favoriten
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={hideBlacklisted}
            onChange={(e) => setHideBlacklisted(e.target.checked)}
          />
          Blacklist ausblenden
        </label>
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value as '' | 'NEW' | 'RECOMMENDATION')}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600"
        >
          <option value="">Alle Klassifizierungen</option>
          <option value="NEW">Neu</option>
          <option value="RECOMMENDATION">Empfehlung</option>
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Lädt…</p>
      ) : restaurants.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Restaurants gefunden.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {restaurants.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggleFavorite(r)}
                title="Favorit"
                className={`shrink-0 text-lg ${
                  r.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
                }`}
              >
                ★
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/restaurants/${r.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {r.name}
                  </Link>
                  <StarRating value={r.personalRating} size="text-xs" />
                </div>
                {r.address && <div className="truncate text-xs text-slate-500">{r.address}</div>}
                <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-500">
                  {r.classification && (
                    <span
                      className={
                        r.classification === 'NEW'
                          ? 'rounded bg-blue-100 px-1.5 py-0.5 text-blue-700'
                          : 'rounded bg-green-100 px-1.5 py-0.5 text-green-700'
                      }
                    >
                      {r.classification === 'NEW' ? 'Neu' : 'Empfehlung'}
                    </span>
                  )}
                  {r.categories.map((c) => (
                    <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5">
                      {c}
                    </span>
                  ))}
                  {r.priceLevel && <span>{'€'.repeat(r.priceLevel)}</span>}
                  {r.blacklisted && <span className="text-red-600">Blacklist</span>}
                </div>
              </div>

              {/* Wide screens: inline actions. */}
              <div className="hidden shrink-0 items-center gap-2 text-sm sm:flex">
                {actions(r).map((a) =>
                  a.to ? (
                    <Link
                      key={a.label}
                      to={a.to}
                      className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className={
                        a.danger
                          ? 'rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50'
                          : 'rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100'
                      }
                    >
                      {a.label}
                    </button>
                  )
                )}
              </div>

              {/* Small screens: collapsed ⋯ menu. */}
              <div className="relative shrink-0 sm:hidden">
                <button
                  onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                  aria-label="Aktionen"
                  className="rounded-md border border-slate-300 px-2 py-1 text-slate-600"
                >
                  ⋯
                </button>
                {menuFor === r.id && (
                  <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {actions(r).map((a) =>
                      a.to ? (
                        <Link
                          key={a.label}
                          to={a.to}
                          className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuFor(null)}
                        >
                          {a.label}
                        </Link>
                      ) : (
                        <button
                          key={a.label}
                          onClick={() => {
                            setMenuFor(null)
                            a.onClick?.()
                          }}
                          className={`block w-full px-3 py-1.5 text-left hover:bg-slate-50 ${
                            a.danger ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {a.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {visitFor && (
        <VisitDialog
          restaurantId={visitFor.id}
          restaurantName={visitFor.name}
          onDone={() => {
            setVisitFor(null)
            toast('Besuch eingetragen.')
            load()
          }}
          onClose={() => setVisitFor(null)}
        />
      )}
    </div>
  )
}
