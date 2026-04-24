import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const pillVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-medium leading-4 transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-surface-soft text-ink-body',
        accent: 'bg-accent-soft text-accent-deep',
        info: 'bg-accent-soft text-accent-deep',
        success: 'bg-ritemark-success-soft text-ritemark-success',
        warning: 'bg-ritemark-warning-soft text-ritemark-warning',
        error: 'bg-ritemark-error-soft text-ritemark-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Pill({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof pillVariants>) {
  return <span data-slot="pill" className={cn(pillVariants({ variant, className }))} {...props} />
}

export { Pill, pillVariants }
