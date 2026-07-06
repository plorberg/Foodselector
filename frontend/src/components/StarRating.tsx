// Visual 5-star rating: read-only display or interactive input.
export function StarRating({
  value,
  onChange,
  size = 'text-base',
}: {
  value: number | null
  onChange?: (value: number) => void
  size?: string
}) {
  const stars = [1, 2, 3, 4, 5]
  if (!onChange) {
    if (value == null) return null
    return (
      <span className={`inline-flex items-center ${size}`} title={`${value} von 5`}>
        {stars.map((s) => (
          <span key={s} className={s <= Math.round(value) ? 'text-amber-500' : 'text-slate-300'}>
            ★
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center ${size}`}>
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-label={`${s} Sterne`}
          className={`px-0.5 transition-transform hover:scale-125 ${
            value != null && s <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
          }`}
        >
          ★
        </button>
      ))}
    </span>
  )
}
