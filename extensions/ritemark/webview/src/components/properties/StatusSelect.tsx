interface StatusSelectProps {
  value: string
  onChange: (value: string) => void
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'published', label: 'Published', color: 'bg-green-100 text-green-800 border-green-200' },
]

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <div className="flex-1 flex gap-2">
      {STATUS_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            value === option.value
              ? option.color
              : 'bg-white text-ink-muted border-hairline hover:border-hairline-strong'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
