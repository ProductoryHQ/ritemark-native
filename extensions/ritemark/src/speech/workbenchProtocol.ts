import type { EngineId } from './types';
import {
  isInsightsLanguageSelection,
  type InsightsLanguageSelection,
} from './insightsLanguage';

export type TranscriptWorkbenchRequest =
  | { type: 'workbench:ready' }
  | { type: 'workbench:transcribe'; engineId: EngineId }
  | { type: 'workbench:renameSpeaker'; speakerId: string; label: string }
  | { type: 'workbench:save' }
  | { type: 'workbench:openDocument' }
  | { type: 'workbench:generateInsights'; language: InsightsLanguageSelection }
  | { type: 'workbench:cancelInsights' }
  | { type: 'workbench:createInsightsDocument' }
  | { type: 'workbench:openSettings' };

export type InsightsDocumentResult = {
  type: 'workbench:insightsDocumentResult';
  status: 'success' | 'cancelled' | 'failed';
};

export class WorkbenchProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbenchProtocolError';
  }
}

export function parseTranscriptWorkbenchRequest(value: unknown): TranscriptWorkbenchRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkbenchProtocolError('Workbench message must be an object.');
  }
  const input = value as Record<string, unknown>;
  const type = input.type;
  if (typeof type !== 'string') throw new WorkbenchProtocolError('Workbench message type is required.');

  if (
    type === 'workbench:ready' ||
    type === 'workbench:save' ||
    type === 'workbench:openDocument' ||
    type === 'workbench:cancelInsights' ||
    type === 'workbench:createInsightsDocument' ||
    type === 'workbench:openSettings'
  ) {
    exactKeys(input, ['type']);
    return { type };
  }
  if (type === 'workbench:transcribe') {
    exactKeys(input, ['type', 'engineId']);
    if (input.engineId !== 'whisper-local' && input.engineId !== 'elevenlabs') {
      throw new WorkbenchProtocolError('Unknown transcription engine.');
    }
    return { type, engineId: input.engineId };
  }
  if (type === 'workbench:renameSpeaker') {
    exactKeys(input, ['type', 'speakerId', 'label']);
    if (typeof input.speakerId !== 'string' || !input.speakerId || input.speakerId.length > 256) {
      throw new WorkbenchProtocolError('speakerId must be a non-empty string.');
    }
    if (typeof input.label !== 'string' || input.label.length > 512) {
      throw new WorkbenchProtocolError('label must be a string of at most 512 characters.');
    }
    return { type, speakerId: input.speakerId, label: input.label };
  }
  if (type === 'workbench:generateInsights') {
    exactKeys(input, ['type', 'language']);
    if (!isInsightsLanguageSelection(input.language)) {
      throw new WorkbenchProtocolError('Unknown Insights language.');
    }
    return { type, language: input.language };
  }
  throw new WorkbenchProtocolError(`Unknown workbench message type: ${type}`);
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowlist = new Set(allowed);
  const extra = Object.keys(input).find((key) => !allowlist.has(key));
  if (extra) throw new WorkbenchProtocolError(`Unknown workbench message field: ${extra}`);
}
