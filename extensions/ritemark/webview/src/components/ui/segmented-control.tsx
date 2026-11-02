/**
 * Segmented control (Sprint 147, W2): two or three choices side by side, one chosen. The kit's `.seltog` (experience 15,
 * frames 3 and 4: Where the AI runs from, Text size in chats). Native radio inputs, so the keyboard (Tab to the group,
 * arrows between choices) and screen readers come with the platform and no dependency is added.
 *
 *   <SegmentedControl aria-label="Text size in chats" value={size} onValueChange={setSize}
 *     options={[{ value: '12', label: 'Smaller' }, { value: '13', label: 'Usual' }]} />
 *
 * Each choice's input lies over its whole cell and draws the cell's fill, so the shared keyboard ring (`rm-focus-ring`)
 * draws around the choice itself; the words and the picture lie over it and let the pointer through.
 *
 * A value that is none of the options chooses none (a chat size set in All settings): the control never rewrites it.
 *
 * `picture`: the large variant, a picture over the words, the chosen one on the indigo-soft fill (frame 4's themes).
 */

import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SegmentedOption {
  value: string
  label: React.ReactNode
  /** The `picture` variant's picture, drawn above the label. */
  picture?: React.ReactNode
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  /** The chosen value; one no option has chooses none. */
  value: string | undefined
  onValueChange: (value: string) => void
  'aria-label': string
  variant?: 'default' | 'picture'
  disabled?: boolean
  className?: string
  /** Props for one option's input, by value (the catalogue marks its target with them). */
  inputProps?: Record<string, React.InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, unknown>>
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  variant = 'default',
  disabled = false,
  className,
  inputProps,
}: SegmentedControlProps) {
  const name = React.useId()
  const picture = variant === 'picture'
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-slot="segmented-control"
      className={cn(
        picture ? 'grid grid-cols-2 gap-2' : 'inline-flex shrink-0 rounded-lg bg-surface-muted p-0.5',
        disabled && 'opacity-50',
        className
      )}
    >
      {options.map((option) => (
        <label key={option.value} className={cn('relative flex', picture ? 'flex-col items-stretch px-1.5 pb-2 pt-1.5' : 'items-center')}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onValueChange(option.value)}
            className={cn(
              'peer absolute inset-0 m-0 appearance-none outline-none rm-focus-ring transition-colors disabled:cursor-not-allowed',
              picture
                ? 'rounded-[10px] checked:bg-accent-soft [&:not(:checked):not(:disabled)]:hover:bg-surface-soft'
                : 'rounded-md checked:bg-surface checked:shadow-[0_0_0_1px_var(--r-hairline),0_1px_2px_rgba(30,27,75,0.06)] [&:not(:checked):not(:disabled)]:hover:bg-surface-soft'
            )}
            {...inputProps?.[option.value]}
          />
          {picture && option.picture ? <span className="pointer-events-none relative mb-2 block">{option.picture}</span> : null}
          <span
            className={cn(
              'pointer-events-none relative whitespace-nowrap text-ink-body peer-checked:text-ink-strong peer-hover:text-ink-strong',
              picture
                ? 'text-center text-[13px] leading-[18px] peer-checked:font-semibold'
                : 'h-[26px] px-2.5 text-[12.5px] font-medium leading-[26px]'
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
