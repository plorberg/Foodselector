import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { restaurantsApi } from '../lib/restaurants'
import type { Restaurant } from '../types/restaurant'

export function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [hideBlacklisted, setHideBlacklisted] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await restaurantsApi.list({
        search: search || undefined,
        favorite: favoriteOnly ? true : undefined,
      })
      setRestaurants(hideBlacklisted ? data.filter((r) => !r.blacklisted) : data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteOnly, hideBlacklisted])

  async function toggleFavorite(r: Restaurant) {
    const updated = await restaurantsApi.setFavorite(r.id, !r.favorite)
    setRestaurants((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
  }

  async function toggleBlacklist(r: Restaurant) {
    const updated = await restaurantsApi.setBlacklisted(r.id, !r.blacklisted)
    setRestaurants((prev) =>
      hideBlacklisted && updated.blacklisted
        ? prev.filter((x) => x.id !== r.id)
        : prev.map((x) => (x.id === r.id ? updated : x))
    )
  }

  async function markVisit(r: Restaurant) {
    await restaurantsApi.markVisit(r.id, {})
    load()
  }

  async function remove(r: Restaurant) {
    if (!confirm(`"${r.name}" wirklich löschen?`)) return
    await restaurantsApi.remove(r.id)
    setRestaurants((prev) => prev.filter((x) => x.id !== r.id))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Restaurants</h1>
        <Link
          to="/restaurants/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Neues Restaurant
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
        className="mb-4 flex flex-wrap items-center gap-3"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name…"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          Suchen
        </button>
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
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Lädt…</p>
      ) : restaurants.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Restaurants gefunden.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {restaurants.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <Link to={`/restaurants/${r.id}`} className="font-medium text-slate-900 hover:underline">
                  {r.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-500">
                  {r.city && <span>{r.city}</span>}
                  {r.categories.map((c) => (
                    <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5">
                      {c}
                    </span>
                  ))}
                  {r.priceLevel && <span>{'€'.repeat(r.priceLevel)}</span>}
                  {r.personalRating != null && <span>★ {r.personalRating}</span>}
                  {r.blacklisted && <span className="text-red-600">Blacklist</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => toggleFavorite(r)}
                  title="Favorit"
                  className={r.favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}
                >
                  ★
                </button>
                <button
                  onClick={() => markVisit(r)}
                  className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
                >
                  Besuch
                </button>
                <button
                  onClick={() => toggleBlacklist(r)}
                  className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
                >
                  {r.blacklisted ? 'Entsperren' : 'Blacklist'}
                </button>
                <button
                  onClick={() => remove(r)}
                  className="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
