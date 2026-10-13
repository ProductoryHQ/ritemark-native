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
 */

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex gap-5 border-b border-hairline', className)} {...props} />
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
      'hover:text-ink-strong focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)]',
      'data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-ink-strong',
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
