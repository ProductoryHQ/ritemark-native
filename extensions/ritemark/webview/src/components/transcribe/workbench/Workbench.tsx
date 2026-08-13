/**
 * Sprint 108 R6–R9 — the Transcript Workbench.
 *
 * The surface Option B is built around: player on top, speaker-separated
 * transcript in the middle, click a line to hear it. This is where a quote gets
 * verified before it goes to a client — the trust mechanism the whole option
 * was chosen for.
 *
 * Playback rule from audit A3: the FIRST play must ride a real user gesture.
 * Every `play()` here hangs off a click, and nothing auto-plays on open.
 */

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/button';
import { vscode } from '../../../lib/vscode';
import { Waveform } from './Waveform';
import {
  activeSegmentIndex,
  formatClock,
  isLowConfidence,
  segmentsForSpeaker,
  speakerColor,
  speakerLabelFor,
  type WorkbenchSegment,
  type WorkbenchSpeaker,
  type WorkbenchWord,
} from './playback';

interface EngineStatus {
  id: string;
  label: string;
  isLocal: boolean;
  diarization: boolean;
  supportedOnPlatform: boolean;
  readiness: { ready: boolean; reason?: string; action?: string };
}

interface Session {
  id: string;
  audioPath: string;
  durationSec: number;
  engine: string;
  language: string | null;
  speakerSeparation: 'none' | 'diarized';
  speakers: WorkbenchSpeaker[];
  segments: WorkbenchSegment[];
  peaks: number[];
  costUsd?: number;
}

interface WorkbenchState {
  audioUri: string;
  audioName: string;
  session: Session | null;
  job: { state: string; progress: { percent: number | null } } | null;
  engines: EngineStatus[];
  /** A Markdown export already exists on disk for this recording (R11). */
  hasExport?: boolean;
}

const SPEEDS = [1, 1.25, 1.5, 2];

export function Workbench() {
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [followPlayback, setFollowPlayback] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'workbench:state') setState(event.data.data as WorkbenchState);
    };
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'workbench:ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const session = state?.session ?? null;
  const segments = session?.segments ?? [];
  const activeIndex = useMemo(() => activeSegmentIndex(segments, currentTime), [segments, currentTime]);

  // Duration comes from the element once metadata loads; the session's stored
  // value can be 0 when the length could not be probed before transcribing.
  const [audioDuration, setAudioDuration] = useState(0);
  const durationSec = audioDuration || session?.durationSec || 0;

  const seek = useCallback((seconds: number, andPlay = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, seconds);
    setCurrentTime(audio.currentTime);
    setFollowPlayback(true);
    if (andPlay && audio.paused) void audio.play().catch(() => undefined);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  // Keyboard: space toggles, arrows skip. Bound on the container rather than
  // the document so it cannot fight the editor's own shortcuts.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault();
      togglePlay();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      seek(currentTime - 5);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      seek(currentTime + 5);
    }
  };

  useEffect(() => {
    if (!followPlayback || !playing) return;
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, followPlayback, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed, state?.audioUri]);

  if (!state) return <div className="p-6 text-sm text-ink-muted">Loading…</div>;

  if (!session) {
    return <NoSession state={state} />;
  }

  const lowConfidenceEngine = session.engine;

  return (
    <div className="flex h-full flex-col outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <audio
        ref={audioRef}
        src={state.audioUri}
        preload="metadata"
        onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <header className="shrink-0 border-b border-hairline bg-surface-muted px-5 py-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight">{state.audioName}</h1>
            <div className="mt-0.5 text-[11px] text-ink-muted">
              {session.engine === 'elevenlabs' ? 'ElevenLabs Scribe' : 'On-device · Whisper'}
              {session.language ? ` · ${session.language}` : ''}
              {session.speakerSeparation === 'diarized'
                ? ` · ${session.speakers.length} speakers`
                : ' · no speaker separation'}
              {session.costUsd ? ` · $${session.costUsd.toFixed(2)}` : ''}
            </div>
          </div>

          {/* The transcript is already on disk — an export was written when the
              transcription finished (R11). This updates it after corrections. */}
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => vscode.postMessage({ type: 'workbench:export' })}
          >
            {state.hasExport ? 'Update Markdown' : 'Export to Markdown'}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-ritemark-accent transition-all active:scale-[0.98] hover:bg-accent-deep"
            title={playing ? 'Pause' : 'Play'}
          >
            {/* The icon pack has no pause glyph, and a minus reads as "remove".
                Two bars is the universal mark and costs two divs. */}
            {playing ? (
              <span className="flex gap-[3px]">
                <span className="block h-3.5 w-[3px] rounded-full bg-current" />
                <span className="block h-3.5 w-[3px] rounded-full bg-current" />
              </span>
            ) : (
              <Icon name="play" size={14} />
            )}
          </button>

          <Waveform
            peaks={session.peaks}
            durationSec={durationSec}
            currentTime={currentTime}
            onSeek={(seconds) => seek(seconds)}
          />

          <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-muted">
            {formatClock(currentTime)} / {formatClock(durationSec)}
          </span>

          <button
            type="button"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className="shrink-0 rounded-md border border-hairline-strong bg-surface px-2 py-1 text-[11px] font-semibold text-ink-body hover:border-accent hover:text-accent"
          >
            {speed}×
          </button>
        </div>
      </header>

      <SpeakerBar
        session={session}
        engines={state.engines}
        renaming={renaming}
        renameValue={renameValue}
        onStartRename={(speaker) => {
          setRenaming(speaker.id);
          setRenameValue(speaker.label);
        }}
        onChangeRename={setRenameValue}
        onCancelRename={() => setRenaming(null)}
        onCommitRename={(speakerId) => {
          vscode.postMessage({ type: 'workbench:renameSpeaker', speakerId, label: renameValue });
          setRenaming(null);
        }}
      />

      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto px-5 py-4"
        onWheel={() => setFollowPlayback(false)}
      >
        <div className="mx-auto max-w-3xl">
          {segments.map((segment, index) => (
            <SegmentRow
              key={segment.id}
              ref={index === activeIndex ? activeRef : undefined}
              segment={segment}
              speakers={session.speakers}
              previousSpeaker={index > 0 ? segments[index - 1].speaker : undefined}
              active={index === activeIndex}
              engine={lowConfidenceEngine}
              onSeek={() => seek(segment.start, true)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** No transcript yet: offer to make one, with the same honest engine choice. */
function NoSession({ state }: { state: WorkbenchState }) {
  const job = state.job;
  const usable = state.engines.filter((engine) => engine.supportedOnPlatform && engine.readiness.ready);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight">{state.audioName}</h1>

        {job ? (
          <>
            <p className="mt-2 text-sm text-ink-body">Transcribing…</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-hairline">
              <div
                className={['h-full rounded-full bg-accent', job.progress.percent === null ? 'w-1/3 animate-pulse' : ''].join(' ')}
                style={job.progress.percent === null ? undefined : { width: `${job.progress.percent}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-body">
              This recording has not been transcribed yet.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {usable.map((engine) => (
                <Button
                  key={engine.id}
                  variant={engine.isLocal ? 'default' : 'secondary'}
                  onClick={() => vscode.postMessage({ type: 'workbench:transcribe', engineId: engine.id })}
                >
                  Transcribe with {engine.label}
                </Button>
              ))}
              {usable.length === 0 && (
                <>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    No transcription engine is ready yet.
                  </p>
                  <Button variant="secondary" onClick={() => vscode.postMessage({ type: 'workbench:openSettings' })}>
                    Open Settings
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SpeakerBar({
  session,
  engines,
  renaming,
  renameValue,
  onStartRename,
  onChangeRename,
  onCancelRename,
  onCommitRename,
}: {
  session: Session;
  engines: EngineStatus[];
  renaming: string | null;
  renameValue: string;
  onStartRename: (speaker: WorkbenchSpeaker) => void;
  onChangeRename: (value: string) => void;
  onCancelRename: () => void;
  onCommitRename: (speakerId: string) => void;
}) {
  // D3/R8: the on-device engine cannot separate speakers, so there are no chips
  // to show. Say so and offer the path that can, rather than rendering an empty
  // bar that reads as "nobody spoke".
  if (session.speakerSeparation === 'none') {
    const cloud = engines.find((engine) => !engine.isLocal);
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-5 py-2">
        <Icon name="info" size={14} className="shrink-0 text-ink-faint" />
        <span className="text-[11px] text-ink-muted">
          On-device transcription cannot separate speakers.
        </span>
        {cloud?.readiness.ready && (
          <button
            type="button"
            className="ml-auto shrink-0 text-[11px] font-semibold text-accent hover:underline"
            onClick={() => vscode.postMessage({ type: 'workbench:transcribe', engineId: cloud.id })}
          >
            Re-run with {cloud.label}
          </button>
        )}
      </div>
    );
  }

  const unattributed = session.segments.filter((segment) => !segment.speaker).length;

  return (
    <div className="relative flex shrink-0 flex-wrap items-center gap-1.5 border-b border-hairline px-5 py-2">
      {session.speakers.map((speaker) => {
        const color = speakerColor(speaker.colorIndex);
        const isRenaming = renaming === speaker.id;
        return (
          <div key={speaker.id} className="relative">
            <button
              type="button"
              onClick={() => onStartRename(speaker)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                isRenaming ? 'border-accent ring-[3px] ring-[var(--r-accent-soft)]' : 'border-hairline hover:border-accent-fainter',
              ].join(' ')}
              title="Rename this speaker everywhere"
            >
              <span className="size-2 rounded-full" style={{ background: color.dot }} />
              {speaker.label}
            </button>

            {isRenaming && (
              <div className="absolute left-0 top-9 z-10 w-64 rounded-lg border border-hairline-strong bg-surface p-3 shadow-lg">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Rename speaker
                </div>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => onChangeRename(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCommitRename(speaker.id);
                    if (event.key === 'Escape') onCancelRename();
                  }}
                  className="w-full rounded-md border border-accent px-2 py-1.5 text-xs text-ink-strong outline-none ring-[3px] ring-[var(--r-accent-soft)]"
                />
                <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                  Applies to all {segmentsForSpeaker(session.segments, speaker.id)} segments spoken by{' '}
                  {speaker.label}.
                </p>
                <div className="mt-2.5 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={onCancelRename}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => onCommitRename(speaker.id)}>
                    Rename
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {unattributed > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-muted">
          <span className="size-2 rounded-full bg-ink-faint" />
          Unassigned · {unattributed}
        </span>
      )}

      <span className="ml-auto text-[10.5px] text-ink-faint">Click a speaker to rename everywhere</span>
    </div>
  );
}

interface SegmentRowProps {
  segment: WorkbenchSegment;
  speakers: WorkbenchSpeaker[];
  previousSpeaker: string | undefined;
  active: boolean;
  engine: string;
  onSeek: () => void;
}

/** forwardRef so the container can scroll the playing line into view. */
const SegmentRow = forwardRef<HTMLDivElement, SegmentRowProps>(function SegmentRow(
  { segment, speakers, previousSpeaker, active, engine, onSeek },
  ref,
) {
  const label = speakerLabelFor(speakers, segment.speaker);
  const speaker = speakers.find((candidate) => candidate.id === segment.speaker);
  const color = speaker ? speakerColor(speaker.colorIndex) : null;
  // Repeat the name only when the speaker changes; on every line of a monologue
  // it is noise.
  const showSpeaker = Boolean(label) && segment.speaker !== previousSpeaker;

  return (
    <div
      ref={ref}
      onClick={onSeek}
      className={[
        'group flex cursor-pointer gap-3 rounded-lg border-l-2 px-3 py-2 transition-colors',
        active ? 'border-accent bg-accent-soft/40' : 'border-transparent hover:bg-surface-muted',
      ].join(' ')}
      title="Click to play from here"
    >
      <div className="w-20 shrink-0 text-right">
        {showSpeaker && (
          <div className="text-[11px] font-bold leading-tight" style={color ? { color: color.text } : undefined}>
            {label}
          </div>
        )}
        <div className="mt-0.5 text-[10px] tabular-nums text-ink-faint">{formatClock(segment.start)}</div>
      </div>
      <p className={['flex-1 text-sm leading-relaxed', active ? 'text-ink-strong' : 'text-ink-body'].join(' ')}>
        <SegmentText segment={segment} engine={engine} />
      </p>
    </div>
  );
});

/**
 * R9: word spans only where they earn their place.
 *
 * Rendering every word of a 600-segment transcript as its own element is tens
 * of thousands of nodes for no benefit, so a segment with nothing uncertain in
 * it renders as plain text.
 */
function SegmentText({ segment, engine }: { segment: WorkbenchSegment; engine: string }) {
  const words = segment.words;
  const hasLowConfidence = useMemo(
    () => Boolean(words?.some((word) => isLowConfidence(word, engine))),
    [words, engine],
  );

  if (!words || !hasLowConfidence) return <>{segment.text}</>;

  return (
    <>
      {words.map((word: WorkbenchWord, index: number) =>
        isLowConfidence(word, engine) ? (
          <span
            key={index}
            className="rounded-sm bg-ritemark-warning-soft decoration-dotted underline-offset-4 [text-decoration-line:underline] [text-decoration-color:var(--r-warning)]"
            title="The engine was unsure about this word"
          >
            {word.text}{' '}
          </span>
        ) : (
          <span key={index}>{word.text} </span>
        ),
      )}
    </>
  );
}
