/**
 * Input Component
 *
 * Simple input with VS Code styling.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full px-3 py-1.5 text-sm rounded',
          'bg-[var(--vscode-input-background)]',
          'text-[var(--vscode-input-foreground)]',
          'border border-[var(--vscode-input-border)]',
          'placeholder:text-[var(--vscode-input-placeholderForeground)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
