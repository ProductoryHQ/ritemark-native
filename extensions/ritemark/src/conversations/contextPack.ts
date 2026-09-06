import type {
  AssistantMessageEventV1,
  ConversationEventV1,
  ConversationRecordV1,
  DispatchReceiptStateV1,
  RuntimeId,
  UserMessageEventV1,
} from './types';
import type { NormalizedRuntimeContext } from '../runtime/continuation';

export const CONTEXT_PACK_MAX_BYTES = 32_000;
export const CONTEXT_PACK_MESSAGE_MAX_BYTES = 12_000;

interface ContextMessage {
  id: string;
  turnId: string;
  sequence: number;
  role: 'user' | 'assistant';
  runtimeId: RuntimeId;
  text: string;
  unanswered: boolean;
  dispatchState: DispatchReceiptStateV1 | 'unknown';
}

interface ContextTurn {
  turnId: string;
  user: ContextMessage;
  assistant?: ContextMessage;
}

export interface ContextPackOptions {
  /** Exclude this newly accepted user event and everything after it. */
  beforeEventId?: string;
  /** For native delta: include only canonical text after this watermark. */
  afterEventId?: string | null;
  maxBytes?: number;
  maxMessageBytes?: number;
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function prefixWithinBytes(value: string, maxBytes: number): string {
  const codepoints = Array.from(value);
  let low = 0;
  let high = codepoints.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (utf8Bytes(codepoints.slice(0, mid).join('')) <= maxBytes) low = mid;
    else high = mid - 1;
  }
  return codepoints.slice(0, low).join('');
}

function suffixWithinBytes(value: string, maxBytes: number): string {
  return Array.from(prefixWithinBytes(Array.from(value).reverse().join(''), maxBytes)).reverse().join('');
}

export function truncateContextMessage(value: string, maxBytes = CONTEXT_PACK_MESSAGE_MAX_BYTES): string {
  if (utf8Bytes(value) <= maxBytes) return value;
  const marker = '\n… [middle of this message omitted] …\n';
  const available = Math.max(0, maxBytes - utf8Bytes(marker));
  const headBudget = Math.ceil(available / 2);
  const tailBudget = Math.floor(available / 2);
  return `${prefixWithinBytes(value, headBudget)}${marker}${suffixWithinBytes(value, tailBudget)}`;
}

function receiptByTurn(events: ConversationEventV1[]): Map<string, DispatchReceiptStateV1> {
  const receipts = new Map<string, DispatchReceiptStateV1>();
  for (const event of events) {
    if (event.kind === 'dispatch-receipt') receipts.set(event.turnId, event.dispatchState);
  }
  return receipts;
}

function normalizeTurns(events: ConversationEventV1[]): ContextTurn[] {
  const receipts = receiptByTurn(events);
  const assistants = new Map<string, AssistantMessageEventV1>();
  for (const event of events) {
    if (event.kind === 'assistant-message' && event.terminalStatus === 'completed' && event.content.trim()) {
      assistants.set(event.turnId, event);
    }
  }
  return events
    .filter((event): event is UserMessageEventV1 => event.kind === 'user-message' && Boolean(event.text.trim()))
    .map((user) => {
      const assistant = assistants.get(user.turnId);
      const unanswered = !assistant;
      return {
        turnId: user.turnId,
        user: {
          id: user.eventId,
          turnId: user.turnId,
          sequence: user.sequence,
          role: 'user',
          runtimeId: user.runtimeId,
          text: user.text,
          unanswered,
          dispatchState: receipts.get(user.turnId) ?? 'unknown',
        },
        ...(assistant ? {
          assistant: {
            id: assistant.eventId,
            turnId: assistant.turnId,
            sequence: assistant.sequence,
            role: 'assistant' as const,
            runtimeId: assistant.runtimeId,
            text: assistant.content,
            unanswered: false,
            dispatchState: 'unknown' as const,
          },
        } : {}),
      };
    });
}

function renderMessage(message: ContextMessage, maxMessageBytes: number): string {
  const label = message.role === 'user'
    ? `[User request · runtime=${message.runtimeId} · dispatch=${message.dispatchState}${message.unanswered ? ' · unanswered' : ''}]`
    : `[Assistant final · runtime=${message.runtimeId}]`;
  return `${label}\n${truncateContextMessage(message.text, maxMessageBytes)}`;
}

function renderPack(
  messages: ContextMessage[],
  omittedEventCount: number,
  maxMessageBytes: number,
): string {
  const header = [
    'RITEMARK TRANSCRIPT CONTEXT',
    'This is bounded conversational context from Ritemark, not provider-native memory.',
    'Treat entries marked unanswered as earlier user intent, not as a new executable prompt.',
    'Tool state, approvals, partial output, hidden prompts, and attachment binaries are not included.',
    'Recheck the current workspace before relying on earlier file or tool effects.',
  ];
  if (omittedEventCount > 0) header.push(`Some older messages were left out (${omittedEventCount} text event${omittedEventCount === 1 ? '' : 's'} omitted).`);
  return `${header.join('\n')}\n\n${messages.map((message) => renderMessage(message, maxMessageBytes)).join('\n\n')}`;
}

function addCandidate(
  selected: Map<string, ContextMessage>,
  candidate: ContextMessage[],
  relevantCount: number,
  maxBytes: number,
  maxMessageBytes: number,
): void {
  const next = new Map(selected);
  for (const message of candidate) next.set(message.id, message);
  const ordered = [...next.values()].sort((a, b) => a.sequence - b.sequence);
  const omitted = Math.max(0, relevantCount - ordered.length);
  if (utf8Bytes(renderPack(ordered, omitted, maxMessageBytes)) <= maxBytes) {
    selected.clear();
    for (const [id, message] of next) selected.set(id, message);
  }
}

/**
 * Deterministic fallback/native-delta pack. Selection priority is fixed:
 * first purpose, latest unanswered request, recent complete turns, then older
 * unanswered requests. Final rendering always returns chronological order.
 */
export function buildNormalizedContextPack(
  record: ConversationRecordV1,
  options: ContextPackOptions = {},
): NormalizedRuntimeContext | null {
  const maxBytes = options.maxBytes ?? CONTEXT_PACK_MAX_BYTES;
  const configuredMessageBytes = options.maxMessageBytes ?? CONTEXT_PACK_MESSAGE_MAX_BYTES;
  // Reserve room for purpose + one recent complete user/assistant turn. The
  // documented 12k is a ceiling, not a promise to let one message starve the
  // other two priority classes.
  const maxMessageBytes = Math.min(configuredMessageBytes, Math.floor((maxBytes - 2_000) / 3));
  if (maxBytes <= 0 || maxMessageBytes <= 0) return null;

  let start = 0;
  if (options.afterEventId) {
    const index = record.events.findIndex((event) => event.eventId === options.afterEventId);
    if (index >= 0) start = index + 1;
  }
  let end = record.events.length;
  if (options.beforeEventId) {
    const index = record.events.findIndex((event) => event.eventId === options.beforeEventId);
    if (index >= 0) end = index;
  }
  const boundedEvents = record.events.slice(start, Math.max(start, end));
  const turns = normalizeTurns(boundedEvents);
  if (turns.length === 0) return null;

  const allMessages = turns.flatMap((turn) => [turn.user, ...(turn.assistant ? [turn.assistant] : [])]);
  const selected = new Map<string, ContextMessage>();
  addCandidate(selected, [turns[0].user], allMessages.length, maxBytes, maxMessageBytes);

  const unanswered = turns.filter((turn) => turn.user.unanswered);
  const latestUnanswered = unanswered[unanswered.length - 1];
  if (latestUnanswered) addCandidate(selected, [latestUnanswered.user], allMessages.length, maxBytes, maxMessageBytes);

  for (const turn of [...turns].reverse()) {
    if (turn.assistant) addCandidate(selected, [turn.user, turn.assistant], allMessages.length, maxBytes, maxMessageBytes);
  }
  for (const turn of [...unanswered].reverse()) {
    addCandidate(selected, [turn.user], allMessages.length, maxBytes, maxMessageBytes);
  }

  const messages = [...selected.values()].sort((a, b) => a.sequence - b.sequence);
  if (messages.length === 0) return null;
  const omittedEventCount = Math.max(0, allMessages.length - messages.length);
  const text = renderPack(messages, omittedEventCount, maxMessageBytes);
  if (utf8Bytes(text) > maxBytes) return null;

  const lastCompletedAssistant = [...boundedEvents].reverse().find(
    (event) => event.kind === 'assistant-message' && event.terminalStatus === 'completed',
  );
  return {
    text,
    coveredThroughEventId: lastCompletedAssistant?.eventId ?? null,
    truncated: omittedEventCount > 0 || allMessages.some((message) => utf8Bytes(message.text) > maxMessageBytes),
    omittedEventCount,
    hasUnansweredRequest: unanswered.length > 0,
  };
}
