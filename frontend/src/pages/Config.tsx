import { useEffect, useState } from 'react'
import {
  configApi,
  type AppConfig,
  type DecisionProfile,
  type NamedEntity,
} from '../lib/config'

export function Config() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [categories, setCategories] = useState<NamedEntity[]>([])
  const [tags, setTags] = useState<NamedEntity[]>([])
  const [profiles, setProfiles] = useState<DecisionProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function loadAll() {
    try {
      const [c, cats, tgs, profs] = await Promise.all([
        configApi.getConfig(),
        configApi.getCategories(),
        configApi.getTags(),
        configApi.getProfiles(),
      ])
      setConfig(c)
      setCategories(cats)
      setTags(tgs)
      setProfiles(profs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function saveConfig() {
    if (!config) return
    setSaved(false)
    try {
      await configApi.putConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!config) return <p className="text-sm text-slate-500">Lädt…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Konfiguration</h1>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Entscheidungs-Defaults</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-slate-600">Wiederholungssperre (Tage)</span>
            <input
              type="number"
              value={config.defaultRepeatBlockDays}
              onChange={(e) =>
                setConfig({ ...config, defaultRepeatBlockDays: Number(e.target.value) })
              }
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-600">Zufallsfaktor (0-1)</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={config.defaultRandomFactor}
              onChange={(e) =>
                setConfig({ ...config, defaultRandomFactor: Number(e.target.value) })
              }
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-600">Anzahl Vorschläge</span>
            <input
              type="number"
              min={1}
              value={config.defaultSuggestionCount}
              onChange={(e) =>
                setConfig({ ...config, defaultSuggestionCount: Number(e.target.value) })
              }
              className="input"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Restaurant-Analyse läuft über die Google Places API (serverseitig). Sie ist nur aktiv,
          wenn <code>GOOGLE_PLACES_API_KEY</code> gesetzt ist.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveConfig}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Speichern
          </button>
          {saved && <span className="text-sm text-green-700">Gespeichert.</span>}
        </div>
      </section>

      <EditableList
        title="Kategorien"
        items={categories}
        onAdd={async (name) => setCategories([...categories, await configApi.addCategory(name)])}
        onDelete={async (id) => {
          await configApi.deleteCategory(id)
          setCategories(categories.filter((c) => c.id !== id))
        }}
      />

      <EditableList
        title="Tags"
        items={tags}
        onAdd={async (name) => setTags([...tags, await configApi.addTag(name)])}
        onDelete={async (id) => {
          await configApi.deleteTag(id)
          setTags(tags.filter((t) => t.id !== id))
        }}
      />

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Entscheidungsprofile</h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Profile.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-slate-100 px-3 py-2"
              >
                <span>
                  <span className="font-medium text-slate-800">{p.name}</span>
                  {p.isDefault && <span className="ml-2 text-xs text-slate-400">(Standard)</span>}
                  <span className="ml-2 text-xs text-slate-400">
                    Sperre {p.repeatBlockDays}d · {p.suggestionCount} Vorschläge
                  </span>
                </span>
                {!p.isDefault && (
                  <button
                    onClick={async () => {
                      await configApi.deleteProfile(p.id)
                      setProfiles(profiles.filter((x) => x.id !== p.id))
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Löschen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function EditableList({
  title,
  items,
  onAdd,
  onDelete,
}: {
  title: string
  items: NamedEntity[]
  onAdd: (name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.id}
            className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-sm"
          >
            {item.name}
            <button
              onClick={() => onDelete(item.id)}
              className="text-slate-400 hover:text-red-600"
              title="Löschen"
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-slate-400">Keine Einträge.</span>}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!value.trim()) return
          setBusy(true)
          try {
            await onAdd(value.trim())
            setValue('')
          } finally {
            setBusy(false)
          }
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Neue ${title.slice(0, -1)}…`}
          className="input"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          Hinzufügen
        </button>
      </form>
    </section>
  )
}
