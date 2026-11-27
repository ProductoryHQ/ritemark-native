import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';

export function FeedbackLink({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip label={children} asChild>
      <Button
        type="button"
        variant="link"
        aria-disabled={disabled || undefined}
        className="h-auto px-0 py-0 text-xs font-normal leading-5 text-ink-body underline decoration-[color-mix(in_srgb,var(--r-accent)_45%,transparent)] underline-offset-2 hover:text-primary aria-disabled:opacity-50"
        onClick={disabled ? undefined : onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}
