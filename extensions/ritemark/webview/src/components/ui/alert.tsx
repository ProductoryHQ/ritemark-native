/**
 * Alert Component
 *
 * Simple alert with VS Code styling.
 */

import { cn } from '../../lib/utils';

interface AlertProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'warning';
}

export function Alert({ children, className, variant = 'default' }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        variant === 'default' && 'bg-[var(--vscode-editor-background)] border-[var(--r-hairline)]',
        variant === 'destructive' && 'bg-[var(--vscode-inputValidation-errorBackground)] border-[var(--vscode-inputValidation-errorBorder)] text-[var(--r-error)]',
        // Sprint 158 (experience 47, frame 3): a one-line bar above a document that warns before something is lost.
        // Its words take the bar's ink, an icon of its own the bar's amber, and its action is `Button variant="warning"`
        // (a button's icon keeps the button's text colour, ui/button.tsx).
        variant === 'warning' && 'rounded-md border-[var(--r-warning-line)] bg-[var(--r-warning-surface)] py-1 pl-3 pr-1 text-[var(--r-warning-ink)] [&>svg]:text-[var(--r-warning-icon)] [&_[data-slot=alert-description]]:text-[var(--r-warning-ink)]',
        className
      )}
    >
      {children}
    </div>
  );
}

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDescription({ children, className }: AlertDescriptionProps) {
  return (
    <div data-slot="alert-description" className={cn('text-sm text-[var(--r-ink-strong)]', className)}>
      {children}
    </div>
  );
}
