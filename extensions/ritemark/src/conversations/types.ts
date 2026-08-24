import type { AgentId } from '../agent/types';
import {
  RUNTIME_CONTINUATION_DESCRIPTOR_VERSION,
  type RuntimeContinuationDescriptorV1,
} from '../runtime/continuation';
import {
  CONVERSATION_IDENTITY_COLOR_SLOT_COUNT,
  isConversationIdentityColorSlot,
} from './identityColor';
import {
  isExplicitThinkingEffort,
  isThinkingEffort,
  type ExplicitThinkingEffort,
  type ThinkingEffort,
} from '../runtime/thinkingEffort';

export const CONVERSATION_SCHEMA_VERSION = 1 as const;
export const CONVERSATION_INDEX_VERSION = 1 as const;

/** `legacy-ritemark` is display-only provenance; it is never dispatchable. */
export type RuntimeId = AgentId | 'legacy-ritemark';

export type ProjectScopeKindV1 =
  | 'single-root'
  | 'multi-root'
  | 'workspace-file'
  | 'no-folder'
  | 'unassigned-legacy';

export interface ProjectScopeDescriptorV1 {
  kind: ProjectScopeKindV1;
  workspaceFileUri: string | null;
  folderUris: string[];
}

export type ConversationLifecycleV1 =
  | { state: 'idle' }
  | { state: 'working'; activeTurnId: string }
  | {
      state: 'needs-user';
      activeTurnId: string;
      attentionKind: 'approval' | 'question' | 'plan-review';
    }
  | {
      state: 'interrupted';
      turnId: string | null;
      reason: 'restart' | 'cancelled' | 'failed' | 'deleted-running' | 'runtime-released';
    };

export interface ConversationEventBaseV1 {
  eventId: string;
  turnId: string;
  sequence: number;
  occurredAt: string;
  runtimeId: RuntimeId;
}

export interface ConversationAttachmentMetadataV1 {
  name: string;
  kind: string;
  mediaType: string | null;
  sizeBytes: number | null;
}

export interface UserMessageEventV1 extends ConversationEventBaseV1 {
  kind: 'user-message';
  text: string;
  mode: string | null;
  attachments: ConversationAttachmentMetadataV1[];
  /** Immutable accepted-turn snapshot. Missing in pre-Sprint-112 records = Auto. */
  thinkingEffort?: ThinkingEffort;
}

export interface AssistantMessageEventV1 extends ConversationEventBaseV1 {
  kind: 'assistant-message';
  content: string;
  terminalStatus: 'completed' | 'failed' | 'cancelled' | null;
  /** Provider-observed applied value; absent/null means the provider did not expose it. */
  appliedThinkingEffort?: ExplicitThinkingEffort | null;
}

export interface ActivityEventV1 extends ConversationEventBaseV1 {
  kind: 'activity';
  title: string;
  status: string | null;
  fileReferences: string[];
  planSteps: string[];
}

export interface AttentionEventV1 extends ConversationEventBaseV1 {
  kind: 'attention';
  attentionKind: 'approval' | 'question' | 'plan-review';
  prompt: string;
  summary: string | null;
  attentionState: 'pending' | 'resolved' | 'invalidated';
}

export interface BoundaryEventV1 extends ConversationEventBaseV1 {
  kind: 'boundary';
  boundaryKind: 'failed' | 'cancelled' | 'interrupted' | 'context-restored';
  message: string;
}

export type DispatchReceiptStateV1 = 'not-sent' | 'ambiguous' | 'accepted';

/** Host-only transport certainty; contains no provider reference or content. */
export interface DispatchReceiptEventV1 extends ConversationEventBaseV1 {
  kind: 'dispatch-receipt';
  dispatchState: DispatchReceiptStateV1;
}

export type ConversationEventV1 =
  | UserMessageEventV1
  | AssistantMessageEventV1
  | ActivityEventV1
  | AttentionEventV1
  | BoundaryEventV1
  | DispatchReceiptEventV1;

export type ContinuationDescriptorsV1 = Partial<Record<AgentId, RuntimeContinuationDescriptorV1>>;

export interface MigrationProvenanceV1 {
  source: 'legacy-scoped' | 'legacy-global' | 'legacy-recovery';
  sourceKey: string;
  sourceId: string | null;
  checksum: string;
  migratedAt: string;
}

export interface ConversationComposerPreferencesV1 {
  thinkingEffortByRuntime: Partial<Record<AgentId, ThinkingEffort>>;
}

export interface ConversationRecordV1 {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversationId: string;
  scopeId: string;
  scope: ProjectScopeDescriptorV1;
  title: string;
  identityColorSlot: number;
  createdAt: string;
  lastActivityAt: string;
  revision: number;
  bindingGeneration: number;
  lifecycle: ConversationLifecycleV1;
  runtimeSummary: RuntimeId[];
  events: ConversationEventV1[];
  composerPreferences: ConversationComposerPreferencesV1;
  continuations?: ContinuationDescriptorsV1;
  migration?: MigrationProvenanceV1;
}

export interface TombstoneV1 {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversationId: string;
  scopeId: string;
  deletedGeneration: number;
  deletedAt: string;
}

export interface ConversationSummaryV1 {
  conversationId: string;
  scopeId: string;
  title: string;
  identityColorSlot: number;
  createdAt: string;
  lastActivityAt: string;
  revision: number;
  bindingGeneration: number;
  lifecycle: ConversationLifecycleV1;
  runtimeSummary: RuntimeId[];
  integrity: 'verified' | 'corrupt';
  lastVerifiedAt: string;
}

export interface ConversationIndexV1 {
  schemaVersion: typeof CONVERSATION_INDEX_VERSION;
  updatedAt: string;
  entries: ConversationSummaryV1[];
}

export interface ConversationStoreDiagnostics {
  recordCount: number;
  tombstoneCount: number;
  corruptCount: number;
  quarantineCount: number;
  totalBytes: number;
  degraded: boolean;
  lastError: string | null;
  baseDir: string;
}

export interface ConversationCreateInputV1 {
  conversationId?: string;
  scopeId: string;
  scope: ProjectScopeDescriptorV1;
  title: string;
  createdAt?: string;
  lastActivityAt?: string;
  lifecycle?: ConversationLifecycleV1;
  events?: ConversationEventV1[];
  composerPreferences?: ConversationComposerPreferencesV1;
  continuations?: ContinuationDescriptorsV1;
  migration?: MigrationProvenanceV1;
}

export interface ConversationCheckpointV1 {
  conversationId: string;
  bindingGeneration: number;
  expectedRevision?: number;
  title?: string;
  lifecycle?: ConversationLifecycleV1;
  appendEvents?: ConversationEventV1[];
  composerPreferences?: ConversationComposerPreferencesV1;
  continuationUpdate?: { runtimeId: AgentId; descriptor: RuntimeContinuationDescriptorV1 | null };
}

export interface ConversationDeleteResultV1 {
  conversationId: string;
  undoToken: string;
  deletedAt: string;
}

const RUNTIME_IDS = new Set<RuntimeId>(['claude-code', 'codex', 'opencode', 'legacy-ritemark']);
const AGENT_RUNTIME_IDS = new Set<AgentId>(['claude-code', 'codex', 'opencode']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPE_ID_PATTERN = /^ps1-[0-9a-f]{40}$/;

export class ConversationCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationCodecError';
  }
}

function fail(path: string, expectation: string): never {
  throw new ConversationCodecError(`${path} must be ${expectation}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'an object');
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string');
  return value;
}

function nullableStringAt(value: unknown, path: string): string | null {
  if (value === null) return null;
  return stringAt(value, path);
}

function integerAt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(path, 'a non-negative safe integer');
  return value as number;
}

function identityColorSlotAt(value: unknown, path: string): number {
  if (!isConversationIdentityColorSlot(value)) {
    fail(path, `an integer from 0 to ${CONVERSATION_IDENTITY_COLOR_SLOT_COUNT - 1}`);
  }
  return value;
}

function isoAt(value: unknown, path: string): string {
  const result = stringAt(value, path);
  if (!result || !Number.isFinite(Date.parse(result))) fail(path, 'an ISO-8601 timestamp');
  return result;
}

function enumAt<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, `one of ${values.join(', ')}`);
  return value as T;
}

function stringArrayAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  return value.map((item, index) => stringAt(item, `${path}[${index}]`));
}

function runtimeAt(value: unknown, path: string): RuntimeId {
  const runtime = stringAt(value, path) as RuntimeId;
  if (!RUNTIME_IDS.has(runtime)) fail(path, 'a known runtime id');
  return runtime;
}

function agentRuntimeAt(value: unknown, path: string): AgentId {
  const runtime = stringAt(value, path) as AgentId;
  if (!AGENT_RUNTIME_IDS.has(runtime)) fail(path, 'a dispatchable runtime id');
  return runtime;
}

export function isConversationId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertConversationId(value: string): void {
  if (!isConversationId(value)) fail('conversationId', 'a UUID');
}

export function decodeProjectScopeDescriptorV1(value: unknown, path = 'scope'): ProjectScopeDescriptorV1 {
  const input = objectAt(value, path);
  const kind = enumAt(input.kind, `${path}.kind`, [
    'single-root',
    'multi-root',
    'workspace-file',
    'no-folder',
    'unassigned-legacy',
  ] as const);
  const descriptor: ProjectScopeDescriptorV1 = {
    kind,
    workspaceFileUri: nullableStringAt(input.workspaceFileUri, `${path}.workspaceFileUri`),
    folderUris: stringArrayAt(input.folderUris, `${path}.folderUris`),
  };
  if (kind === 'no-folder' && (descriptor.workspaceFileUri !== null || descriptor.folderUris.length !== 0)) {
    fail(path, 'a canonical no-folder descriptor');
  }
  if (kind === 'unassigned-legacy' && descriptor.workspaceFileUri !== null) {
    fail(path, 'an unassigned legacy descriptor without a workspace file');
  }
  if (kind === 'single-root' && descriptor.folderUris.length !== 1) fail(path, 'a single-root descriptor');
  if (kind === 'multi-root' && descriptor.folderUris.length < 2) fail(path, 'a multi-root descriptor');
  if (kind === 'workspace-file' && descriptor.workspaceFileUri === null) fail(path, 'a workspace-file descriptor');
  return descriptor;
}

export function decodeConversationLifecycleV1(value: unknown, path = 'lifecycle'): ConversationLifecycleV1 {
  const input = objectAt(value, path);
  const state = enumAt(input.state, `${path}.state`, ['idle', 'working', 'needs-user', 'interrupted'] as const);
  if (state === 'idle') return { state };
  if (state === 'working') return { state, activeTurnId: stringAt(input.activeTurnId, `${path}.activeTurnId`) };
  if (state === 'needs-user') {
    return {
      state,
      activeTurnId: stringAt(input.activeTurnId, `${path}.activeTurnId`),
      attentionKind: enumAt(input.attentionKind, `${path}.attentionKind`, ['approval', 'question', 'plan-review'] as const),
    };
  }
  return {
    state,
    turnId: nullableStringAt(input.turnId, `${path}.turnId`),
    reason: enumAt(input.reason, `${path}.reason`, ['restart', 'cancelled', 'failed', 'deleted-running', 'runtime-released'] as const),
  };
}

function decodeEventBase(value: unknown, path: string): { input: Record<string, unknown>; base: ConversationEventBaseV1 } {
  const input = objectAt(value, path);
  return {
    input,
    base: {
      eventId: stringAt(input.eventId, `${path}.eventId`),
      turnId: stringAt(input.turnId, `${path}.turnId`),
      sequence: integerAt(input.sequence, `${path}.sequence`),
      occurredAt: isoAt(input.occurredAt, `${path}.occurredAt`),
      runtimeId: runtimeAt(input.runtimeId, `${path}.runtimeId`),
    },
  };
}

export function decodeConversationEventV1(value: unknown, path = 'event'): ConversationEventV1 {
  const { input, base } = decodeEventBase(value, path);
  const kind = enumAt(input.kind, `${path}.kind`, ['user-message', 'assistant-message', 'activity', 'attention', 'boundary', 'dispatch-receipt'] as const);
  if (kind === 'user-message') {
    if (!Array.isArray(input.attachments)) fail(`${path}.attachments`, 'an array');
    const thinkingEffort = input.thinkingEffort === undefined
      ? 'auto'
      : isThinkingEffort(input.thinkingEffort)
        ? input.thinkingEffort
        : fail(`${path}.thinkingEffort`, 'a canonical thinking effort');
    return {
      ...base,
      kind,
      text: stringAt(input.text, `${path}.text`),
      mode: nullableStringAt(input.mode, `${path}.mode`),
      attachments: input.attachments.map((attachment, index) => {
        const item = objectAt(attachment, `${path}.attachments[${index}]`);
        return {
          name: stringAt(item.name, `${path}.attachments[${index}].name`),
          kind: stringAt(item.kind, `${path}.attachments[${index}].kind`),
          mediaType: nullableStringAt(item.mediaType, `${path}.attachments[${index}].mediaType`),
          sizeBytes: item.sizeBytes === null ? null : integerAt(item.sizeBytes, `${path}.attachments[${index}].sizeBytes`),
        };
      }),
      thinkingEffort,
    };
  }
  if (kind === 'assistant-message') {
    const appliedThinkingEffort = input.appliedThinkingEffort === undefined || input.appliedThinkingEffort === null
      ? null
      : isExplicitThinkingEffort(input.appliedThinkingEffort)
        ? input.appliedThinkingEffort
        : fail(`${path}.appliedThinkingEffort`, 'a canonical explicit thinking effort or null');
    return {
      ...base,
      kind,
      content: stringAt(input.content, `${path}.content`),
      terminalStatus: input.terminalStatus === null
        ? null
        : enumAt(input.terminalStatus, `${path}.terminalStatus`, ['completed', 'failed', 'cancelled'] as const),
      appliedThinkingEffort,
    };
  }
  if (kind === 'activity') {
    return {
      ...base,
      kind,
      title: stringAt(input.title, `${path}.title`),
      status: nullableStringAt(input.status, `${path}.status`),
      fileReferences: stringArrayAt(input.fileReferences, `${path}.fileReferences`),
      planSteps: stringArrayAt(input.planSteps, `${path}.planSteps`),
    };
  }
  if (kind === 'attention') {
    return {
      ...base,
      kind,
      attentionKind: enumAt(input.attentionKind, `${path}.attentionKind`, ['approval', 'question', 'plan-review'] as const),
      prompt: stringAt(input.prompt, `${path}.prompt`),
      summary: nullableStringAt(input.summary, `${path}.summary`),
      attentionState: enumAt(input.attentionState, `${path}.attentionState`, ['pending', 'resolved', 'invalidated'] as const),
    };
  }
  if (kind === 'dispatch-receipt') {
    return {
      ...base,
      kind,
      runtimeId: agentRuntimeAt(input.runtimeId, `${path}.runtimeId`),
      dispatchState: enumAt(input.dispatchState, `${path}.dispatchState`, ['not-sent', 'ambiguous', 'accepted'] as const),
    };
  }
  return {
    ...base,
    kind,
    boundaryKind: enumAt(input.boundaryKind, `${path}.boundaryKind`, ['failed', 'cancelled', 'interrupted', 'context-restored'] as const),
    message: stringAt(input.message, `${path}.message`),
  };
}

function decodeContinuation(value: unknown, path: string): RuntimeContinuationDescriptorV1 {
  const input = objectAt(value, path);
  const descriptorVersion = input.descriptorVersion === undefined
    ? RUNTIME_CONTINUATION_DESCRIPTOR_VERSION
    : integerAt(input.descriptorVersion, `${path}.descriptorVersion`);
  if (descriptorVersion !== RUNTIME_CONTINUATION_DESCRIPTOR_VERSION) {
    fail(`${path}.descriptorVersion`, `${RUNTIME_CONTINUATION_DESCRIPTOR_VERSION}`);
  }
  return {
    descriptorVersion,
    runtimeId: agentRuntimeAt(input.runtimeId, `${path}.runtimeId`),
    nativeReference: stringAt(input.nativeReference, `${path}.nativeReference`),
    scopeId: stringAt(input.scopeId, `${path}.scopeId`),
    runtimeVersion: stringAt(input.runtimeVersion, `${path}.runtimeVersion`),
    adapterContractVersion: integerAt(input.adapterContractVersion, `${path}.adapterContractVersion`),
    modelId: nullableStringAt(input.modelId, `${path}.modelId`),
    compatibilityFingerprint: stringAt(input.compatibilityFingerprint, `${path}.compatibilityFingerprint`),
    coveredThroughEventId: nullableStringAt(input.coveredThroughEventId, `${path}.coveredThroughEventId`),
    capturedAt: isoAt(input.capturedAt, `${path}.capturedAt`),
  };
}

function decodeContinuations(value: unknown, path: string): ContinuationDescriptorsV1 {
  const input = objectAt(value, path);
  const descriptors: ContinuationDescriptorsV1 = {};
  for (const [key, raw] of Object.entries(input)) {
    const runtimeId = agentRuntimeAt(key, `${path}.${key}`);
    const descriptor = decodeContinuation(raw, `${path}.${key}`);
    if (descriptor.runtimeId !== runtimeId) fail(`${path}.${key}.runtimeId`, `equal to map key ${runtimeId}`);
    descriptors[runtimeId] = descriptor;
  }
  return descriptors;
}

/** Sprint 109 migration input: preserved but deliberately incompatible. */
function decodeLegacyContinuation(
  value: unknown,
  scopeId: string,
): ContinuationDescriptorsV1 {
  const input = objectAt(value, 'continuation');
  const runtimeId = agentRuntimeAt(input.runtimeId, 'continuation.runtimeId');
  return {
    [runtimeId]: {
      descriptorVersion: RUNTIME_CONTINUATION_DESCRIPTOR_VERSION,
      runtimeId,
      nativeReference: stringAt(input.nativeReference, 'continuation.nativeReference'),
      scopeId,
      runtimeVersion: 'legacy-unknown',
      adapterContractVersion: integerAt(input.compatibilityVersion, 'continuation.compatibilityVersion'),
      modelId: null,
      compatibilityFingerprint: 'legacy-incompatible',
      coveredThroughEventId: null,
      capturedAt: isoAt(input.capturedAt, 'continuation.capturedAt'),
    },
  };
}

function decodeMigration(value: unknown, path: string): MigrationProvenanceV1 {
  const input = objectAt(value, path);
  return {
    source: enumAt(input.source, `${path}.source`, ['legacy-scoped', 'legacy-global', 'legacy-recovery'] as const),
    sourceKey: stringAt(input.sourceKey, `${path}.sourceKey`),
    sourceId: nullableStringAt(input.sourceId, `${path}.sourceId`),
    checksum: stringAt(input.checksum, `${path}.checksum`),
    migratedAt: isoAt(input.migratedAt, `${path}.migratedAt`),
  };
}

function decodeComposerPreferences(value: unknown, path: string): ConversationComposerPreferencesV1 {
  if (value === undefined) return { thinkingEffortByRuntime: {} };
  const input = objectAt(value, path);
  const raw = input.thinkingEffortByRuntime === undefined
    ? {}
    : objectAt(input.thinkingEffortByRuntime, `${path}.thinkingEffortByRuntime`);
  const thinkingEffortByRuntime: Partial<Record<AgentId, ThinkingEffort>> = {};
  for (const [key, effort] of Object.entries(raw)) {
    const runtimeId = agentRuntimeAt(key, `${path}.thinkingEffortByRuntime.${key}`);
    if (!isThinkingEffort(effort)) fail(`${path}.thinkingEffortByRuntime.${key}`, 'a canonical thinking effort');
    thinkingEffortByRuntime[runtimeId] = effort;
  }
  return { thinkingEffortByRuntime };
}

function validateRecordRelationships(record: ConversationRecordV1): void {
  assertConversationId(record.conversationId);
  if (!SCOPE_ID_PATTERN.test(record.scopeId)) fail('scopeId', 'a ps1 scope id');
  if (record.title.trim().length === 0) fail('title', 'non-empty');
  if (record.lastActivityAt < record.createdAt) fail('lastActivityAt', 'at or after createdAt');
  const runtimes = new Set<RuntimeId>();
  let previousSequence = -1;
  for (const event of record.events) {
    if (event.sequence <= previousSequence) fail('events', 'strictly increasing sequence values');
    previousSequence = event.sequence;
    runtimes.add(event.runtimeId);
  }
  if (new Set(record.events.map((event) => event.eventId)).size !== record.events.length) {
    fail('events', 'unique eventId values');
  }
  if (new Set(record.runtimeSummary).size !== record.runtimeSummary.length) fail('runtimeSummary', 'deduplicated');
  if ([...runtimes].some((runtime) => !record.runtimeSummary.includes(runtime))) {
    fail('runtimeSummary', 'to include every event runtime');
  }
  const userTurns = new Map(record.events
    .filter((event): event is UserMessageEventV1 => event.kind === 'user-message')
    .map((event) => [event.turnId, event]));
  const dispatchOrder: DispatchReceiptStateV1[] = ['not-sent', 'ambiguous', 'accepted'];
  const dispatchCount = new Map<string, number>();
  for (const event of record.events) {
    if (event.kind !== 'dispatch-receipt') continue;
    const user = userTurns.get(event.turnId);
    if (!user || user.runtimeId !== event.runtimeId || user.sequence >= event.sequence) {
      fail('events', 'dispatch receipts to follow a matching user message');
    }
    const count = dispatchCount.get(event.turnId) ?? 0;
    if (event.dispatchState !== dispatchOrder[count]) {
      fail('events', 'dispatch receipt states ordered as not-sent, ambiguous, accepted');
    }
    dispatchCount.set(event.turnId, count + 1);
  }
  for (const [runtimeId, descriptor] of Object.entries(record.continuations ?? {}) as Array<[AgentId, RuntimeContinuationDescriptorV1]>) {
    if (descriptor.runtimeId !== runtimeId) fail(`continuations.${runtimeId}.runtimeId`, `equal to map key ${runtimeId}`);
    if (descriptor.scopeId !== record.scopeId) fail(`continuations.${runtimeId}.scopeId`, 'equal to record scopeId');
    if (descriptor.coveredThroughEventId !== null) {
      const covered = record.events.find((event) => event.eventId === descriptor.coveredThroughEventId);
      // Coverage belongs to the canonical transcript, not to the provider that
      // authored the covered event. After an explicit cross-runtime handoff a
      // fresh Codex/Claude/OpenCode session may legitimately cover the last
      // completed answer written by another runtime through fallback context.
      if (!covered || covered.kind !== 'assistant-message' || covered.terminalStatus !== 'completed') {
        fail(`continuations.${runtimeId}.coveredThroughEventId`, 'a completed assistant event in the canonical transcript');
      }
    }
  }
}

export function decodeConversationRecordV1(value: unknown): ConversationRecordV1 {
  const input = objectAt(value, 'record');
  if (input.schemaVersion !== CONVERSATION_SCHEMA_VERSION) fail('schemaVersion', '1');
  if (!Array.isArray(input.runtimeSummary)) fail('runtimeSummary', 'an array');
  if (!Array.isArray(input.events)) fail('events', 'an array');
  const record: ConversationRecordV1 = {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: stringAt(input.conversationId, 'conversationId'),
    scopeId: stringAt(input.scopeId, 'scopeId'),
    scope: decodeProjectScopeDescriptorV1(input.scope),
    title: stringAt(input.title, 'title'),
    identityColorSlot: identityColorSlotAt(input.identityColorSlot, 'identityColorSlot'),
    createdAt: isoAt(input.createdAt, 'createdAt'),
    lastActivityAt: isoAt(input.lastActivityAt, 'lastActivityAt'),
    revision: integerAt(input.revision, 'revision'),
    bindingGeneration: integerAt(input.bindingGeneration, 'bindingGeneration'),
    lifecycle: decodeConversationLifecycleV1(input.lifecycle),
    runtimeSummary: input.runtimeSummary.map((runtime, index) => runtimeAt(runtime, `runtimeSummary[${index}]`)),
    events: input.events.map((event, index) => decodeConversationEventV1(event, `events[${index}]`)),
    composerPreferences: decodeComposerPreferences(input.composerPreferences, 'composerPreferences'),
  };
  if (input.continuations !== undefined) {
    record.continuations = decodeContinuations(input.continuations, 'continuations');
  } else if (input.continuation !== undefined) {
    record.continuations = decodeLegacyContinuation(input.continuation, record.scopeId);
  }
  if (input.migration !== undefined) record.migration = decodeMigration(input.migration, 'migration');
  validateRecordRelationships(record);
  return record;
}

export function decodeTombstoneV1(value: unknown): TombstoneV1 {
  const input = objectAt(value, 'tombstone');
  if (input.schemaVersion !== CONVERSATION_SCHEMA_VERSION) fail('tombstone.schemaVersion', '1');
  const result: TombstoneV1 = {
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    conversationId: stringAt(input.conversationId, 'tombstone.conversationId'),
    scopeId: stringAt(input.scopeId, 'tombstone.scopeId'),
    deletedGeneration: integerAt(input.deletedGeneration, 'tombstone.deletedGeneration'),
    deletedAt: isoAt(input.deletedAt, 'tombstone.deletedAt'),
  };
  assertConversationId(result.conversationId);
  return result;
}

export function summarizeConversationRecord(record: ConversationRecordV1, verifiedAt: string): ConversationSummaryV1 {
  return {
    conversationId: record.conversationId,
    scopeId: record.scopeId,
    title: record.title,
    identityColorSlot: record.identityColorSlot,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    revision: record.revision,
    bindingGeneration: record.bindingGeneration,
    lifecycle: record.lifecycle,
    runtimeSummary: [...record.runtimeSummary],
    integrity: 'verified',
    lastVerifiedAt: verifiedAt,
  };
}
