/**
 * Dialog Components (shadcn/ui style)
 *
 * Re-exports using Radix UI primitives with Ritemark token styling.
 * Visual standard matches Dictation Settings dialog:
 * - Header row: icon + title + X close button, border-bottom
 * - Content area: scrollable, padding 16px
 * - Footer: border-top, buttons right-aligned
 * - Modal: rounded-xl, shadow
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Icon } from './Icon';
import { cn } from '../../lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[rgba(30,27,75,0.45)] backdrop-blur-[6px]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-[480px] translate-x-[-50%] translate-y-[-50%]',
        'flex flex-col max-h-[80vh]',
        'rounded-lg shadow-ritemark-lg',
        'bg-surface text-ink-strong',
        'border border-hairline',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Header row with icon + title + close button. Renders border-bottom separator. */
const DialogHeader = ({
  className,
  icon,
  children,
  onClose,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode
  onClose?: () => void
}) => (
  <div
    className={cn(
      'flex items-center justify-between px-5 py-4',
      'border-b border-hairline',
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2 text-ink-strong">
      {icon}
      {children}
    </div>
    {onClose && (
      <DialogPrimitive.Close
        onClick={onClose}
        aria-label="Close dialog"
        className="flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-ink-muted cursor-pointer transition-colors hover:bg-surface-soft hover:text-ink-strong"
      >
        <Icon name="x" size={16} />
      </DialogPrimitive.Close>
    )}
  </div>
);
DialogHeader.displayName = 'DialogHeader';

/** Scrollable content area with padding. */
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex-1 overflow-y-auto p-5', className)}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

/** Footer with border-top separator and right-aligned buttons. */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex justify-end gap-2.5 px-5 py-3.5',
      'border-t border-hairline',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-base font-semibold leading-none',
      'text-ink-strong',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-ink-muted', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** Standard dialog button. Use variant="primary" for action, "secondary" for cancel. */
const DialogButton = ({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}) => (
  <button
    className={cn(
      'px-4 py-2 rounded-md text-[13px] font-medium border-none cursor-pointer transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)]',
      variant === 'primary' && 'bg-primary text-primary-foreground shadow-ritemark-accent hover:bg-accent-deep hover:shadow-ritemark-accent-md',
      variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-surface-soft',
      variant === 'danger' && 'bg-destructive text-white hover:opacity-90 focus-visible:ring-[var(--r-error-soft)]',
      className
    )}
    {...props}
  />
);
DialogButton.displayName = 'DialogButton';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogButton,
};
