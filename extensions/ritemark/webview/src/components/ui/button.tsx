import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)] active:scale-[0.98] aria-invalid:ring-[var(--r-error-soft)] aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-ritemark-accent hover:bg-accent-deep hover:shadow-ritemark-accent-md",
        destructive:
          "bg-destructive text-white hover:opacity-90 focus-visible:ring-[var(--r-error-soft)]",
        outline:
          "border border-hairline-strong bg-background shadow-xs hover:bg-surface-soft hover:text-ink-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-soft",
        ghost:
          "hover:bg-surface-soft hover:text-ink-strong",
        toolbar:
          "border border-hairline bg-surface text-ink-strong font-medium " +
          "hover:bg-surface-soft " +
          "data-[state=active]:bg-[--r-accent-soft] data-[state=active]:text-[--r-accent] data-[state=active]:border-[--r-accent-soft] data-[state=active]:font-semibold",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
