interface StatusSelectProps {
  value: string
  onChange: (value: string) => void
}

// Sprint 145 (#578): no green and no amber. The chosen option has the chosen-segment look and the word says which;
// the other keeps its inactive look (the Experience lead, ritemark-dev 486c2da)
const CHOSEN = 'bg-surface-soft text-ink-strong border-hairline-strong'
const NOT_CHOSEN = 'bg-surface text-ink-muted border-hairline hover:border-hairline-strong'
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', active: CHOSEN, inactive: NOT_CHOSEN },
  { value: 'published', label: 'Published', active: CHOSEN, inactive: NOT_CHOSEN },
]

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <div className="flex gap-1.5">
      {STATUS_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
            value === option.value ? option.active : option.inactive
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
