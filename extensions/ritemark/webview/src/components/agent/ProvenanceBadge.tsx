import { Badge } from '../ui/badge'

type Provenance = 'claude' | 'codex' | 'shared'

const CONFIG: Record<Provenance, { label: string; className: string }> = {
  claude: { label: 'claude', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800' },
  codex:  { label: 'codex',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  shared: { label: 'shared', className: 'bg-surface-soft text-ink-muted border-hairline' },
}

interface ProvenanceBadgeProps {
  provenance: Provenance
}

export function ProvenanceBadge({ provenance }: ProvenanceBadgeProps) {
  const { label, className } = CONFIG[provenance]
  return (
    <Badge className={className}>
      [{label}]
    </Badge>
  )
}
