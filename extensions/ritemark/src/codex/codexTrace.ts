import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let codexTraceChannel: vscode.OutputChannel | null = null;
const TRACE_LOG_PATH = path.join(os.tmpdir(), 'ritemark-codex-trace.log');

function getTraceChannel(): vscode.OutputChannel {
  if (!codexTraceChannel) {
    codexTraceChannel = vscode.window.createOutputChannel('Ritemark Codex Trace');
  }
  return codexTraceChannel;
}

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

export function traceCodex(scope: string, message: string, payload?: unknown): void {
  const channel = getTraceChannel();
  const timestamp = new Date().toISOString();
  const suffix = payload === undefined ? '' : ` ${safeSerialize(payload)}`;
  const line = `[${timestamp}] [${scope}] ${message}${suffix}`;
  channel.appendLine(line);
  try {
    fs.appendFileSync(TRACE_LOG_PATH, `${line}\n`, 'utf8');
  } catch {
    // Ignore file logging failures; the Output channel is still useful.
  }
}

export function showCodexTrace(): void {
  getTraceChannel().show(true);
}

export function getCodexTraceLogPath(): string {
  return TRACE_LOG_PATH;
}
