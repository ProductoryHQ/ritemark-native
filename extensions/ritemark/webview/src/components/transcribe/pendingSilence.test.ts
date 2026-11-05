/**
 * #656 (the Experience lead, 5 November): the pending card for a file with no sound, rendered and clicked.
 *
 * - A recording made here: "No sound was recorded, so there's nothing to transcribe. Check the input in System
 *   Settings ▸ Sound, then record again.", the settings' name a link with its tooltip, in the sheets' quiet note (the
 *   ground's fill, a hairline, a microphone-slash; no amber). Record again is the main button and Cancel stays; no
 *   engine and no Transcribe are offered.
 * - Record again puts the silent file aside and starts a new recording at once.
 * - A silent file from elsewhere says so, with Cancel only.
 * - The live card: "Recording" and the time on one line, "From <input>" on its own muted line, cut with an ellipsis;
 *   the no-sound line with its icon and link.
 *
 * Run: npx tsx webview/src/components/transcribe/pendingSilence.test.ts (from extensions/ritemark)
 */
import assert from 'node:assert/strict';

const posted: Array<Record<string, unknown>> = [];
Object.assign(globalThis, {
  window: { innerWidth: 1024, addEventListener: () => {}, removeEventListener: () => {}, focus: () => {} },
  acquireVsCodeApi: () => ({ postMessage: (message: Record<string, unknown>) => posted.push(message), getState: () => undefined, setState: () => {} }),
});

const React = await import('react');
// JSX here compiles to `React.createElement`; while `clicks` is set, every element's click handler is kept with
// the words on it, so the test can click it (as boardClicks.test.ts).
type Clickable = { label: string; disabled: boolean; onClick: (event: unknown) => unknown };
let clicks: Clickable[] | null = null;
function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return '';
}
(globalThis as unknown as { React: unknown }).React = {
  ...React,
  createElement: (type: Parameters<typeof React.createElement>[0], props: Record<string, unknown> | null, ...children: unknown[]) => {
    if (clicks && props && typeof props.onClick === 'function') {
      clicks.push({ label: String(props['aria-label'] ?? textOf(children)).trim(), disabled: Boolean(props.disabled), onClick: props.onClick as Clickable['onClick'] });
    }
    return (React.createElement as (...args: unknown[]) => unknown)(type, props, ...children);
  },
};
const { createElement } = React;
const { renderToStaticMarkup } = await import('react-dom/server');
const { parse } = await import('node-html-parser');
const { PendingImportCard, recordAgain } = await import('./TranscribePanel');
const { LiveRecordingCard } = await import('./recording/RecordingCards');
const { CaptureSession } = await import('./recording/captureSession');
type TranscribeState = import('./types').TranscribeState;

const SETTINGS = 'System Settings ▸ Sound';

function state(silence: { recordedHere: boolean } | undefined, soundSettings: string | null = SETTINGS): TranscribeState {
  return {
    engines: [
      {
        id: 'whisper-local',
        label: 'On-device',
        isLocal: true,
        supportedOnPlatform: true,
        readiness: { ready: true },
      },
    ],
    jobs: [],
    recordings: [],
    pending: {
      audioPath: '/projects/Harbour/Recording 2026-11-05 20.24.wav',
      audioName: 'Recording 2026-11-05 20.24.wav',
      durationSec: 101,
      estimates: [{ engineId: 'whisper-local', costUsd: 0 }],
      ...(silence ? { silence } : {}),
    },
    preferredEngineId: 'whisper-local',
    platform: 'darwin',
    soundSettings,
    acceptedExtensions: ['.wav'],
    videoExtensions: [],
    otherProjectCount: 0,
    showAllProjects: false,
    hasProject: true,
    recording: null,
  } as unknown as TranscribeState;
}

function render(element: unknown): { html: ReturnType<typeof parse>; text: string; clicks: Clickable[] } {
  clicks = [];
  const markup = renderToStaticMarkup(element as never);
  const found = clicks;
  clicks = null;
  const html = parse(markup);
  return { html, text: html.textContent.replace(/\s+/g, ' ').trim(), clicks: found };
}

const starts: string[] = [];
const card = (silence: { recordedHere: boolean } | undefined, blocked: string | null = null, soundSettings: string | null = SETTINGS) =>
  render(
    createElement(PendingImportCard, {
      state: state(silence, soundSettings),
      selectedEngineId: 'whisper-local',
      onSelectEngine: () => {},
      recordAgain: { blocked, start: () => starts.push('start') },
    }),
  );

// A recording made here with no sound.
{
  const { html, text, clicks: found } = card({ recordedHere: true });
  assert.ok(
    text.includes(`No sound was recorded, so there's nothing to transcribe. Check the input in ${SETTINGS}, then record again.`),
    `the lead's words: ${text}`,
  );
  const note = html.querySelector('[role="note"]');
  assert.ok(note, 'the words are a note');
  const noteClass = note!.getAttribute('class') ?? '';
  assert.ok(noteClass.includes('border-hairline') && noteClass.includes('--vscode-ritemark-ground'), 'the ground\'s fill and a hairline');
  assert.ok(!/warning/.test(note!.toString()), 'no amber');
  assert.ok(note!.querySelector('svg'), 'the microphone-slash before the words');
  const link = note!.querySelectorAll('button').find((button) => button.textContent === SETTINGS);
  assert.ok(link, 'System Settings ▸ Sound is a link');
  assert.equal(link!.getAttribute('title'), undefined, 'never a native title');
  assert.equal(found.filter((click) => click.label === SETTINGS).length, 1);

  const labels = found.map((click) => click.label);
  assert.ok(labels.includes('Record again') && labels.includes('Cancel'), `Record again and Cancel: ${labels.join(', ')}`);
  assert.ok(!labels.includes('Transcribe'), 'the greyed Transcribe is gone');
  assert.ok(!text.includes('On-device'), 'no engine is offered');
  const buttons = html.querySelectorAll('button').map((button) => button.textContent.trim());
  assert.ok(buttons.indexOf('Record again') < buttons.indexOf('Cancel'), 'Record again first, as the main button');
  assert.equal(found.find((click) => click.label === 'Record again')!.disabled, false);

  // The link opens the sound settings.
  posted.length = 0;
  found.find((click) => click.label === SETTINGS)!.onClick({});
  assert.deepEqual(posted, [{ type: 'transcribe:record/openSoundSettings' }]);

  // Record again is the card's start.
  starts.length = 0;
  found.find((click) => click.label === 'Record again')!.onClick({});
  assert.deepEqual(starts, ['start']);
}

// Record again, as the panel wires it, starts a recording at once: the silent file is put aside and the capture
// session asks the host to start.
{
  const sent: Array<{ type: string }> = [];
  const session = new CaptureSession({ createContext: () => ({}) } as never, (message) => sent.push(message as { type: string }), () => {});
  recordAgain((message) => sent.push(message), session);
  assert.deepEqual(sent.map((message) => message.type), ['transcribe:clearPending', 'transcribe:record/start']);
  assert.equal(session.view().phase, 'requesting', 'a new recording has started');
}

// While a new recording can't start, Record again says why and stays.
{
  const { clicks: found } = card({ recordedHere: true }, 'A recording is in progress');
  assert.equal(found.find((click) => click.label === 'Record again')?.disabled, true);
}

// Where no settings can be named (Linux), the words say "your sound settings" and there is no link.
{
  const { text, clicks: found } = card({ recordedHere: true }, null, null);
  assert.ok(text.includes('Check the input in your sound settings, then record again.'), text);
  assert.ok(!found.some((click) => click.label === SETTINGS));
}

// A silent file from elsewhere: no microphone to check, nothing to record again; Cancel only.
{
  const { text, clicks: found } = card({ recordedHere: false });
  assert.ok(text.includes("No sound in this file, so there's nothing to transcribe."), text);
  assert.ok(!text.includes(SETTINGS));
  assert.deepEqual(found.map((click) => click.label), ['Cancel']);
}

// A file with sound is unchanged: the engines and Transcribe.
{
  const { text, clicks: found } = card(undefined);
  assert.ok(text.includes('On-device'));
  assert.ok(found.some((click) => click.label === 'Transcribe'));
  assert.ok(!found.some((click) => click.label === 'Record again'));
}

// The live card: the status line is "Recording" and the time; the input on its own muted line, cut with an ellipsis;
// the no-sound line with its icon and link.
{
  const host = { sessionId: 's1', fileName: null, warnLong: false } as never;
  const longName = 'Fake Default Audio Input With A Very Long Name (USB Audio Device)';
  const view = { phase: 'recording', sessionId: 's1', savedSeconds: 7, inputName: longName, noSound: true } as const;
  const { html, text } = render(createElement(LiveRecordingCard, { view, host, soundSettings: SETTINGS, onStop: () => {}, onCancel: () => {} }));
  const group = html.querySelector('[role="group"]')!;
  const status = group.childNodes.find((node) => (node as { tagName?: string }).tagName === 'DIV') as unknown as ReturnType<typeof parse>;
  assert.equal(status.textContent.replace(/\s+/g, ' ').trim(), 'Recording0:07', '"Recording" and the time, nothing else');
  const from = html.querySelectorAll('span').filter((span) => span.textContent === `From ${longName}`);
  assert.ok(from.length > 0, 'From <input>');
  assert.ok(
    from.some((span) => (span.getAttribute('class') ?? '').split(' ').includes('truncate') && span.getAttribute('class')!.includes('text-ink-muted')),
    'one muted line, cut with an ellipsis',
  );
  assert.ok(text.includes(`No sound from the microphone. Check the input in ${SETTINGS}.`), text);
  const line = html.querySelectorAll('p').find((p) => p.textContent.includes('No sound from the microphone'))!;
  assert.ok(line.querySelector('svg'), 'the microphone-slash before the line');
  assert.ok(!/warning/.test(line.toString()), 'plain ink, no amber');
}

console.log('pendingSilence.test.ts: all tests passed');
