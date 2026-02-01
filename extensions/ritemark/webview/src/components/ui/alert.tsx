/**
 * Alert Component
 *
 * Simple alert with VS Code styling.
 */

import { cn } from '../../lib/utils';

interface AlertProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive';
}

export function Alert({ children, className, variant = 'default' }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-lg border p-4',
        variant === 'default' && 'bg-[var(--vscode-editor-background)] border-[var(--vscode-panel-border)]',
        variant === 'destructive' && 'bg-[var(--vscode-inputValidation-errorBackground)] border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-errorForeground)]',
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
    <div className={cn('text-sm text-[var(--vscode-foreground)]', className)}>
      {children}
    </div>
  );
}
