/**
 * Sprint 118 R1/R2/R5/R6 — the recording surfaces in the Transcribe panel
 * (design.md, approved 2026-09-22): permission wait, live recording, saving,
 * failures and notices, and interrupted-recording recovery.
 *
 * The live state is deliberately not red: recording is normal work, not an
 * alarm. Time and size come from audio the host confirmed as written.
 *
 * Every button row fits on one line at sidebar width (Jarmo, 2026-09-22):
 * short labels, primary action first and wide, as in the pending card.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/Icon';
import { Tooltip } from '../../ui/tooltip';
import { vscode } from '../../../lib/vscode';
import { formatDuration, type InterruptedRecording, type RecordingProjection } from '../types';
import { displayPath, formatElapsed, formatSavedSize, fullPath, shortFolder } from './capture';
import type { CaptureView } from './captureSession';

/** Cancel asks first once there is audio worth keeping (design: "meaningful"). */
const CONFIRM_CANCEL_AFTER_SEC = 5;

const post = (message: { type: string; [key: string]: unknown }) => vscode.postMessage(message);

function Card({
  tone = 'accent',
  children,
  label,
  containerRef,
}: {
  tone?: 'accent' | 'neutral' | 'error' | 'warning';
  children: React.ReactNode;
  label?: string;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  const tones = {
    accent: 'border-accent-fainter bg-accent-soft/25',
    neutral: 'border-hairline bg-surface',
    error: 'border-ritemark-error/40 bg-ritemark-error-soft',
    warning: 'border-ritemark-warning/40 bg-ritemark-warning-soft/60',
  };
  return (
    <div ref={containerRef} role={label ? 'group' : undefined} aria-label={label} className={`mx-3 mb-3 rounded-lg border p-3 ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** The dot on Record and the live indicator: a shape, so it takes the text colour. */
export function RecordDot({ live = false, size = 'md' }: { live?: boolean; size?: 'md' | 'lg' }) {
  if (!live) {
    return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full bg-current ${size === 'lg' ? 'size-3.5' : 'size-2.5'}`} />;
  }
  return (
    <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
    </span>
  );
}

/** Where the live recording goes: shortened for the sidebar, in full for the tooltip. */
function destination(host: RecordingProjection): { short: string; full: string } | null {
  if (!host.fileName) return null;
  if (!host.folderLabel) return { short: host.fileName, full: host.fileName };
  return { short: displayPath(host.folderLabel, host.fileName), full: fullPath(host.folderLabel, host.fileName) };
}

export function PermissionCard({ onCancel }: { onCancel: () => void }) {
  return (
    <Card label="Recording">
      <div className="flex items-center gap-2">
        <Icon name="microphone" size={16} tone="inherit" className="shrink-0 text-accent" />
        <span className="text-xs font-semibold">Waiting for microphone permission…</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
        Allow Ritemark to use the microphone when your system asks.
      </p>
      <div className="mt-3">
        <Tooltip label="Stop waiting. Nothing is recorded.">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </Tooltip>
      </div>
    </Card>
  );
}

export function LiveRecordingCard({
  view,
  host,
  onStop,
  onCancel,
}: {
  view: CaptureView;
  host: RecordingProjection;
  onStop: () => void;
  onCancel: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // Button is a plain function component (React 18), so focus goes through the card.
  const cardRef = useRef<HTMLDivElement>(null);
  const where = host.sessionId === view.sessionId ? destination(host) : null;
  const elapsed = formatElapsed(view.savedSeconds);

  return (
    <Card label="Recording" containerRef={cardRef}>
      <div className="flex items-center gap-2">
        <RecordDot live />
        <span className="text-xs font-semibold text-accent-deep">Recording</span>
        <span className="ml-auto text-sm font-semibold tabular-nums" aria-label={`Recorded ${elapsed}`}>
          {elapsed}
        </span>
      </div>
      {where && (
        <Tooltip className="mt-1.5 flex min-w-0" side="top" label={where.full}>
          <span className="truncate text-[11px] text-ink-muted">{where.short}</span>
        </Tooltip>
      )}
      <div className="mt-0.5 text-[11px] text-ink-muted">{formatSavedSize(view.savedSeconds)}</div>
      {host.warnLong && host.sessionId === view.sessionId && (
        <p className="mt-2 text-[11px] leading-relaxed text-ritemark-warning-foreground">
          This recording is over 2 hours. It stops and saves automatically at 4 hours.
        </p>
      )}
      {confirming ? (
        <div className="mt-3">
          <p className="text-[11px] leading-relaxed text-ink-body">Discard this recording? It moves to the Trash.</p>
          <div className="mt-2 flex gap-2">
            <Tooltip label="Go back. The recording continues.">
              <Button
                variant="secondary"
                size="sm"
                autoFocus
                onClick={() => {
                  setConfirming(false);
                  requestAnimationFrame(() => cardRef.current?.querySelector<HTMLButtonElement>('[data-recording-stop]')?.focus());
                }}
              >
                Keep recording
              </Button>
            </Tooltip>
            <Tooltip label="Stop and move this recording to the Trash">
              <Button variant="destructive" size="sm" onClick={onCancel}>
                Discard
              </Button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Tooltip className="min-w-0 flex-1" label="Stop recording, then choose how to transcribe it">
            <Button data-recording-stop size="sm" className="w-full min-w-0" onClick={onStop}>
              <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-[2px] bg-current" />
              <span className="truncate">Stop and use</span>
            </Button>
          </Tooltip>
          <Tooltip label="Stop and discard this recording">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (view.savedSeconds >= CONFIRM_CANCEL_AFTER_SEC ? setConfirming(true) : onCancel())}
            >
              Cancel
            </Button>
          </Tooltip>
        </div>
      )}
    </Card>
  );
}

export function SavingCard({ seconds }: { seconds: number }) {
  return (
    <Card label="Saving recording">
      <div className="flex items-center gap-2" aria-busy="true">
        <Icon name="circle-notch" size={16} tone="inherit" className="shrink-0 animate-spin text-accent motion-reduce:animate-none" />
        <span className="text-xs font-semibold">Saving recording…</span>
        {seconds > 0 && <span className="ml-auto text-sm font-semibold tabular-nums">{formatElapsed(seconds)}</span>}
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">Finalizing and checking the audio</p>
    </Card>
  );
}

/** Where recordings go when no folder is open, with Change (Phase 0 §2.1). */
export function NoFolderLocation({ location }: { location: string }) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10.5px] text-ink-muted">
      <Icon name="folder-open" size={12} tone="inherit" className="shrink-0" />
      <Tooltip className="min-w-0" label={location}>
        <span className="truncate">Recordings are saved in {shortFolder(location)}</span>
      </Tooltip>
      <Tooltip className="shrink-0" label="Choose where recordings are saved">
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0 py-0 text-[10.5px] font-semibold has-[>svg]:px-0"
          onClick={() => post({ type: 'transcribe:record/changeLocation' })}
        >
          Change
        </Button>
      </Tooltip>
    </div>
  );
}

export function RecordingProblem({ host, platform }: { host: RecordingProjection; platform: string }) {
  if (host.error) {
    const canOpenSettings = host.error.code === 'os-denied' && (platform === 'darwin' || platform === 'win32');
    return (
      <Card tone="error">
        <p className="text-xs leading-relaxed text-ritemark-error">{host.error.message}</p>
        <div className="mt-2 flex gap-2">
          {canOpenSettings && (
            <Tooltip label="Open the system privacy settings to allow Ritemark to use the microphone">
              <Button variant="secondary" size="sm" onClick={() => post({ type: 'transcribe:record/openMicrophoneSettings' })}>
                Microphone Settings
              </Button>
            </Tooltip>
          )}
          <Tooltip label="Hide this message">
            <Button variant="secondary" size="sm" onClick={() => post({ type: 'transcribe:record/dismissNotice' })}>
              Dismiss
            </Button>
          </Tooltip>
        </div>
      </Card>
    );
  }
  if (host.notice) {
    return (
      <Card tone="neutral">
        <div className="flex items-start gap-2">
          <Icon name="info" size={16} tone="inherit" className="mt-px shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-body">{host.notice}</p>
        </div>
        <div className="mt-2">
          <Tooltip label="Hide this message">
            <Button variant="secondary" size="sm" onClick={() => post({ type: 'transcribe:record/dismissNotice' })}>
              Dismiss
            </Button>
          </Tooltip>
        </div>
      </Card>
    );
  }
  return null;
}

export function InterruptedRecordingRow({ partial }: { partial: InterruptedRecording }) {
  const full = fullPath(partial.folderLabel, partial.fileName);
  return (
    <div className="mx-3 mb-2 rounded-lg border border-ritemark-warning/40 bg-ritemark-warning-soft/60 p-2.5">
      <div className="text-xs font-semibold">Recording interrupted · about {formatDuration(partial.durationSec)}</div>
      <Tooltip className="mt-0.5 flex min-w-0" side="top" label={full}>
        <span className="truncate text-[10.5px] text-ink-muted">{displayPath(partial.folderLabel, partial.fileName)}</span>
      </Tooltip>
      <p className="mt-1 text-[10.5px] leading-relaxed text-ink-body">Ritemark closed before the file was finalized.</p>
      <div className="mt-2 flex gap-2">
        <Tooltip className="min-w-0 flex-1" label="Save what was recorded, then choose how to transcribe it">
          <Button size="sm" className="w-full min-w-0" onClick={() => post({ type: 'transcribe:record/recover', partialId: partial.id })}>
            <span className="truncate">Save recording</span>
          </Button>
        </Tooltip>
        <Tooltip label="Move the interrupted recording to the Trash">
          <Button variant="secondary" size="sm" onClick={() => post({ type: 'transcribe:record/discard', partialId: partial.id })}>
            Discard
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * One polite status line for screen readers (design: announce start, saving,
 * and each end state once). Never moves focus.
 */
export function useRecordingAnnouncement(view: CaptureView, host: RecordingProjection | null): string {
  const [message, setMessage] = useState('');
  const previous = useRef(view.phase);
  const lastProblem = useRef<string | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = view.phase;
    if (before === view.phase) return;
    if (view.phase === 'permission') setMessage('Waiting for microphone permission');
    else if (view.phase === 'recording') setMessage('Recording started');
    else if (view.phase === 'stopping') setMessage('Saving recording');
    else if (view.phase === 'idle' && before === 'stopping' && !host?.error) setMessage('Recording saved');
  }, [view.phase, host?.error]);

  useEffect(() => {
    const problem = host?.error?.message ?? host?.notice ?? null;
    if (problem && problem !== lastProblem.current) setMessage(problem);
    lastProblem.current = problem;
  }, [host?.error?.message, host?.notice]);

  return message;
}
