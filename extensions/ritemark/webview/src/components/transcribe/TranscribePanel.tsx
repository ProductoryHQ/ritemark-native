/**
 * Sprint 108 R1/R13 — the Transcribe activity-bar app.
 *
 * A launcher and a queue (Option B): import a recording, choose an engine
 * knowingly, watch the job, open the result. The transcript itself lives in the
 * workbench editor (Phase 4).
 *
 * Sprint 118 adds Record beside Add recording: a finished recording is a plain
 * WAV that lands in the same engine-choice card as an added file.
 *
 * Two things this surface refuses to do:
 *   - start anything before the user has chosen an engine, because that choice
 *     is where the privacy/cost trade is made (N2, N7);
 *   - hide an unavailable engine. On Windows the on-device card stays visible
 *     and says why (D4/#133), rather than the feature quietly shrinking.
 */

import { useEffect, useMemo, useState } from 'react';
import { Icon, type PhosphorIconName as IconName } from '../ui/Icon';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreActionsTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { vscode } from '../../lib/vscode';
import {
  InterruptedRecordingRow,
  LiveRecordingCard,
  NoFolderLocation,
  PermissionCard,
  RecordDot,
  RecordingProblem,
  SavingCard,
  useRecordingAnnouncement,
} from './recording/RecordingCards';
import { useTranscribeRecording } from './recording/useTranscribeRecording';
import {
  formatDuration,
  formatRecordingDate,
  isActiveJob,
  phaseLabel,
  type EngineStatus,
  type RecordingSummary,
  type TranscribeState,
  type TranscriptionJob,
} from './types';

export function TranscribePanel() {
  const [state, setState] = useState<TranscribeState | null>(null);
  const [rejected, setRejected] = useState<{ fileName: string; reason: string } | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const recording = useTranscribeRecording(state?.recording ?? null);
  const announcement = useRecordingAnnouncement(recording.view, state?.recording ?? null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'transcribe:state') {
        setState(message.data as TranscribeState);
        if (message.data.pending) setRejected(null);
      } else if (message?.type === 'transcribe:importRejected') {
        setRejected({ fileName: message.fileName, reason: message.reason });
      }
    };
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'transcribe:ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Follow the host's preference until the user overrides it for this import.
  const pendingEngine = selectedEngine ?? state?.preferredEngineId ?? null;

  const usableEngines = useMemo(
    () => (state?.engines ?? []).filter((engine) => engine.supportedOnPlatform && engine.readiness.ready),
    [state],
  );

  if (!state) {
    return <div className="p-4 text-xs text-ink-muted">Loading…</div>;
  }

  const activeJobs = state.jobs.filter(isActiveJob);
  const attentionJobs = state.jobs.filter(
    (job) => job.state === 'failed' || job.state === 'interrupted',
  );
  const nothingReady = usableEngines.length === 0;

  // Sprint 118: what the recording surfaces show. The capture phase is the
  // webview's own; the host phase covers a save still finishing after it.
  const host = state.recording ?? null;
  const capture = recording.view;
  const recordingBusy = capture.phase !== 'idle' || (host !== null && host.phase !== 'idle');
  const showSaving = capture.phase === 'stopping' || (capture.phase === 'idle' && host?.phase === 'finalizing');
  const partials = host?.partials ?? [];

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);

    // Files dragged from the VS Code Explorer arrive as a uri-list. Files
    // dragged from Finder no longer expose a filesystem path to the renderer,
    // so that case is routed to the picker instead of failing silently.
    const uriList = event.dataTransfer.getData('text/uri-list');
    const firstUri = uriList.split(/\r?\n/).find((line) => line.trim() && !line.startsWith('#'));
    if (firstUri) {
      const decoded = decodeURIComponent(firstUri.replace(/^file:\/\//, '').trim());
      vscode.postMessage({ type: 'transcribe:importPath', path: decoded });
      return;
    }

    const dropped = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
    if (dropped?.path) {
      vscode.postMessage({ type: 'transcribe:importPath', path: dropped.path });
      return;
    }

    setRejected({
      fileName: dropped?.name ?? 'That file',
      reason: 'Files dragged from Finder cannot be read directly. Use Add recording to pick it instead.',
    });
  };

  return (
    <div
      className="flex flex-col h-full text-ink-strong"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Settings lives in the view's TITLE BAR (package.json view/title), not
          here — a second gear inside the panel body puts it on its own row
          below the title, which reads as a stray control. */}
      <div className="p-3 pb-2">
        {/* One row at every width: Add recording, with Record as an icon
            button beside it (Jarmo, 2026-09-22 RunDev review). */}
        <div className="flex gap-2">
          <Tooltip
            className="min-w-0 flex-1"
            label={nothingReady && !state.pending ? 'Set up a transcription engine first' : 'Choose an audio file to transcribe'}
          >
            {/* At 200% zoom the sidebar is narrow: the label ellipsizes rather
                than overflowing the button; the tooltip keeps the full name. */}
            <Button
              className="w-full min-w-0"
              size="lg"
              onClick={() => vscode.postMessage({ type: 'transcribe:pickFile' })}
              disabled={nothingReady && !state.pending}
            >
              <Icon name="plus" size={14} />
              <span className="truncate">Add recording</span>
            </Button>
          </Tooltip>
          {host?.enabled && (
            <Tooltip
              className="shrink-0"
              label={
                recordingBusy
                  ? 'A recording is in progress'
                  : nothingReady
                    ? 'Set up a transcription engine first'
                    : 'Record from the microphone'
              }
            >
              <Button
                className="rounded-lg"
                size="icon-lg"
                aria-label="Record"
                onClick={() => recording.start()}
                disabled={nothingReady || recordingBusy}
              >
                <RecordDot size="lg" />
              </Button>
            </Tooltip>
          )}
        </div>
        {host?.enabled && !host.hasProject && host.noFolderLocation && capture.phase === 'idle' && (
          <NoFolderLocation location={host.noFolderLocation} />
        )}
        {dragging && (
          <div className="mt-2 rounded-lg border border-dashed border-accent bg-accent-soft/40 px-3 py-4 text-center text-xs text-accent-deep">
            Drop the recording here
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>

        {host && capture.phase === 'idle' && !showSaving && <RecordingProblem host={host} platform={state.platform} />}
        {capture.phase === 'permission' && <PermissionCard onCancel={() => recording.cancel()} />}
        {capture.phase === 'recording' && host && (
          <LiveRecordingCard
            view={capture}
            host={host}
            onStop={() => recording.stop()}
            onCancel={() => recording.cancel()}
          />
        )}
        {showSaving && <SavingCard seconds={capture.savedSeconds} />}

        {rejected && (
          <div className="mx-3 mb-3 rounded-lg border border-ritemark-error/40 bg-ritemark-error-soft p-3">
            <div className="text-xs font-semibold text-ritemark-error">{rejected.fileName}</div>
            <p className="mt-1 text-xs leading-relaxed text-ritemark-error">{rejected.reason}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setRejected(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {state.pending && (
          <PendingImportCard
            state={state}
            selectedEngineId={pendingEngine}
            onSelectEngine={setSelectedEngine}
          />
        )}

        {!state.pending && nothingReady && <FirstRun engines={state.engines} />}

        {activeJobs.length > 0 && (
          <Section title="Transcribing">
            {activeJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </Section>
        )}

        {(attentionJobs.length > 0 || partials.length > 0) && (
          <Section title="Needs attention">
            {partials.map((partial) => (
              <InterruptedRecordingRow key={partial.id} partial={partial} />
            ))}
            {attentionJobs.map((job) => (
              <AttentionRow key={job.id} job={job} />
            ))}
          </Section>
        )}

        {state.recordings.length > 0 && (
          <Section title={state.showAllProjects ? 'All projects' : 'Library'} count={state.recordings.length}>
            {state.recordings.map((recording) => (
              <RecordingRow key={recording.sessionId} recording={recording} />
            ))}
          </Section>
        )}

        {!state.pending && !nothingReady && !recordingBusy && state.recordings.length === 0 && activeJobs.length === 0 && (
          <p className="px-4 py-6 text-center text-xs leading-relaxed text-ink-muted">
            {state.otherProjectCount > 0 ? (
              // The library is project-scoped, so an empty list here does NOT
              // mean an empty library. Saying only "add a recording" made
              // transcripts that were safe on disk look deleted.
              <>
                No recordings in this project yet.
                <br />
                {state.otherProjectCount === 1
                  ? 'There is 1 in another project.'
                  : `There are ${state.otherProjectCount} in other projects.`}
              </>
            ) : (
              <>
                {host?.enabled ? 'Record or add a recording to transcribe it.' : 'Add a recording to transcribe it.'}
                <br />
                {state.acceptedExtensions.join(', ')}
              </>
            )}
          </p>
        )}

        {/* Present whenever recordings exist outside this project, empty list or
            not — the whole point is that hidden recordings are never silent. */}
        {state.otherProjectCount > 0 && (
          <div className="px-4 pb-4 pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() =>
                vscode.postMessage({ type: 'transcribe:setScope', showAll: !state.showAllProjects })
              }
            >
              {state.showAllProjects
                ? 'Show only this project'
                : `Show all projects (${state.otherProjectCount} more)`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
        <span>{title}</span>
        {count !== undefined && <span className="font-semibold normal-case tracking-normal">· {count}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * The engine choice, made once per recording with the trade stated in full:
 * what leaves the machine, what it costs, and what it can and cannot do.
 */
function PendingImportCard({
  state,
  selectedEngineId,
  onSelectEngine,
}: {
  state: TranscribeState;
  selectedEngineId: string | null;
  onSelectEngine: (id: string) => void;
}) {
  const pending = state.pending!;
  const selected = state.engines.find((engine) => engine.id === selectedEngineId) ?? null;
  const estimate = pending.estimates.find((entry) => entry.engineId === selectedEngineId);

  return (
    <div className="mx-3 mb-3 rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-start gap-2">
        <Icon name="microphone" size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold" title={pending.audioName}>
            {pending.audioName}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">{formatDuration(pending.durationSec)}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {state.engines.map((engine) => (
          <EngineChoice
            key={engine.id}
            engine={engine}
            selected={engine.id === selectedEngineId}
            costUsd={pending.estimates.find((entry) => entry.engineId === engine.id)?.costUsd ?? null}
            onSelect={() => onSelectEngine(engine.id)}
          />
        ))}
      </div>

      {selected && !selected.isLocal && selected.readiness.ready && (
        <div className="mt-2.5 rounded-md border border-ritemark-warning/40 bg-ritemark-warning-soft px-2.5 py-2">
          <p className="text-[11px] leading-relaxed text-ritemark-warning-foreground">
            <strong className="font-semibold">This uploads your audio to ElevenLabs.</strong>{' '}
            {pending.durationSec === null
              ? 'Length unknown, so the cost cannot be estimated up front — ElevenLabs charges about $0.22 per hour.'
              : `${formatDuration(pending.durationSec)} ≈ $${(estimate?.costUsd ?? 0).toFixed(2)}.`}{' '}
            On-device keeps it on this Mac, but cannot separate speakers.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Tooltip
          className="min-w-0 flex-1"
          label={selected?.readiness.ready ? 'Start transcribing with the selected engine' : 'Choose an engine that is ready'}
        >
          <Button
            className="w-full"
            size="sm"
            disabled={!selected?.readiness.ready}
            onClick={() =>
              vscode.postMessage({ type: 'transcribe:start', engineId: selectedEngineId, language: null })
            }
          >
            <Icon name="play" size={14} />
            Transcribe
          </Button>
        </Tooltip>
        <Tooltip label="Don't transcribe now. The audio file stays where it is.">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => vscode.postMessage({ type: 'transcribe:clearPending' })}
          >
            Cancel
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function EngineChoice({
  engine,
  selected,
  costUsd,
  onSelect,
}: {
  engine: EngineStatus;
  selected: boolean;
  costUsd: number | null;
  onSelect: () => void;
}) {
  const usable = engine.supportedOnPlatform && engine.readiness.ready;

  return (
    <button
      type="button"
      onClick={usable ? onSelect : undefined}
      disabled={!usable}
      className={[
        'w-full rounded-md border px-2.5 py-2 text-left transition-colors',
        selected ? 'border-accent bg-accent-soft/50' : 'border-hairline bg-surface-soft/40',
        usable ? 'hover:border-accent-fainter' : 'cursor-default opacity-70',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'size-3 shrink-0 rounded-full border',
            selected ? 'border-[5px] border-accent' : 'border-hairline-strong',
          ].join(' ')}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{engine.label}</span>
        {usable && (
          <span className="shrink-0 text-[10px] font-semibold text-ink-muted">
            {costUsd === null ? 'Free' : costUsd === 0 ? 'Free' : `$${costUsd.toFixed(2)}`}
          </span>
        )}
      </div>
      <div className="mt-1 pl-5 text-[10.5px] leading-relaxed text-ink-muted">
        {usable
          ? engine.isLocal
            ? 'Private — audio never leaves this device. No speaker separation.'
            : 'Separates speakers. Audio is uploaded.'
          : engine.readiness.reason}
      </div>
    </button>
  );
}

/** Nothing is set up yet: show the two engines and one action each. */
function FirstRun({ engines }: { engines: EngineStatus[] }) {
  return (
    <div className="mx-3 mb-3 rounded-lg border border-hairline bg-surface p-3">
      <p className="mb-2.5 text-xs leading-relaxed text-ink-body">
        Transcribe turns a recording into a document you can edit. Set up an engine to begin.
      </p>
      <div className="space-y-2">
        {engines.map((engine) => (
          <div key={engine.id} className="flex items-start gap-2.5 rounded-md bg-surface-soft/50 p-2.5">
            <span
              className={[
                'mt-1 size-2 shrink-0 rounded-full',
                engine.readiness.ready ? 'bg-ritemark-success' : 'bg-ritemark-warning',
              ].join(' ')}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">{engine.label}</div>
              <div className="mt-0.5 text-[10.5px] leading-relaxed text-ink-muted">
                {engine.readiness.ready ? 'Ready' : engine.readiness.reason}
              </div>
            </div>
            <EngineAction engine={engine} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EngineAction({ engine }: { engine: EngineStatus }) {
  if (engine.readiness.ready) return null;

  if (engine.readiness.action === 'download-model') {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={() => vscode.postMessage({ type: 'transcribe:downloadModel' })}
      >
        Download
      </Button>
    );
  }
  if (engine.readiness.action === 'add-api-key') {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={() => vscode.postMessage({ type: 'transcribe:openSettings' })}
      >
        Add key
      </Button>
    );
  }
  if (!engine.supportedOnPlatform) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => vscode.postMessage({ type: 'transcribe:openIssue' })}
      >
        Why?
      </Button>
    );
  }
  return null;
}

function JobRow({ job }: { job: TranscriptionJob }) {
  const percent = job.progress.percent;

  return (
    <div className="mx-3 mb-2 rounded-lg border border-accent-fainter bg-accent-soft/25 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold" title={job.audioName}>
            {job.audioName}
          </div>
          <div className="mt-0.5 text-[10.5px] text-ink-muted">
            {formatDuration(job.durationSec)} · {job.engine === 'elevenlabs' ? 'ElevenLabs' : 'On-device'}
          </div>
        </div>
        <Tooltip className="shrink-0" label="Cancel transcription">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel transcription"
            onClick={() => vscode.postMessage({ type: 'transcribe:cancel', jobId: job.id })}
          >
            <Icon name="x" size={14} />
          </Button>
        </Tooltip>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hairline">
        {/* An indeterminate phase gets a moving bar, never a fabricated
            percentage — a diarized Scribe request has no server-side progress. */}
        <div
          className={['h-full rounded-full bg-accent', percent === null ? 'w-1/3 animate-pulse' : ''].join(' ')}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[10.5px] font-semibold text-accent-deep">
        <span>
          {phaseLabel(job)}
          {percent !== null ? ` · ${percent}%` : ''}
        </span>
      </div>
    </div>
  );
}

function AttentionRow({ job }: { job: TranscriptionJob }) {
  const interrupted = job.state === 'interrupted';
  return (
    <div className="mx-3 mb-2 rounded-lg border border-ritemark-error/30 bg-ritemark-error-soft/60 p-2.5">
      <div className="truncate text-xs font-semibold" title={job.audioName}>
        {job.audioName}
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-ritemark-error">
        {job.error?.message ?? (interrupted ? 'Interrupted.' : 'Transcription failed.')}
      </p>
      <div className="mt-2 flex gap-2">
        {job.error?.retryable !== false && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => vscode.postMessage({ type: 'transcribe:importPath', path: job.audioPath })}
          >
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

type RecordingAction = { label: string; icon: IconName; danger?: boolean; disabled?: boolean; run: () => void };

/** One list of actions for the row's ⋮ menu and its right-click menu (#371). */
function recordingActions(recording: RecordingSummary): RecordingAction[] {
  const post = (type: string) => () => vscode.postMessage({ type, sessionId: recording.sessionId });
  return [
    ...(recording.exportPath
      ? [{ label: 'Open saved document', icon: 'file-text' as IconName, run: post('transcribe:openExport') }]
      : []),
    { label: 'Rename…', icon: 'pencil-simple', disabled: recording.audioMissing, run: post('transcribe:renameSession') },
    { label: 'Remove transcript', icon: 'trash', danger: true, run: post('transcribe:deleteSession') },
  ];
}

// v1.13.0 (#371): the title takes the row's full width and wraps to two lines; the second line is
// the date and length; a third line appears only for a row from another project or a moved file.
// The More actions (…) button stands at the top right, level with the title's first line, and shows on hover,
// on keyboard focus and while its menu is open.
function RecordingRow({ recording }: { recording: RecordingSummary }) {
  const actions = recordingActions(recording);
  const title = recording.audioName;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-soft">
          <button
            type="button"
            aria-label={`Open ${title}`}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            onClick={() => vscode.postMessage({ type: 'transcribe:openSession', sessionId: recording.sessionId })}
          />
          {/* Beside the title's first line (13px at 1.5), however many lines follow. */}
          <Icon name="microphone" size={16} className="mt-[1.75px] shrink-0 text-ink-muted" />
          <div className="pointer-events-none relative min-w-0 flex-1">
            <div className="line-clamp-2 break-words text-[13px] font-medium text-ink-strong">{title}</div>
            <div className="mt-0.5 truncate text-[11px] text-ink-muted">
              {[formatRecordingDate(recording.createdAt), formatDuration(recording.durationSec)].filter(Boolean).join(' · ')}
            </div>
            {recording.projectName && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
                <Icon name="folder-open" size={12} className="shrink-0" />
                <span className="truncate">Transcribed in {recording.projectName}</span>
              </div>
            )}
            {recording.audioMissing && (
              // R12: the transcript is intact — only the path went stale. Offer to
              // find the file rather than implying anything was lost.
              <div className="mt-1 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px]">
                <span className="truncate text-ritemark-warning">Recording moved or deleted</span>
                <Tooltip label="Choose where the recording is now. The transcript is kept.">
                  <Button
                    variant="link"
                    size="sm"
                    className="pointer-events-auto relative z-10 h-auto shrink-0 p-0 text-[11px] font-semibold"
                    onClick={() => vscode.postMessage({ type: 'transcribe:relinkSession', sessionId: recording.sessionId })}
                  >
                    Find it
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
          <DropdownMenu modal={false}>
            <MoreActionsTrigger
              label={`More actions for ${title}`}
              className="relative z-10 -mr-1.5 -mt-[2.25px] opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            />
            <DropdownMenuContent align="end">
              {actions.map((action) => [
                action.danger && <DropdownMenuSeparator key={`${action.label}-separator`} />,
                <DropdownMenuItem key={action.label} tone={action.danger ? 'danger' : 'default'} disabled={action.disabled} onSelect={action.run}>
                  <Icon name={action.icon} size={14} />
                  {action.label}
                </DropdownMenuItem>,
              ])}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action) => [
          action.danger && <ContextMenuSeparator key={`${action.label}-separator`} />,
          <ContextMenuItem
            key={action.label}
            disabled={action.disabled}
            // Matches DropdownMenuItem, so the right-click menu and the More actions menu read as one.
            className={`gap-2 text-[13px] [&_svg]:shrink-0 [&_svg]:fill-current${action.danger ? ' text-[var(--r-error)] focus:text-[var(--r-error)]' : ''}`}
            onSelect={action.run}
          >
            <Icon name={action.icon} size={14} />
            {action.label}
          </ContextMenuItem>,
        ])}
      </ContextMenuContent>
    </ContextMenu>
  );
}
