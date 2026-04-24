import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const filterChipVariants = cva(
  'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-[12px] font-medium leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      selected: {
        false: 'border-hairline bg-surface text-ink-body hover:bg-surface-soft hover:text-ink-strong',
        true: 'border-accent bg-accent-soft text-accent-deep shadow-[inset_2px_0_0_var(--r-accent)]',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
)

type FilterChipProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> &
  VariantProps<typeof filterChipVariants> & {
    selected?: boolean
  }

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, selected = false, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="filter-chip"
      data-state={selected ? 'selected' : 'idle'}
      aria-pressed={selected}
      className={cn(filterChipVariants({ selected, className }))}
      {...props}
    />
  )
)
FilterChip.displayName = 'FilterChip'

export { FilterChip, filterChipVariants }
