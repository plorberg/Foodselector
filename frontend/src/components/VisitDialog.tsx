import { useState } from 'react'
import { restaurantsApi } from '../lib/restaurants'
import { StarRating } from './StarRating'

// "Wie war's?" — records a visit with optional rating and note.
export function VisitDialog({
  restaurantId,
  restaurantName,
  onDone,
  onClose,
}: {
  restaurantId: string
  restaurantName: string
  onDone: () => void
  onClose: () => void
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await restaurantsApi.markVisit(restaurantId, {
        rating: rating ?? undefined,
        notes: notes.trim() || undefined,
      })
      onDone()
    } catch {
      setError('Besuch konnte nicht gespeichert werden.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Besuch bei {restaurantName}</h2>
        <p className="mb-3 text-sm text-slate-500">Wie war’s? (optional)</p>

        <div className="mb-3">
          <StarRating value={rating} onChange={setRating} size="text-2xl" />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notiz, z. B. was ihr gegessen habt…"
          rows={2}
          className="input mb-3"
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Speichert…' : 'Besuch speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
