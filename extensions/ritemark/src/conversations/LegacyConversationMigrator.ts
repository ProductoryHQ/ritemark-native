import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { ConversationStore } from './ConversationStore';
import { unassignedLegacyScope, type ResolvedProjectScopeV1 } from './projectScope';
import type { ConversationEventV1, MigrationProvenanceV1, RuntimeId } from './types';

export interface LegacyConversationCandidateV1 {
  sourceKey: string;
  sourceId: string;
  title?: string;
  agentId?: string;
  createdAt?: number;
  updatedAt?: number;
  data: unknown;
}
export interface LegacyMigrationIssueV1 {
  sourceKey: string;
  sourceId: string | null;
  reason: 'invalid-record' | 'empty-record' | 'storage-error';
  message: string;
}

export interface LegacyMigrationReportV1 {
  created: string[];
  deduplicated: Array<{ sourceKey: string; existingConversationId: string }>;
  conflicts: string[];
  issues: LegacyMigrationIssueV1[];
  currentScopeCount: number;
  unassignedCount: number;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestamp(value: unknown, fallback: number): string {
  return new Date(number(value) ?? fallback).toISOString();
}

function normalizedText(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function uuidFromSeed(seed: string): string {
  const hex = sha256(seed).slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function runtime(value: unknown, fallback: unknown): RuntimeId {
  const candidate = string(value) ?? string(fallback);
  if (candidate === 'claude-code' || candidate === 'codex' || candidate === 'opencode') return candidate;
  return 'legacy-ritemark';
}

function legacyWorkspaceHash(workspacePath: string): string {
  let hash = 0;
  for (let index = 0; index < workspacePath.length; index += 1) {
    hash = ((hash << 5) - hash) + workspacePath.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function knownLegacyPrefix(scope: ResolvedProjectScopeV1): string | null {
  if (scope.descriptor.kind !== 'single-root') return null;
  try {
    return `ritemark-chat-${legacyWorkspaceHash(fileURLToPath(scope.descriptor.folderUris[0]))}-`;
  } catch {
    return null;
  }
}

function destinationFor(sourceKey: string, current: ResolvedProjectScopeV1): ResolvedProjectScopeV1 {
  const knownPrefix = knownLegacyPrefix(current);
  if (knownPrefix && sourceKey.startsWith(knownPrefix)) return current;
  return unassignedLegacyScope();
}

function event(
  candidate: LegacyConversationCandidateV1,
  sequence: number,
  kind: 'user-message' | 'assistant-message',
  text: string,
  occurredAt: string,
  runtimeId: RuntimeId,
  turnSeed: string,
): ConversationEventV1 {
  const base = {
    eventId: uuidFromSeed(`${candidate.sourceKey}\0event\0${sequence}\0${kind}\0${text}`),
    turnId: uuidFromSeed(`${candidate.sourceKey}\0turn\0${turnSeed}`),
    sequence,
    occurredAt,
    runtimeId,
  };
  return kind === 'user-message'
    ? { ...base, kind, text, mode: null, attachments: [] }
    : { ...base, kind, content: text, terminalStatus: 'completed' };
}

function convert(candidate: LegacyConversationCandidateV1): { events: ConversationEventV1[]; fingerprint: string; checksum: string } | null {
  const data = object(candidate.data);
  if (!data) return null;
  const events: ConversationEventV1[] = [];
  const fallbackTime = candidate.createdAt ?? 0;

  const appendTurn = (turnValue: unknown, index: number, fallbackRuntime: unknown, assistantFields: string[]) => {
    const turn = object(turnValue);
    if (!turn) return;
    const runtimeId = runtime(turn.runtime, fallbackRuntime);
    const occurredAt = timestamp(turn.timestamp, fallbackTime);
    const prompt = string(turn.userPrompt);
    const result = object(turn.result);
    const assistant = assistantFields.map((field) => string(turn[field]) ?? string(result?.[field])).find(Boolean) ?? null;
    const turnSeed = string(turn.id) ?? `${index}`;
    if (prompt && normalizedText(prompt)) events.push(event(candidate, events.length, 'user-message', prompt, occurredAt, runtimeId, turnSeed));
    if (assistant && normalizedText(assistant)) events.push(event(candidate, events.length, 'assistant-message', assistant, occurredAt, runtimeId, turnSeed));
  };

  const agentTurns = Array.isArray(data.agentConversation) ? data.agentConversation : [];
  const codexTurns = Array.isArray(data.codexConversation) ? data.codexConversation : [];
  agentTurns.forEach((turn, index) => appendTurn(turn, index, candidate.agentId, ['text']));
  codexTurns.forEach((turn, index) => appendTurn(turn, index + agentTurns.length, 'codex', ['streamingText', 'text']));

  if (events.length === 0 && Array.isArray(data.chatMessages)) {
    for (const [index, value] of data.chatMessages.entries()) {
      const message = object(value);
      const role = string(message?.role);
      const content = string(message?.content);
      if (!message || !content || (role !== 'user' && role !== 'assistant')) continue;
      events.push(event(
        candidate,
        events.length,
        role === 'user' ? 'user-message' : 'assistant-message',
        content,
        timestamp(message.timestamp, fallbackTime),
        runtime(candidate.agentId, candidate.agentId),
        string(message.id) ?? `${index}`,
      ));
    }
  }

  if (events.length === 0 && Array.isArray(data.conversationHistory)) {
    for (const [index, value] of data.conversationHistory.entries()) {
      const message = object(value);
      const role = string(message?.role);
      const content = string(message?.content);
      if (!message || !content || (role !== 'user' && role !== 'assistant')) continue;
      events.push(event(
        candidate,
        events.length,
        role === 'user' ? 'user-message' : 'assistant-message',
        content,
        timestamp(undefined, fallbackTime),
        runtime(candidate.agentId, candidate.agentId),
        `${index}`,
      ));
    }
  }

  if (events.length === 0) return null;
  const fingerprintParts = events.map((item) => [
    item.runtimeId,
    item.kind,
    normalizedText(item.kind === 'user-message' ? item.text : item.kind === 'assistant-message' ? item.content : ''),
  ]);
  return {
    events,
    fingerprint: sha256(JSON.stringify(fingerprintParts)),
    checksum: sha256(JSON.stringify(candidate.data)),
  };
}

export class LegacyConversationMigrator {
  constructor(private readonly store: ConversationStore) {}

  async importBatch(candidates: readonly LegacyConversationCandidateV1[], currentScope: ResolvedProjectScopeV1): Promise<LegacyMigrationReportV1> {
    const report: LegacyMigrationReportV1 = {
      created: [], deduplicated: [], conflicts: [], issues: [], currentScopeCount: 0, unassignedCount: 0,
    };
    const existingSummaries = await this.store.list();
    const existingRecords = (await Promise.all(existingSummaries.map((summary) => this.store.get(summary.conversationId))))
      .filter((record): record is NonNullable<typeof record> => record !== null);
    const fingerprints = new Map<string, string>();
    const sourceIds = new Map<string, string>();
    for (const record of existingRecords) {
      const parts = record.events
        .filter((item) => item.kind === 'user-message' || item.kind === 'assistant-message')
        .map((item) => [
          item.runtimeId,
          item.kind,
          normalizedText(item.kind === 'user-message' ? item.text : item.content),
        ]);
      fingerprints.set(sha256(JSON.stringify(parts)), record.conversationId);
      if (record.migration?.sourceId) sourceIds.set(record.migration.sourceId, record.conversationId);
    }

    for (const candidate of candidates) {
      try {
        if (!candidate.sourceKey || !candidate.sourceId) throw new Error('source key and id are required');
        const converted = convert(candidate);
        if (!converted) {
          report.issues.push({ sourceKey: candidate.sourceKey, sourceId: candidate.sourceId, reason: 'empty-record', message: 'No displayable user or assistant content' });
          continue;
        }
        const duplicate = fingerprints.get(converted.fingerprint);
        if (duplicate) {
          report.deduplicated.push({ sourceKey: candidate.sourceKey, existingConversationId: duplicate });
          continue;
        }
        const priorSourceId = sourceIds.get(candidate.sourceId);
        if (priorSourceId) report.conflicts.push(candidate.sourceId);
        const destination = destinationFor(candidate.sourceKey, currentScope);
        const provenance: MigrationProvenanceV1 = {
          source: destination.scopeId === currentScope.scopeId ? 'legacy-scoped' : 'legacy-global',
          sourceKey: candidate.sourceKey,
          sourceId: candidate.sourceId,
          checksum: converted.checksum,
          migratedAt: new Date().toISOString(),
        };
        const conversationId = uuidFromSeed(`${candidate.sourceKey}\0${candidate.sourceId}\0${converted.checksum}`);
        const createdAt = timestamp(candidate.createdAt, 0);
        const lastActivityAt = timestamp(candidate.updatedAt, candidate.createdAt ?? 0);
        await this.store.create({
          conversationId,
          scopeId: destination.scopeId,
          scope: destination.descriptor,
          title: candidate.title?.trim() || 'Earlier conversation',
          createdAt,
          lastActivityAt,
          lifecycle: { state: 'idle' },
          events: converted.events,
          migration: provenance,
        });
        report.created.push(conversationId);
        fingerprints.set(converted.fingerprint, conversationId);
        sourceIds.set(candidate.sourceId, conversationId);
        if (destination.scopeId === currentScope.scopeId) report.currentScopeCount += 1;
        else report.unassignedCount += 1;
      } catch (error) {
        report.issues.push({
          sourceKey: candidate.sourceKey,
          sourceId: candidate.sourceId || null,
          reason: error instanceof Error && error.name === 'ConversationStoreError' ? 'storage-error' : 'invalid-record',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return report;
  }
}
