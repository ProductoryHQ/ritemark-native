import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';

export function FeedbackLink({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Tooltip label={children} asChild>
      <Button
        type="button"
        variant="link"
        className="h-auto px-0 py-0 text-xs font-normal leading-5 text-ink-body underline decoration-[color-mix(in_srgb,var(--r-accent)_45%,transparent)] underline-offset-2 hover:text-primary"
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}
