import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type OutputChannelLike = {
  appendLine: (value: string) => void;
  show: (preserveFocus?: boolean) => void;
};

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

export function createRuntimeTrace(outputChannelName: string, logFileName: string) {
  let channel: OutputChannelLike | null = null;
  const traceLogPath = path.join(os.tmpdir(), logFileName);

  function tryCreateOutputChannel(): OutputChannelLike | null {
    try {
      // Avoid hard dependency on the vscode module in plain node test runs.
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
    getTraceChannel()?.show(true);
  }

  function getLogPath(): string {
    return traceLogPath;
  }

  return { trace, show, getLogPath };
}
