import { useState } from 'react'
import { api } from '../lib/api'

export function ImportExport() {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    try {
      const data = await api.get<unknown>('/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `food-selector-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen.')
    }
  }

  async function handleImport() {
    setError(null)
    setMessage(null)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(importText)
    } catch {
      setError('Ungültiges JSON.')
      return
    }
    try {
      const result = await api.post<{ importedRestaurants: number; mode: string }>('/import', {
        ...parsed,
        mode: importMode,
      })
      setMessage(`Import erfolgreich: ${result.importedRestaurants} Restaurant(s) (${result.mode}).`)
      setImportText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import fehlgeschlagen.')
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result))
    reader.readAsText(file)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Import / Export</h1>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Export</h2>
        <p className="mb-3 text-sm text-slate-500">
          Exportiert alle Restaurants (inkl. Quellen, Fakten, Besuche), Kategorien, Tags und
          Entscheidungsprofile als JSON-Datei.
        </p>
        <button
          onClick={handleExport}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          JSON exportieren
        </button>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Import</h2>
        <div className="mb-3 flex items-center gap-4 text-sm text-slate-600">
          <input type="file" accept="application/json" onChange={onFile} />
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={importMode === 'merge'}
              onChange={() => setImportMode('merge')}
            />
            Zusammenführen
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            Ersetzen
          </label>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="JSON hier einfügen oder Datei wählen…"
          rows={8}
          className="input font-mono text-xs"
        />
        {importMode === 'replace' && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠ „Ersetzen" löscht zuerst alle vorhandenen Restaurants.
          </p>
        )}
        <button
          onClick={handleImport}
          disabled={!importText.trim()}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Importieren
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
    </div>
  )
}
