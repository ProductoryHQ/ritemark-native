/**
 * Sprint 129 R5/R6: the one dialog that says why dictation cannot start or had
 * to stop, and offers the fix (dictationProblems.ts holds the wording).
 * Replaces the hand-rolled macOS-only microphone modal.
 */

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'
import { Icon } from './ui/Icon'
import { dictationProblemCopy, type DictationAction, type DictationProblem, type ProblemButton } from './dictationProblems'
import type { WebviewPlatform } from '../hooks/usePlatform'

export function DictationProblemDialog({
  problem,
  detail,
  platform,
  onAction,
}: {
  problem: DictationProblem | null
  detail?: string
  platform: WebviewPlatform
  onAction: (action: DictationAction) => void
}) {
  if (!problem) return null
  const copy = dictationProblemCopy(problem, platform, detail)

  const button = (spec: ProblemButton, variant: 'default' | 'secondary') => (
    <Tooltip label={spec.tooltip} side="top">
      <Button variant={variant} onClick={() => onAction(spec.action)} className="whitespace-nowrap">
        {spec.label}
      </Button>
    </Tooltip>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onAction('close') }}>
      <DialogContent aria-describedby="dictation-problem-body">
        <DialogHeader icon={<Icon name={copy.icon} size={20} />} onClose={() => onAction('close')}>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription id="dictation-problem-body" className="text-sm leading-relaxed text-ink-body">
            {copy.body.map((part, index) => part.strong
              ? <strong key={index} className="font-semibold text-ink-strong">{part.text}</strong>
              : <span key={index}>{part.text}</span>)}
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          {copy.secondary && button(copy.secondary, 'secondary')}
          {button(copy.primary, 'default')}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
