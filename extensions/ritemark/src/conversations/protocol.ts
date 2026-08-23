import {
  assertConversationId,
  type ConversationAttachmentMetadataV1,
  type ConversationEventV1,
  type ConversationRecordV1,
  type ConversationStoreDiagnostics,
  type ConversationSummaryV1,
  type ProjectScopeDescriptorV1,
} from './types';
import type { AgentId } from '../agent/types';
import type { LegacyMigrationReportV1 } from './LegacyConversationMigrator';

export const MAX_CONVERSATION_MESSAGE_BYTES = 25 * 1024 * 1024;

export interface ConversationTurnAttachment extends ConversationAttachmentMetadataV1 {
  id: string;
  data: string;
}

export type ConversationProjectionV1 = Omit<ConversationRecordV1, 'continuations' | 'migration' | 'events'> & {
  events: Exclude<ConversationEventV1, { kind: 'dispatch-receipt' }>[];
};

interface RequestBase {
  requestId: string;
}

export type ConversationRequest =
  | (RequestBase & { type: 'conversation/initialize' })
  | (RequestBase & { type: 'conversation/list' })
  | (RequestBase & { type: 'conversation/get'; conversationId: string; recovery?: boolean })
  | (RequestBase & {
      type: 'conversation/accept-turn';
      conversationId?: string;
      bindingGeneration?: number;
      turnId?: string;
      agentId: AgentId;
      text: string;
      title?: string;
      mode?: string | null;
      attachments?: ConversationTurnAttachment[];
    })
  | (RequestBase & { type: 'conversation/rename'; conversationId: string; bindingGeneration: number; title: string })
  | (RequestBase & { type: 'conversation/delete'; conversationId: string; bindingGeneration: number; stopRunning: boolean; recovery?: boolean })
  | (RequestBase & { type: 'conversation/undo-delete'; undoToken: string; recovery?: boolean })
  | (RequestBase & { type: 'conversation/move-unassigned'; conversationId: string; bindingGeneration: number })
  | (RequestBase & { type: 'conversation/diagnostics' })
  | (RequestBase & { type: 'legacy/import-batch'; records: unknown[] });

export interface ConversationInitializeResult {
  scopeId: string;
  scope: ProjectScopeDescriptorV1;
  scopeLabel: string;
  rolloutMode: 'legacy' | 'host-canonical' | 'host-compat';
  selectedConversationId: string | null;
  conversations: ConversationSummaryV1[];
  earlierConversations: ConversationSummaryV1[];
}

export type ConversationResultData =
  | ConversationInitializeResult
  | { conversations: ConversationSummaryV1[]; earlierConversations: ConversationSummaryV1[] }
  | { conversation: ConversationProjectionV1 | null; dispatched?: boolean; recovery?: boolean }
  | { conversationId: string; undoToken: string; deletedAt: string; recovery?: boolean }
  | { diagnostics: ConversationStoreDiagnostics }
  | { accepted: boolean; migration?: LegacyMigrationReportV1 };

export type ConversationResultMessage =
  | {
      type: 'conversation/result';
      requestId: string;
      operation: ConversationRequest['type'];
      ok: true;
      data: ConversationResultData;
    }
  | {
      type: 'conversation/result';
      requestId: string;
      operation: string;
      ok: false;
      error: { code: string; message: string; retryable: boolean };
    };

export type ConversationHostEvent =
  | { type: 'conversation/changed'; conversationId: string; revision: number; bindingGeneration: number }
  | { type: 'conversation/store-status'; state: 'loading' | 'ready' | 'degraded'; message?: string };

const REQUEST_TYPES = new Set<ConversationRequest['type']>([
  'conversation/initialize',
  'conversation/list',
  'conversation/get',
  'conversation/accept-turn',
  'conversation/rename',
  'conversation/delete',
  'conversation/undo-delete',
  'conversation/move-unassigned',
  'conversation/diagnostics',
  'legacy/import-batch',
]);

const DISPATCHABLE_RUNTIME_IDS = new Set<AgentId>(['claude-code', 'codex', 'opencode']);

export class ConversationProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationProtocolError';
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ConversationProtocolError('Message must be an object');
  return value as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string, max = 100_000): string {
  const value = input[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new ConversationProtocolError(`${key} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

function optionalString(input: Record<string, unknown>, key: string, max = 100_000): string | undefined {
  if (input[key] === undefined) return undefined;
  return requiredString(input, key, max);
}

function integer(input: Record<string, unknown>, key: string): number {
  if (!Number.isSafeInteger(input[key]) || (input[key] as number) < 0) {
    throw new ConversationProtocolError(`${key} must be a non-negative safe integer`);
  }
  return input[key] as number;
}

function id(input: Record<string, unknown>, key: string): string {
  const value = requiredString(input, key, 64);
  assertConversationId(value);
  return value;
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(input).find((key) => !allowedSet.has(key));
  if (unknown) throw new ConversationProtocolError(`Unknown field: ${unknown}`);
}

export function isConversationRequestMessage(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && REQUEST_TYPES.has((value as { type?: string }).type as ConversationRequest['type']);
}

export function parseConversationRequest(value: unknown): ConversationRequest {
  const input = object(value);
  const type = requiredString(input, 'type', 64) as ConversationRequest['type'];
  if (!REQUEST_TYPES.has(type)) throw new ConversationProtocolError(`Unknown conversation message type: ${type}`);
  const requestId = requiredString(input, 'requestId', 128);

  if (type === 'conversation/initialize' || type === 'conversation/list' || type === 'conversation/diagnostics') {
    exactKeys(input, ['type', 'requestId']);
    return { type, requestId };
  }
  if (type === 'conversation/get') {
    exactKeys(input, ['type', 'requestId', 'conversationId', 'recovery']);
    if (input.recovery !== undefined && typeof input.recovery !== 'boolean') throw new ConversationProtocolError('recovery must be boolean');
    return { type, requestId, conversationId: id(input, 'conversationId'), ...(input.recovery === true ? { recovery: true } : {}) };
  }
  if (type === 'conversation/accept-turn') {
    exactKeys(input, ['type', 'requestId', 'conversationId', 'bindingGeneration', 'turnId', 'agentId', 'text', 'title', 'mode', 'attachments']);
    const agentId = requiredString(input, 'agentId', 32) as AgentId;
    if (!DISPATCHABLE_RUNTIME_IDS.has(agentId)) throw new ConversationProtocolError('agentId is unknown');
    const text = requiredString(input, 'text', 1_000_000);
    if (input.attachments !== undefined && !Array.isArray(input.attachments)) throw new ConversationProtocolError('attachments must be an array');
    const attachments = (input.attachments ?? []).map((value): ConversationTurnAttachment => {
      const attachment = object(value);
      exactKeys(attachment, ['id', 'name', 'kind', 'mediaType', 'sizeBytes', 'data']);
      const sizeBytes = attachment.sizeBytes === null ? null : integer(attachment, 'sizeBytes');
      const mediaType = attachment.mediaType === null ? null : requiredString(attachment, 'mediaType', 256);
      return {
        id: requiredString(attachment, 'id', 128),
        name: requiredString(attachment, 'name', 512),
        kind: requiredString(attachment, 'kind', 32),
        mediaType,
        sizeBytes,
        data: requiredString(attachment, 'data', MAX_CONVERSATION_MESSAGE_BYTES),
      };
    });
    if (Buffer.byteLength(text) + attachments.reduce((sum, attachment) => sum + Buffer.byteLength(attachment.data), 0) > MAX_CONVERSATION_MESSAGE_BYTES) {
      throw new ConversationProtocolError('Turn payload exceeds the 25 MB limit');
    }
    return {
      type,
      requestId,
      ...(input.conversationId === undefined ? {} : { conversationId: id(input, 'conversationId') }),
      ...(input.bindingGeneration === undefined ? {} : { bindingGeneration: integer(input, 'bindingGeneration') }),
      ...(input.turnId === undefined ? {} : { turnId: requiredString(input, 'turnId', 128) }),
      agentId,
      text,
      ...(optionalString(input, 'title', 512) ? { title: optionalString(input, 'title', 512) } : {}),
      mode: input.mode === null ? null : optionalString(input, 'mode', 64),
      attachments,
    };
  }
  if (type === 'conversation/rename') {
    exactKeys(input, ['type', 'requestId', 'conversationId', 'bindingGeneration', 'title']);
    return {
      type,
      requestId,
      conversationId: id(input, 'conversationId'),
      bindingGeneration: integer(input, 'bindingGeneration'),
      title: requiredString(input, 'title', 512),
    };
  }
  if (type === 'conversation/delete') {
    exactKeys(input, ['type', 'requestId', 'conversationId', 'bindingGeneration', 'stopRunning', 'recovery']);
    if (typeof input.stopRunning !== 'boolean') throw new ConversationProtocolError('stopRunning must be boolean');
    if (input.recovery !== undefined && typeof input.recovery !== 'boolean') throw new ConversationProtocolError('recovery must be boolean');
    return { type, requestId, conversationId: id(input, 'conversationId'), bindingGeneration: integer(input, 'bindingGeneration'), stopRunning: input.stopRunning, ...(input.recovery === true ? { recovery: true } : {}) };
  }
  if (type === 'conversation/undo-delete') {
    exactKeys(input, ['type', 'requestId', 'undoToken', 'recovery']);
    if (input.recovery !== undefined && typeof input.recovery !== 'boolean') throw new ConversationProtocolError('recovery must be boolean');
    return { type, requestId, undoToken: requiredString(input, 'undoToken', 128), ...(input.recovery === true ? { recovery: true } : {}) };
  }
  if (type === 'conversation/move-unassigned') {
    exactKeys(input, ['type', 'requestId', 'conversationId', 'bindingGeneration']);
    return { type, requestId, conversationId: id(input, 'conversationId'), bindingGeneration: integer(input, 'bindingGeneration') };
  }
  exactKeys(input, ['type', 'requestId', 'records']);
  if (!Array.isArray(input.records) || input.records.length > 100) throw new ConversationProtocolError('records must be a batch of at most 100');
  return { type, requestId, records: input.records };
}

export function projectConversation(record: ConversationRecordV1): ConversationProjectionV1 {
  const { continuations: _continuations, migration: _migration, ...projection } = record;
  return {
    ...projection,
    events: projection.events.filter(
      (event): event is Exclude<ConversationEventV1, { kind: 'dispatch-receipt' }> => event.kind !== 'dispatch-receipt',
    ),
  };
}
