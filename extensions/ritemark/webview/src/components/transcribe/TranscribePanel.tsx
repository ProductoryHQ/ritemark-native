/**
 * Sprint 108 R1/R13 — the Transcribe activity-bar app.
 *
 * A launcher and a queue (Option B): import a recording, choose an engine
 * knowingly, watch the job, open the result. The transcript itself lives in the
 * workbench editor (Phase 4).
 *
 * Two things this surface refuses to do:
 *   - start anything before the user has chosen an engine, because that choice
 *     is where the privacy/cost trade is made (N2, N7);
 *   - hide an unavailable engine. On Windows the on-device card stays visible
 *     and says why (D4/#133), rather than the feature quietly shrinking.
 */

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { vscode } from '../../lib/vscode';
import {
  formatDuration,
  formatRelativeDate,
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
        <Button
          className="w-full"
          size="lg"
          onClick={() => vscode.postMessage({ type: 'transcribe:pickFile' })}
          disabled={nothingReady && !state.pending}
        >
          <Icon name="plus" size={14} />
          Add recording
        </Button>
        {dragging && (
          <div className="mt-2 rounded-lg border border-dashed border-accent bg-accent-soft/40 px-3 py-4 text-center text-xs text-accent-deep">
            Drop the recording here
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
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

        {attentionJobs.length > 0 && (
          <Section title="Needs attention">
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

        {!state.pending && !nothingReady && state.recordings.length === 0 && activeJobs.length === 0 && (
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
                Add a recording to transcribe it.
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
        <Button
          className="flex-1"
          size="sm"
          disabled={!selected?.readiness.ready}
          onClick={() =>
            vscode.postMessage({ type: 'transcribe:start', engineId: selectedEngineId, language: null })
          }
        >
          <Icon name="play" size={14} />
          Transcribe
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => vscode.postMessage({ type: 'transcribe:clearPending' })}
        >
          Cancel
        </Button>
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          title="Cancel"
          onClick={() => vscode.postMessage({ type: 'transcribe:cancel', jobId: job.id })}
        >
          <Icon name="x" size={14} />
        </Button>
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

function RecordingRow({ recording }: { recording: RecordingSummary }) {
  return (
    <div
      className="group flex cursor-pointer items-center gap-2.5 px-4 py-2 hover:bg-surface-soft"
      onClick={() => vscode.postMessage({ type: 'transcribe:openSession', sessionId: recording.sessionId })}
    >
      <Icon name="microphone" size={16} className="shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium" title={recording.audioName}>
          {recording.audioName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-ink-muted">
          <span
            className={[
              'rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide',
              recording.engine === 'elevenlabs'
                ? 'bg-accent-soft text-accent-deep'
                : 'bg-ritemark-success-soft text-ritemark-success',
            ].join(' ')}
          >
            {recording.engine === 'elevenlabs' ? 'ElevenLabs' : 'On-device'}
          </span>
          <span className="truncate">
            {formatDuration(recording.durationSec)}
            {recording.speakerSeparation === 'diarized' && recording.speakerCount > 0
              ? ` · ${recording.speakerCount} speakers`
              : ''}
            {` · ${formatRelativeDate(recording.createdAt)}`}
          </span>
        </div>
        {/* Its own line, not inline with the metadata: the sidebar is narrow and
            competing for that row truncated the duration. Only set for rows from
            elsewhere, so the list never leaves you guessing where one is from. */}
        {recording.projectName && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-faint">
            <Icon name="folder-open" size={12} className="shrink-0" />
            <span className="truncate" title={`Transcribed in ${recording.projectName}`}>
              {recording.projectName}
            </span>
          </div>
        )}
        {recording.audioMissing && (
          <div className="mt-1 flex items-center gap-2">
            {/* R12: the transcript is intact — only the path went stale. Offer
                to find the file rather than implying anything was lost. */}
            <span className="text-[10px] text-ritemark-warning">Recording moved or deleted</span>
            <button
              type="button"
              className="text-[10px] font-semibold text-accent hover:underline"
              onClick={(event) => {
                event.stopPropagation();
                vscode.postMessage({ type: 'transcribe:relinkSession', sessionId: recording.sessionId });
              }}
            >
              Find it
            </button>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 group-hover:opacity-100"
        title="Open saved document"
        onClick={(event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'transcribe:openExport', sessionId: recording.sessionId });
        }}
      >
        <Icon name="file-text" size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 group-hover:opacity-100"
        title="Remove transcript"
        onClick={(event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'transcribe:deleteSession', sessionId: recording.sessionId });
        }}
      >
        <Icon name="trash" size={14} />
      </Button>
    </div>
  );
}
