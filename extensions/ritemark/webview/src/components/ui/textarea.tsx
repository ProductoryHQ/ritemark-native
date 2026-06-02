/**
 * Textarea Component
 *
 * Multi-line input with VS Code styling — mirrors input.tsx.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full px-3 py-1.5 text-sm rounded',
          'bg-[var(--vscode-input-background)]',
          'text-[var(--vscode-input-foreground)]',
          'border border-[var(--vscode-input-border)]',
          'placeholder:text-[var(--vscode-input-placeholderForeground)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'resize-y',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
