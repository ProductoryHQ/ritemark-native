/**
 * The report window — Sprint 126 (RQ2, RQ3, RQ4).
 *
 * Reached from the status bar and from AI Information; both open this one
 * component in the same state, so there is one implementation of the honest
 * wording rather than two that drift.
 *
 * WHY THE REPORT TEXT STAYS ON SCREEN AFTER THE HANDOFF: `openExternal`
 * resolving true means the OS accepted the URI, not that a compose window
 * appeared — on some systems it resolves true and nothing happens. So the
 * composed report and a Copy control remain visible in EVERY outcome. A user
 * whose mail client silently failed to appear still has their text and the
 * address, instead of a cheerful confirmation and a lost report.
 */
import { useEffect, useRef, useState } from 'react'
import { sendToExtension, onMessage } from '../../../bridge'
import { Icon } from '../../ui/Icon'
import {
  Dialog,
  DialogBody,
  DialogButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import {
  MAX_REPORT_BODY_CHARS,
  REPORT_RECIPIENT,
  composeReport,
  narrowReportContext,
  reportContextLines,
  reportSubject,
  type ReportContextV1,
} from '../../../../../src/reporting/composeReport'
import { REPORT_COPY } from '../../../../../src/reporting/reportCopy'

type Outcome = 'opened' | 'no-handler' | 'too-long' | 'invalid-request'

export function useReportDialog() {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<ReportContextV1 | null>(null)

  useEffect(() => {
    return onMessage((message) => {
      if ((message as { type?: string })?.type !== 'report/open') return
      setContext(narrowReportContext(message))
      setOpen(true)
    })
  }, [])

  /**
   * Ask the HOST to open the window rather than opening it locally. The host
   * is the only side that knows the app version and platform, so routing both
   * entry points through it keeps the context identical (RQ5) instead of
   * giving the AI Information path a second, poorer one.
   */
  const request = () => sendToExtension('report/request-open')

  return { open, context, setOpen, request }
}

interface ReportDialogProps {
  open: boolean
  context: ReportContextV1 | null
  onOpenChange: (open: boolean) => void
}

export function ReportDialog({ open, context, onOpenChange }: ReportDialogProps) {
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // A new invocation is a new report. Nothing is retained between openings —
  // a half-written complaint reappearing later would be its own privacy bug.
  useEffect(() => {
    if (!open) return
    setBody('')
    setOutcome(null)
    setCopied(false)
    const id = window.setTimeout(() => textareaRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    return onMessage((message) => {
      const value = message as { type?: string; outcome?: Outcome }
      if (value?.type !== 'report/result') return
      setOutcome(value.outcome ?? 'no-handler')
    })
  }, [])

  if (!context) return null

  const report = composeReport(context, body)
  const contextLines = reportContextLines(context)
  const handedOver = outcome !== null
  const needsManualSend = outcome === 'no-handler' || outcome === 'too-long' || outcome === 'invalid-request'

  const submit = () => {
    sendToExtension('report/open-mail', {
      recipient: REPORT_RECIPIENT,
      subject: reportSubject(context),
      body: report,
    })
  }

  const copy = () => {
    void navigator.clipboard?.writeText(report).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%_-_32px)] max-w-[520px]">
        <DialogHeader icon={<Icon name="warning-circle" size={20} tone="active" />} onClose={() => onOpenChange(false)}>
          <DialogTitle>{REPORT_COPY.dialogTitle}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <DialogDescription className="leading-relaxed">{REPORT_COPY.dialogDescription}</DialogDescription>

          <section aria-labelledby="report-context">
            <h3 id="report-context" className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--r-ink-muted)]">
              {REPORT_COPY.contextLabel}
            </h3>
            <div className="rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/50 px-3 py-2 text-[11px] text-[var(--r-ink-muted)]">
              {contextLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="report-body" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--r-ink-muted)]">
              {REPORT_COPY.bodyLabel}
            </label>
            <textarea
              id="report-body"
              ref={textareaRef}
              value={body}
              maxLength={MAX_REPORT_BODY_CHARS}
              onChange={(event) => {
                setBody(event.target.value)
                setOutcome(null)
                setCopied(false)
              }}
              placeholder={REPORT_COPY.bodyPlaceholder}
              rows={7}
              className="w-full resize-y rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface)] p-2.5 text-[12px] leading-relaxed text-[var(--r-ink-strong)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--r-ring-color)]"
            />
            <button
              type="button"
              onClick={copy}
              className="mt-1.5 bg-transparent p-0 text-[10px] font-semibold text-[var(--r-accent-deep)] hover:underline focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--r-ring-color)]"
            >
              {copied ? REPORT_COPY.copiedAction : REPORT_COPY.copyAction}
            </button>
          </section>

          {handedOver && (
            <section
              role="status"
              aria-live="polite"
              className="rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface-soft)] p-3"
            >
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--r-ink-strong)]">
                <Icon name={needsManualSend ? 'info' : 'paper-plane-right'} size={14} />
                {outcome === 'opened' && REPORT_COPY.handoffTitle}
                {outcome === 'no-handler' && REPORT_COPY.fallbackTitle}
                {outcome === 'too-long' && REPORT_COPY.tooLongTitle}
                {outcome === 'invalid-request' && REPORT_COPY.fallbackTitle}
              </h3>
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--r-ink-muted)]">
                {outcome === 'opened' && REPORT_COPY.handoffDetail}
                {outcome === 'no-handler' && REPORT_COPY.fallbackDetail}
                {outcome === 'too-long' && REPORT_COPY.tooLongDetail}
                {outcome === 'invalid-request' && REPORT_COPY.fallbackDetail}
              </p>
              <div className="mt-2 text-[11px]">
                <span className="text-[var(--r-ink-muted)]">{REPORT_COPY.fallbackRecipientLabel}: </span>
                <span className="font-medium text-[var(--r-ink-strong)]">{REPORT_RECIPIENT}</span>
              </div>
            </section>
          )}
        </DialogBody>

        {/* Two buttons, not three. The sidebar is ~300px wide and a third
            control forced every label to wrap to four lines. Copy belongs
            beside the report text anyway — it acts on the text, it is not a
            peer of the primary action. */}
        <DialogFooter>
          <DialogButton variant="secondary" onClick={() => onOpenChange(false)}>
            {REPORT_COPY.cancelAction}
          </DialogButton>
          <DialogButton onClick={submit}>{REPORT_COPY.primaryAction}</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
