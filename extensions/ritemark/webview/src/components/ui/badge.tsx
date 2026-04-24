import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-hairline bg-surface-soft text-ink-body',
        accent: 'border-transparent bg-accent-soft text-accent-deep',
        success: 'border-transparent bg-ritemark-success-soft text-ritemark-success',
        warning: 'border-transparent bg-ritemark-warning-soft text-ritemark-warning',
        error: 'border-transparent bg-ritemark-error-soft text-ritemark-error',
        outline: 'border-hairline-strong bg-surface text-ink-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge, badgeVariants }
