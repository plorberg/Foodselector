import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { restaurantsApi } from '../lib/restaurants'
import type { RestaurantWithRelations } from '../types/restaurant'

function openingHoursLines(openingHours: unknown): string[] {
  if (!openingHours || typeof openingHours !== 'object') return []
  const oh = openingHours as Record<string, unknown>
  if (Array.isArray(oh.weekdayDescriptions)) return oh.weekdayDescriptions as string[]
  if (typeof oh.raw === 'string') return [oh.raw]
  // Fallback: a { Montag: "…", … } style object.
  return Object.entries(oh)
    .filter(([, v]) => typeof v === 'string')
    .map(([k, v]) => `${k}: ${v}`)
}

function googleMapsHref(r: RestaurantWithRelations): string | null {
  if (r.googleMapsLink) return r.googleMapsLink
  if (r.latitude != null && r.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`
  }
  if (r.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}`
  return null
}

function osmEmbedSrc(lat: number, lng: number): string {
  const d = 0.004
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

export function RestaurantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [r, setR] = useState<RestaurantWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      setR(await restaurantsApi.get(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Deferred so the effect body itself performs no synchronous setState.
    void Promise.resolve().then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="text-sm text-slate-500">Lädt…</p>
  if (error || !r) return <p className="text-sm text-red-600">{error ?? 'Nicht gefunden.'}</p>

  const hours = openingHoursLines(r.openingHours)
  const mapsHref = googleMapsHref(r)

  async function markVisit() {
    await restaurantsApi.markVisit(r!.id, {})
    load()
  }
  async function toggleFavorite() {
    await restaurantsApi.setFavorite(r!.id, !r!.favorite)
    load()
  }
  async function toggleBlacklist() {
    await restaurantsApi.setBlacklisted(r!.id, !r!.blacklisted)
    load()
  }
  async function remove() {
    if (!confirm(`"${r!.name}" wirklich löschen?`)) return
    await restaurantsApi.remove(r!.id)
    navigate('/restaurants')
  }

  return (
    <div className="max-w-3xl">
      <Link to="/restaurants" className="text-sm text-slate-500 hover:text-slate-900">
        ← Zurück zur Liste
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{r.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {r.classification && (
              <span
                className={
                  r.classification === 'NEW'
                    ? 'rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700'
                    : 'rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700'
                }
              >
                {r.classification === 'NEW' ? 'Neu' : 'Empfehlung'}
              </span>
            )}
            {r.favorite && <span className="text-amber-500">★ Favorit</span>}
            {r.blacklisted && <span className="text-red-600">Blacklist</span>}
            {r.priceLevel && <span>{'€'.repeat(r.priceLevel)}</span>}
            {r.personalRating != null && <span>Eigene ★ {r.personalRating}</span>}
            {r.externalRating != null && <span>Extern ★ {r.externalRating}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={markVisit} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100">
            Besuch
          </button>
          <button onClick={toggleFavorite} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100">
            {r.favorite ? 'Favorit entfernen' : 'Favorit'}
          </button>
          <button onClick={toggleBlacklist} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100">
            {r.blacklisted ? 'Entsperren' : 'Blacklist'}
          </button>
          <Link
            to={`/restaurants/${r.id}/edit`}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
          >
            Bearbeiten
          </Link>
          <button onClick={remove} className="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50">
            Löschen
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="space-y-3">
          <InfoRow label="Adresse" value={r.address} />
          {r.categories.length > 0 && <InfoRow label="Kategorien" value={r.categories.join(', ')} />}
          {r.tags.length > 0 && <InfoRow label="Tags" value={r.tags.join(', ')} />}
          {r.phone && (
            <InfoRow label="Telefon" value={<a href={`tel:${r.phone}`} className="text-blue-700 hover:underline">{r.phone}</a>} />
          )}
          {r.website && (
            <InfoRow
              label="Website"
              value={<a href={r.website} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{r.website}</a>}
            />
          )}
          {mapsHref && (
            <InfoRow
              label="Karte"
              value={<a href={mapsHref} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">In Google Maps öffnen ↗</a>}
            />
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {r.vegetarianOptions && <span className="rounded bg-slate-100 px-1.5 py-0.5">vegetarisch</span>}
            {r.veganOptions && <span className="rounded bg-slate-100 px-1.5 py-0.5">vegan</span>}
            {r.deliveryAvailable && <span className="rounded bg-slate-100 px-1.5 py-0.5">Lieferung</span>}
            {r.takeawayAvailable && <span className="rounded bg-slate-100 px-1.5 py-0.5">Abholung</span>}
            {r.reservationRecommended && <span className="rounded bg-slate-100 px-1.5 py-0.5">Reservierung empfohlen</span>}
          </div>
          {r.notes && <p className="text-sm text-slate-600">{r.notes}</p>}
        </section>

        <section className="space-y-4">
          {r.latitude != null && r.longitude != null && (
            <iframe
              title="Karte"
              className="h-48 w-full rounded-md border border-slate-200"
              src={osmEmbedSrc(r.latitude, r.longitude)}
              loading="lazy"
            />
          )}

          <div>
            <h2 className="mb-1 text-sm font-semibold text-slate-700">Öffnungszeiten</h2>
            {hours.length > 0 ? (
              <ul className="text-sm text-slate-600">
                {hours.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Keine Angaben.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Besuchshistorie ({r.visits.length})
        </h2>
        {r.visits.length === 0 ? (
          <p className="text-sm text-slate-400">Noch keine Besuche.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
            {r.visits
              .slice()
              .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
              .map((v) => (
                <li key={v.id} className="flex justify-between px-3 py-2">
                  <span>{new Date(v.visitedAt).toLocaleDateString('de-DE')}</span>
                  <span className="text-slate-500">
                    {v.rating != null ? `★ ${v.rating}` : ''} {v.notes ?? ''}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {r.sources.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Quellen</h2>
          <ul className="text-xs text-slate-500">
            {r.sources.map((s) => (
              <li key={s.id}>
                {s.type} ({s.reliability})
                {s.url && (
                  <>
                    {' · '}
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      {s.title ?? s.url}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="text-sm">
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}
