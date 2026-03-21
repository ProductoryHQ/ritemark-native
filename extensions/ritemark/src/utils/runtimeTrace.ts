import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type OutputChannelLike = {
  appendLine: (value: string) => void;
  show: (preserveFocus?: boolean) => void;
};

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

function safeSerialize(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    if (!text) {
      return '';
    }
    return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
  } catch (error) {
    return `[unserializable: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

function isTraceEnabled(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicRequire = new Function('name', 'return require(name)') as (name: string) => { workspace?: { getConfiguration?: (section: string) => { get?: (key: string, defaultValue?: unknown) => unknown } } };
    const vscode = dynamicRequire('vscode');
    return vscode?.workspace?.getConfiguration?.('ritemark.ai')?.get?.('debugTrace', false) === true;
  } catch {
    return false;
  }
}

function rotateIfNeeded(logPath: string): void {
  try {
    const stat = fs.statSync(logPath);
    if (stat.size > MAX_LOG_SIZE) {
      // Keep last ~1MB, discard the rest
      const content = fs.readFileSync(logPath, 'utf8');
      const keepFrom = content.length - 1024 * 1024;
      const newlineAfterCut = content.indexOf('\n', keepFrom);
      const trimmed = newlineAfterCut >= 0
        ? `[... log rotated at ${new Date().toISOString()} ...]\n${content.slice(newlineAfterCut + 1)}`
        : `[... log rotated at ${new Date().toISOString()} ...]\n`;
      fs.writeFileSync(logPath, trimmed, 'utf8');
    }
  } catch {
    // File doesn't exist yet or can't stat — that's fine.
  }
}

export function createRuntimeTrace(outputChannelName: string, logFileName: string) {
  let channel: OutputChannelLike | null = null;
  const traceLogPath = path.join(os.tmpdir(), logFileName);
  let enabled: boolean | null = null;
  let rotationChecked = false;

  function tryCreateOutputChannel(): OutputChannelLike | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicRequire = new Function('name', 'return require(name)') as (name: string) => { window?: { createOutputChannel?: (name: string) => OutputChannelLike } };
      const vscode = dynamicRequire('vscode');
      return vscode?.window?.createOutputChannel?.(outputChannelName) ?? null;
    } catch {
      return null;
    }
  }

  function getTraceChannel(): OutputChannelLike | null {
    if (!channel) {
      channel = tryCreateOutputChannel();
    }
    return channel;
  }

  function trace(scope: string, message: string, payload?: unknown): void {
    // Check setting once, then cache (re-checked on show())
    if (enabled === null) {
      enabled = isTraceEnabled();
    }
    if (!enabled) {
      return;
    }

    // Rotate on first write per session
    if (!rotationChecked) {
      rotationChecked = true;
      rotateIfNeeded(traceLogPath);
    }

    const timestamp = new Date().toISOString();
    const suffix = payload === undefined ? '' : ` ${safeSerialize(payload)}`;
    const line = `[${timestamp}] [${scope}] ${message}${suffix}`;
    getTraceChannel()?.appendLine(line);
    try {
      fs.appendFileSync(traceLogPath, `${line}\n`, 'utf8');
    } catch {
      // Ignore file logging failures; the Output channel is still useful.
    }
  }

  function show(): void {
    // Re-check setting when explicitly showing trace
    enabled = isTraceEnabled();
    getTraceChannel()?.show(true);
  }

  function getLogPath(): string {
    return traceLogPath;
  }

  return { trace, show, getLogPath };
}
