import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { restaurantsApi } from '../lib/restaurants'
import type { Restaurant } from '../types/restaurant'

type FormState = {
  name: string
  categories: string
  subcategories: string
  address: string
  district: string
  classification: '' | 'NEW' | 'RECOMMENDATION'
  website: string
  googleMapsLink: string
  phone: string
  priceLevel: string
  tags: string
  signatureDishes: string
  vegetarianOptions: boolean
  veganOptions: boolean
  reservationRecommended: boolean
  deliveryAvailable: boolean
  takeawayAvailable: boolean
  personalRating: string
  externalRating: string
  notes: string
  favorite: boolean
  blacklisted: boolean
}

const EMPTY: FormState = {
  name: '',
  categories: '',
  subcategories: '',
  address: '',
  district: '',
  classification: '',
  website: '',
  googleMapsLink: '',
  phone: '',
  priceLevel: '',
  tags: '',
  signatureDishes: '',
  vegetarianOptions: false,
  veganOptions: false,
  reservationRecommended: false,
  deliveryAvailable: false,
  takeawayAvailable: false,
  personalRating: '',
  externalRating: '',
  notes: '',
  favorite: false,
  blacklisted: false,
}

function toCsv(values: string[]): string {
  return values.join(', ')
}

function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function fromRestaurant(r: Restaurant): FormState {
  return {
    name: r.name,
    categories: toCsv(r.categories),
    subcategories: toCsv(r.subcategories),
    address: r.address ?? '',
    district: r.district ?? '',
    classification: r.classification ?? '',
    website: r.website ?? '',
    googleMapsLink: r.googleMapsLink ?? '',
    phone: r.phone ?? '',
    priceLevel: r.priceLevel != null ? String(r.priceLevel) : '',
    tags: toCsv(r.tags),
    signatureDishes: toCsv(r.signatureDishes),
    vegetarianOptions: r.vegetarianOptions ?? false,
    veganOptions: r.veganOptions ?? false,
    reservationRecommended: r.reservationRecommended ?? false,
    deliveryAvailable: r.deliveryAvailable ?? false,
    takeawayAvailable: r.takeawayAvailable ?? false,
    personalRating: r.personalRating != null ? String(r.personalRating) : '',
    externalRating: r.externalRating != null ? String(r.externalRating) : '',
    notes: r.notes ?? '',
    favorite: r.favorite,
    blacklisted: r.blacklisted,
  }
}

function toInput(form: FormState) {
  return {
    name: form.name,
    categories: fromCsv(form.categories),
    subcategories: fromCsv(form.subcategories),
    address: form.address || null,
    district: form.district || null,
    classification: form.classification || null,
    website: form.website || null,
    googleMapsLink: form.googleMapsLink || null,
    phone: form.phone || null,
    priceLevel: form.priceLevel ? Number(form.priceLevel) : null,
    tags: fromCsv(form.tags),
    signatureDishes: fromCsv(form.signatureDishes),
    vegetarianOptions: form.vegetarianOptions,
    veganOptions: form.veganOptions,
    reservationRecommended: form.reservationRecommended,
    deliveryAvailable: form.deliveryAvailable,
    takeawayAvailable: form.takeawayAvailable,
    personalRating: form.personalRating ? Number(form.personalRating) : null,
    externalRating: form.externalRating ? Number(form.externalRating) : null,
    notes: form.notes || null,
    favorite: form.favorite,
    blacklisted: form.blacklisted,
  }
}

export function RestaurantForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    restaurantsApi
      .get(id)
      .then((r) => setForm(fromRestaurant(r)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Fehler beim Laden.'))
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit && id) {
        await restaurantsApi.update(id, toInput(form))
      } else {
        await restaurantsApi.create(toInput(form))
      }
      navigate('/restaurants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Lädt…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">
        {isEdit ? 'Restaurant bearbeiten' : 'Neues Restaurant'}
      </h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name *">
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Adresse (inkl. PLZ/Stadt)">
          <input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Stadtteil">
            <input
              value={form.district}
              onChange={(e) => set('district', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Klassifizierung">
            <select
              value={form.classification}
              onChange={(e) => set('classification', e.target.value as FormState['classification'])}
              className="input"
            >
              <option value="">–</option>
              <option value="NEW">Neu</option>
              <option value="RECOMMENDATION">Empfehlung</option>
            </select>
          </Field>
        </div>
        <Field label="Kategorien (kommagetrennt)">
          <input
            value={form.categories}
            onChange={(e) => set('categories', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Unterkategorien (kommagetrennt)">
          <input
            value={form.subcategories}
            onChange={(e) => set('subcategories', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Tags (kommagetrennt)">
          <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className="input" />
        </Field>
        <Field label="Signature Dishes (kommagetrennt)">
          <input
            value={form.signatureDishes}
            onChange={(e) => set('signatureDishes', e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Website">
            <input
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Telefon">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Google-Maps-Link">
          <input
            value={form.googleMapsLink}
            onChange={(e) => set('googleMapsLink', e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Preisniveau (1-4)">
            <select
              value={form.priceLevel}
              onChange={(e) => set('priceLevel', e.target.value)}
              className="input"
            >
              <option value="">–</option>
              <option value="1">€</option>
              <option value="2">€€</option>
              <option value="3">€€€</option>
              <option value="4">€€€€</option>
            </select>
          </Field>
          <Field label="Eigene Bewertung (0-5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={form.personalRating}
              onChange={(e) => set('personalRating', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Externe Bewertung (0-5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={form.externalRating}
              onChange={(e) => set('externalRating', e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <Checkbox
            label="Vegetarisch"
            checked={form.vegetarianOptions}
            onChange={(v) => set('vegetarianOptions', v)}
          />
          <Checkbox label="Vegan" checked={form.veganOptions} onChange={(v) => set('veganOptions', v)} />
          <Checkbox
            label="Reservierung empfohlen"
            checked={form.reservationRecommended}
            onChange={(v) => set('reservationRecommended', v)}
          />
          <Checkbox
            label="Lieferung"
            checked={form.deliveryAvailable}
            onChange={(v) => set('deliveryAvailable', v)}
          />
          <Checkbox
            label="Abholung"
            checked={form.takeawayAvailable}
            onChange={(v) => set('takeawayAvailable', v)}
          />
          <Checkbox label="Favorit" checked={form.favorite} onChange={(v) => set('favorite', v)} />
          <Checkbox
            label="Blacklist"
            checked={form.blacklisted}
            onChange={(v) => set('blacklisted', v)}
          />
        </div>
        <Field label="Notizen">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="input"
            rows={3}
          />
        </Field>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/restaurants')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
