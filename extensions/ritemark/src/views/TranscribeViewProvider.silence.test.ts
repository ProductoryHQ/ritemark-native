/**
 * #656: the Transcribe panel's host never starts an engine on a file with no sound. A silent WAV staged in the panel
 * is held as pending with `silence`, and a `transcribe:start` for it (a stale page, or a page that ignored the card)
 * starts no job. A WAV with sound, staged the same way, does start one, so the refusal is the silence and nothing else.
 * The state also carries the settings' name the webview shows (the one source of those words).
 *
 * Run: npx tsx src/views/TranscribeViewProvider.silence.test.ts (from extensions/ritemark)
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import Module from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';

const noop = { dispose: () => undefined };
const vscodeStub = {
  Uri: {
    file: (fsPath: string) => ({ fsPath, scheme: 'file', toString: () => `file://${fsPath}` }),
    joinPath: (base: { fsPath: string }, ...parts: string[]) => ({ fsPath: path.join(base.fsPath, ...parts) }),
    parse: (value: string) => ({ value }),
  },
  workspace: {
    workspaceFolders: undefined,
    onDidChangeConfiguration: () => noop,
    onDidChangeWorkspaceFolders: () => noop,
    getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback }),
  },
  commands: { registerCommand: () => noop, executeCommand: async () => undefined },
  window: {
    tabGroups: { activeTabGroup: { activeTab: undefined } },
    state: { focused: false },
    showOpenDialog: async () => undefined,
  },
  env: { openExternal: async () => true },
  TabInputText: class {},
  TabInputCustom: class {},
  ViewColumn: { Active: -1, Beside: -2 },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) =>
  request === 'vscode' ? vscodeStub : load(request, ...rest);

function wav(samples: Int16Array): Buffer {
  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16_000, 24);
  header.writeUInt32LE(32_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function main(): Promise<void> {
  const { TranscribeViewProvider } = await import('./TranscribeViewProvider');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-656-host-'));

  try {
    const silentPath = path.join(dir, 'Recording silent.wav');
    fs.writeFileSync(silentPath, wav(new Int16Array(16_000 * 3)));
    const soundPath = path.join(dir, 'Recording sound.wav');
    fs.writeFileSync(soundPath, wav(Int16Array.from({ length: 16_000 * 3 }, (_, i) => Math.round(8000 * Math.sin(i / 7)))));

    const enqueued: unknown[] = [];
    const engine = {
      id: 'whisper-local',
      acceptsExtensions: ['.wav'],
      estimateCostUsd: () => 0,
    };
    const registry = {
      supported: () => [engine],
      statuses: async () => [],
      preferred: async () => engine,
    };
    const jobs = {
      onEvent: () => () => undefined,
      list: () => [],
      enqueue: (input: unknown) => {
        enqueued.push(input);
        return { id: `job-${enqueued.length}` };
      },
      cancel: () => undefined,
      dismiss: () => undefined,
    };
    const store = { listWithAudioState: async () => [], get: async () => undefined };
    const memento = { get: () => undefined, update: async () => undefined, keys: () => [] };
    const workbench = { renameRecording: async () => undefined, onDidRenameRecording: () => noop };

    const provider = new TranscribeViewProvider(
      { fsPath: dir } as never,
      registry as never,
      jobs as never,
      store as never,
      memento as never,
      workbench as never,
    );

    const posted: Array<{ type: string; data?: Record<string, unknown> }> = [];
    let receive: ((message: unknown) => void) | null = null;
    provider.resolveWebviewView({
      webview: {
        options: {},
        html: '',
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri: unknown) => uri,
        postMessage: async (message: { type: string }) => {
          posted.push(message);
          return true;
        },
        onDidReceiveMessage: (listener: (message: unknown) => void) => {
          receive = listener;
          return noop;
        },
      },
      onDidDispose: () => noop,
      badge: undefined,
    } as never);
    assert.ok(receive, 'the provider listens to its webview');
    const send = receive as (message: unknown) => void;
    const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
    const lastState = () => [...posted].reverse().find((message) => message.type === 'transcribe:state')?.data;

    // A silent WAV: pending with `silence`, and Transcribe for it starts nothing.
    send({ type: 'transcribe:importPath', path: silentPath });
    await settle();
    const silentPending = lastState()?.pending as { audioPath: string; silence?: { recordedHere: boolean } } | null;
    assert.equal(silentPending?.audioPath, silentPath);
    assert.deepEqual(silentPending?.silence, { recordedHere: false }, 'a file added here, not recorded here');
    send({ type: 'transcribe:start', engineId: 'whisper-local', language: null });
    await settle();
    assert.equal(enqueued.length, 0, '_start refuses a silent pending file: no job, no engine');
    assert.equal((lastState()?.pending as { audioPath: string } | null)?.audioPath, silentPath, 'the card stays, saying why');
    assert.equal(
      lastState()?.soundSettings,
      process.platform === 'darwin' ? 'System Settings ▸ Sound' : process.platform === 'win32' ? 'Settings ▸ System ▸ Sound' : null,
      'the host names the settings for the webview',
    );

    // The same path with sound: it starts, so the refusal above was the silence.
    send({ type: 'transcribe:clearPending' });
    send({ type: 'transcribe:importPath', path: soundPath });
    await settle();
    assert.equal((lastState()?.pending as { silence?: unknown } | null)?.silence, undefined);
    send({ type: 'transcribe:start', engineId: 'whisper-local', language: null });
    await settle();
    assert.equal(enqueued.length, 1, 'a file with sound starts its job');
    assert.equal((enqueued[0] as { audioPath: string }).audioPath, soundPath);

    provider.dispose();
    console.log('TranscribeViewProvider.silence.test.ts: all tests passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
