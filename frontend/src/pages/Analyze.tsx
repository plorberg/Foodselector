import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeApi } from '../lib/analyze'
import { restaurantsApi } from '../lib/restaurants'
import type {
  AnalysisInput,
  AnalysisResult,
  ExtractedFact,
  GoogleMapsParseResult,
} from '../types/analysis'

type AnalyzerKey = 'manual' | 'osm' | 'google-places' | 'openai'

const ANALYZERS: { key: AnalyzerKey; label: string; hint: string }[] = [
  { key: 'manual', label: 'Manual Paste', hint: 'Regelbasiert, ohne API-Key nutzbar.' },
  { key: 'osm', label: 'OpenStreetMap', hint: 'Kostenlos, braucht Koordinaten oder Stadt.' },
  { key: 'google-places', label: 'Google Places', hint: 'Nur falls API-Key serverseitig gesetzt.' },
  { key: 'openai', label: 'OpenAI', hint: 'Nur falls API-Key serverseitig gesetzt.' },
]

// Confirmation state for each suggested field before it may be saved.
type FieldRow = ExtractedFact & { accepted: boolean }

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '–'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function confidenceColor(c: number): string {
  if (c >= 0.75) return 'text-green-700'
  if (c >= 0.5) return 'text-amber-600'
  return 'text-red-600'
}

export function Analyze() {
  const navigate = useNavigate()
  const [input, setInput] = useState<AnalysisInput>({})
  const [analyzer, setAnalyzer] = useState<AnalyzerKey>('manual')
  const [pastedText, setPastedText] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [mapsResult, setMapsResult] = useState<GoogleMapsParseResult | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [rows, setRows] = useState<FieldRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function set<K extends keyof AnalysisInput>(key: K, value: AnalysisInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }))
  }

  async function parseMapsLink() {
    setError(null)
    setMessage(null)
    try {
      const parsed = await analyzeApi.parseGoogleMapsLink(googleMapsUrl)
      setMapsResult(parsed)
      // Feed link-derived hints into the analysis input (marked uncertain).
      if (parsed.placeName && !input.restaurantName) set('restaurantName', parsed.placeName)
      if (parsed.query && !input.restaurantName) set('restaurantName', parsed.query)
      if (parsed.coordinates) set('coordinates', parsed.coordinates)
      set('googleMapsUrl', parsed.originalUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google-Maps-Link konnte nicht geparst werden.')
    }
  }

  async function runAnalysis() {
    setLoading(true)
    setError(null)
    setMessage(null)
    setResult(null)
    setRows([])
    try {
      const payload: AnalysisInput = { ...input, pastedText: pastedText || undefined }
      let res: AnalysisResult
      if (analyzer === 'manual') res = await analyzeApi.manual(payload)
      else if (analyzer === 'osm') res = await analyzeApi.osm(payload)
      else if (analyzer === 'google-places') res = await analyzeApi.googlePlaces(payload)
      else res = await analyzeApi.openai(payload)

      setResult(res)
      setRows(
        res.extractedFacts.map((f) => ({ ...f, accepted: f.confidence >= 0.75 }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, accepted: !r.accepted } : r)))
  }

  function acceptSafe() {
    setRows((prev) => prev.map((r) => ({ ...r, accepted: r.confidence >= 0.75 })))
  }

  function acceptAll() {
    setRows((prev) => prev.map((r) => ({ ...r, accepted: true })))
  }

  function discardAll() {
    setRows((prev) => prev.map((r) => ({ ...r, accepted: false })))
  }

  async function save() {
    const accepted = rows.filter((r) => r.accepted)
    if (accepted.length === 0) {
      setError('Bitte mindestens ein Feld zur Übernahme auswählen.')
      return
    }

    // Build a restaurant payload only from confirmed fields.
    const data: Record<string, unknown> = {}
    const fieldStatuses: Record<string, string> = {}
    const confidenceByField: Record<string, number> = {}
    for (const row of accepted) {
      data[row.field] = row.value
      fieldStatuses[row.field] = 'CONFIRMED'
      confidenceByField[row.field] = row.confidence
    }
    if (!data.name) {
      if (input.restaurantName) data.name = input.restaurantName
      else {
        setError('Es muss ein Name übernommen oder eingegeben werden.')
        return
      }
    }
    if (input.googleMapsUrl) data.googleMapsLink = input.googleMapsUrl
    data.fieldStatuses = fieldStatuses
    data.confidenceByField = confidenceByField

    setSaving(true)
    setError(null)
    try {
      const created = await restaurantsApi.create(data as never)
      setMessage(`Gespeichert: ${created.name}`)
      setTimeout(() => navigate(`/restaurants/${created.id}`), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">Restaurant analysieren</h1>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Google-Maps-Link (Identifikator)</h2>
        <div className="flex gap-2">
          <input
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/… oder google.com/maps/place/…"
            className="input"
          />
          <button
            onClick={parseMapsLink}
            disabled={!googleMapsUrl}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            Link parsen
          </button>
        </div>
        {mapsResult && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <strong>Typ:</strong> {mapsResult.sourceType}
            </p>
            {mapsResult.placeName && <p><strong>Name-Hinweis:</strong> {mapsResult.placeName}</p>}
            {mapsResult.query && <p><strong>Suchquery:</strong> {mapsResult.query}</p>}
            {mapsResult.coordinates && (
              <p>
                <strong>Koordinaten:</strong> {mapsResult.coordinates.lat}, {mapsResult.coordinates.lng}
              </p>
            )}
            {mapsResult.placeId && <p><strong>Place-ID:</strong> {mapsResult.placeId}</p>}
            {mapsResult.warnings.map((w, i) => (
              <p key={i} className="mt-1 text-amber-600">⚠ {w}</p>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Eingaben</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={input.restaurantName ?? ''}
            onChange={(e) => set('restaurantName', e.target.value)}
            placeholder="Restaurantname"
            className="input"
          />
          <input
            value={input.city ?? ''}
            onChange={(e) => set('city', e.target.value)}
            placeholder="Stadt"
            className="input"
          />
          <input
            value={input.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Adresse"
            className="input"
          />
          <input
            value={input.websiteUrl ?? ''}
            onChange={(e) => set('websiteUrl', e.target.value)}
            placeholder="Website-URL"
            className="input"
          />
        </div>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Manueller Text (Menü, Beschreibung, Reviews …) – für Manual Paste / OpenAI"
          rows={5}
          className="input mt-3"
        />
      </section>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Analyzer wählen</h2>
        <div className="flex flex-wrap gap-2">
          {ANALYZERS.map((a) => (
            <button
              key={a.key}
              onClick={() => setAnalyzer(a.key)}
              title={a.hint}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                analyzer === a.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {ANALYZERS.find((a) => a.key === analyzer)?.hint}
        </p>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Analysiert…' : 'Analysieren'}
        </button>
      </section>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}

      {result && (
        <section className="mb-6 rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Ergebnisvorschau · Gesamt-Konfidenz {(result.confidence.overall * 100).toFixed(0)}%
            </h2>
          </div>

          {result.warnings.length > 0 && (
            <ul className="mb-3 space-y-1 rounded bg-amber-50 p-3 text-xs text-amber-700">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {result.reasoning.length > 0 && (
            <ul className="mb-3 space-y-1 text-xs text-slate-500">
              {result.reasoning.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Felder erkannt.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={acceptSafe}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Alle sicheren Felder übernehmen
                </button>
                <button
                  onClick={acceptAll}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Alle Vorschläge prüfen
                </button>
                <button
                  onClick={discardAll}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Verwerfen
                </button>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Übern.</th>
                      <th className="px-3 py-2">Feld</th>
                      <th className="px-3 py-2">Wert</th>
                      <th className="px-3 py-2">Konfidenz</th>
                      <th className="px-3 py-2">Begründung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.accepted}
                            onChange={() => toggleRow(i)}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700">{row.field}</td>
                        <td className="px-3 py-2 text-slate-600">{formatValue(row.value)}</td>
                        <td className={`px-3 py-2 ${confidenceColor(row.confidence)}`}>
                          {(row.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.sources.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  Quellen:{' '}
                  {result.sources
                    .map((s) => `${s.type} (${s.reliability})`)
                    .join(', ')}
                </p>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="mt-4 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                {saving ? 'Speichert…' : 'Bestätigte Felder speichern'}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  )
}
