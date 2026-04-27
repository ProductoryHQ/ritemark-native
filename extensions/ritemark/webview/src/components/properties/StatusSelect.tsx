interface StatusSelectProps {
  value: string
  onChange: (value: string) => void
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', active: 'bg-amber-50 text-amber-700 border-amber-200', inactive: 'bg-surface text-ink-muted border-hairline hover:border-hairline-strong' },
  { value: 'published', label: 'Published', active: 'bg-emerald-50 text-emerald-700 border-emerald-200', inactive: 'bg-surface text-ink-muted border-hairline hover:border-hairline-strong' },
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
