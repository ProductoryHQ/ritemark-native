/** Sprint 113 R3 — deterministic Insights-only Markdown and safe new-file writes. */

import * as path from 'path';
import * as fsp from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { insightsLanguageLabel, insightsLanguageProvenance } from './insightsLanguage';
import type { TranscriptInsights, TranscriptSession } from './types';

export type InsightsTargetErrorCode = 'invalid-name' | 'primary-transcript' | 'exists';

export class InsightsTargetError extends Error {
  constructor(readonly code: InsightsTargetErrorCode, message: string) {
    super(message);
    this.name = 'InsightsTargetError';
  }
}

export function suggestedInsightsFileName(session: TranscriptSession): string {
  const source = session.exportPath ?? session.audioPath;
  const base = path.basename(source, path.extname(source)).trim() || 'insights';
  const safe = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/-+/g, '-') || 'insights';
  return `${safe}-insights.md`;
}

export function normalizeInsightsTargetPath(target: string): string {
  const normalized = path.resolve(target);
  validateInsightsFileName(normalized);
  return path.extname(normalized).toLowerCase() === '.md' ? normalized : `${normalized}.md`;
}

export function validateInsightsFileName(target: string): void {
  const name = path.basename(target);
  const extension = path.extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  if (
    !name ||
    name === '.' ||
    name === '..' ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
    /[. ]$/.test(name) ||
    reserved.test(stem)
  ) {
    throw new InsightsTargetError(
      'invalid-name',
      'Choose a filename that works on macOS and Windows and ends in .md.',
    );
  }
}

export async function validateInsightsTargetPath(
  target: string,
  primaryTranscriptPath: string | undefined,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  validateInsightsFileName(target);

  if (primaryTranscriptPath && await pathsAlias(target, primaryTranscriptPath, platform)) {
    throw new InsightsTargetError(
      'primary-transcript',
      'Choose a new filename. Insights documents never replace the transcript.',
    );
  }

  try {
    await fsp.lstat(target);
    throw new InsightsTargetError(
      'exists',
      'Choose a new filename. Insights documents do not replace existing files.',
    );
  } catch (error) {
    if (error instanceof InsightsTargetError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function pathsAlias(left: string, right: string, platform: NodeJS.Platform): Promise<boolean> {
  const [canonicalLeft, canonicalRight] = await Promise.all([
    canonicalMissingPath(left),
    canonicalMissingPath(right),
  ]);
  const caseInsensitive = platform === 'win32' || platform === 'darwin';
  return caseInsensitive
    ? canonicalLeft.toLocaleLowerCase('en-US') === canonicalRight.toLocaleLowerCase('en-US')
    : canonicalLeft === canonicalRight;
}

async function canonicalMissingPath(target: string): Promise<string> {
  const absolute = path.resolve(target);
  try {
    return await fsp.realpath(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = await fsp.realpath(path.dirname(absolute));
    return path.join(parent, path.basename(absolute));
  }
}

export async function writeInsightsDocumentExclusive(
  target: string,
  markdown: string,
  write: (handle: FileHandle, contents: string) => Promise<void> = async (handle, contents) => {
    await handle.writeFile(contents, 'utf-8');
    await handle.sync();
  },
): Promise<void> {
  let handle: FileHandle | undefined;
  let created = false;

  try {
    handle = await fsp.open(target, 'wx');
    created = true;
    await write(handle, markdown);
  } catch (error) {
    if (created) {
      await handle?.close().catch(() => undefined);
      handle = undefined;
      await fsp.unlink(target).catch(() => undefined);
    }
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function insightsToMarkdown(session: TranscriptSession, insights: TranscriptInsights): string {
  const provenance = insightsLanguageProvenance(insights.language);
  const selected = provenance.selected === 'auto'
    ? `Auto · ${insightsLanguageLabel(provenance.resolved)}`
    : insightsLanguageLabel(provenance.resolved);
  const groups: Array<{ kind: TranscriptInsights['items'][number]['kind']; heading: string }> = [
    { kind: 'decision', heading: 'Decisions' },
    { kind: 'action', heading: 'Action items' },
    { kind: 'question', heading: 'Open questions' },
    { kind: 'quote', heading: 'Key quotes' },
  ];
  const lines = [
    `# Insights — ${plainText(path.basename(session.audioPath, path.extname(session.audioPath)))}`,
    '',
    `- Source recording: ${plainText(path.basename(session.audioPath))}`,
    ...(session.exportPath ? [`- Primary transcript: ${plainText(path.basename(session.exportPath))}`] : []),
    `- Generated: ${insights.generatedAt}`,
    `- Insights language: ${selected}${provenance.legacy ? ' (legacy)' : ''}`,
    `- Model: ${plainText(insights.model)}`,
  ];

  if (insights.summary) {
    lines.push('', '## Summary', '', plainText(insights.summary));
  }

  for (const group of groups) {
    const items = insights.items.filter((item) => item.kind === group.kind);
    if (items.length === 0) continue;
    lines.push('', `## ${group.heading}`, '');
    for (const item of items) {
      const owner = item.owner ? `${plainText(item.owner)} — ` : '';
      const text = plainText(item.text);
      const timestamp = formatTimestamp(item.at);
      lines.push(item.kind === 'quote'
        ? `> “${text}”${owner ? ` — ${plainText(item.owner ?? '')}` : ''} · ${timestamp}`
        : `- **${timestamp}** ${owner}${text}`);
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function plainText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}
