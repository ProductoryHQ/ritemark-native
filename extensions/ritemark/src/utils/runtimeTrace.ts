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
    // Lazy direct require (module scope). A `new Function('return require(name)')`
    // wrapper runs in global scope where `require` is undefined → the require
    // throws and this whole check silently returned false, disabling all tracing.
    const vscode = require('vscode') as { workspace?: { getConfiguration?: (section: string) => { get?: (key: string, defaultValue?: unknown) => unknown } } };
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
  let writesSinceRotationCheck = 0;

  function tryCreateOutputChannel(): OutputChannelLike | null {
    try {
      // Lazy direct require — see isTraceEnabled above for why the previous
      // `new Function`-wrapped require silently failed in the extension host.
      const vscode = require('vscode') as { window?: { createOutputChannel?: (name: string) => OutputChannelLike } };
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

    // Check rotation periodically (every 500 writes) to keep cap effective
    if (++writesSinceRotationCheck >= 500) {
      writesSinceRotationCheck = 0;
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
