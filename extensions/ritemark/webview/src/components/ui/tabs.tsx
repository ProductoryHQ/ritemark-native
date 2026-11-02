/**
 * Tabs — peer views under one heading (Radix Tabs, shadcn copy-paste pattern;
 * Sprint 130's Task board: Your calls · Board · Ideas · Log). Underline style:
 * the selected tab has strong ink and a 2px accent rule; the list has a
 * hairline under it. Radix gives the keyboard model (arrows move, Home/End).
 *
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList aria-label="Board views">
 *       <TabsTrigger value="calls">Your calls</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="calls">…</TabsContent>
 *   </Tabs>
 *
 * Vertical (Sprint 147, Settings' sections; the kit's `.snav`): `<Tabs orientation="vertical">` draws the list as a
 * column of rows, 32 high, the chosen one on the indigo-soft fill with its icon in the accent. Radix puts
 * `data-orientation` on the list and each trigger, and the arrows move up and down.
 */

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex gap-5 border-b border-hairline',
      'data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:border-b-0',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      '-mb-px inline-flex items-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-0 pb-[9px] pt-2 font-ui text-[13px] font-medium text-ink-muted transition-colors',
      'hover:text-ink-strong rm-focus-ring',
      'disabled:pointer-events-none disabled:opacity-50', // disabled as the Button: half strength, no pointer
      'data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-ink-strong',
      // Vertical: a row with a fill, no rule
      'data-[orientation=vertical]:m-0 data-[orientation=vertical]:h-8 data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start',
      'data-[orientation=vertical]:gap-2 data-[orientation=vertical]:rounded-md data-[orientation=vertical]:border-0 data-[orientation=vertical]:px-2.5',
      'data-[orientation=vertical]:py-0 data-[orientation=vertical]:text-left data-[orientation=vertical]:font-normal data-[orientation=vertical]:text-ink-body',
      'data-[orientation=vertical]:data-[state=inactive]:hover:bg-surface-soft',
      'data-[orientation=vertical]:data-[state=active]:bg-accent-soft data-[orientation=vertical]:data-[state=active]:font-medium',
      'data-[orientation=vertical]:data-[state=active]:text-ink-strong data-[orientation=vertical]:data-[state=active]:[&_svg]:text-accent',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('focus-visible:outline-none', className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
