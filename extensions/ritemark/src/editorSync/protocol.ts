export type EditableDocumentFileType = 'markdown' | 'csv';

export interface DocumentFeaturePayload {
  voiceDictation: boolean;
  markdownExport: boolean;
  saveAsMarkdownFromPreview?: boolean;
  commentCallouts?: boolean;
}

export type DocumentRenderPayload =
  | {
      fileType: 'markdown';
      filename: string;
      content: string;
      properties: Record<string, unknown>;
      hasProperties: boolean;
      imageMappings: Record<string, string>;
      features: DocumentFeaturePayload;
      isAgentMode?: boolean;
      agentFrontmatter?: Record<string, unknown>;
      agentFlows?: string[];
      agentSkills?: unknown[];
    }
  | {
      fileType: 'csv';
      filename: string;
      content: string;
      sizeBytes: number;
    };

interface DocumentIdentity {
  uri: string;
  documentSessionId: string;
  viewEpoch: string;
}

export type DocumentUpdateReason =
  | 'open'
  | 'external'
  | 'peer-edit'
  | 'undo-redo'
  | 'revert'
  | 'resolution';

export type DocumentSyncState =
  | 'synced'
  | 'local-only'
  | 'applying'
  | 'conflict'
  | 'apply-error'
  | 'failed';

export type DocumentHostMessage =
  | (DocumentIdentity & {
      type: 'document:update';
      revision: number;
      baseDiskHash: string;
      modelHash: string;
      payloadHash: string;
      reason: DocumentUpdateReason;
      attempt: number;
      payload: DocumentRenderPayload;
    })
  | (DocumentIdentity & {
      type: 'document:sync-state';
      state: DocumentSyncState;
      revision: number;
      acknowledgedRevision: number;
      attempt?: number;
      message?: string;
      conflictRevision?: number;
      diskHash?: string;
    })
  | (DocumentIdentity & {
      type: 'document:edit-result';
      clientSequence: number;
      status: 'accepted' | 'stale' | 'rejected';
      revision: number;
      payloadHash?: string;
      message?: string;
    })
  | (DocumentIdentity & {
      type: 'document:conflict';
      conflictRevision: number;
      revision: number;
      diskHash: string;
      filename: string;
    });

export type DocumentEditPayload =
  | { fileType: 'markdown'; content: string; properties: Record<string, unknown> }
  | { fileType: 'csv'; content: string };

export type DocumentViewMessage =
  | (DocumentIdentity & { type: 'document:ready' })
  | (DocumentIdentity & {
      type: 'document:applied';
      revision: number;
      payloadHash: string;
    })
  | (DocumentIdentity & {
      type: 'document:edit';
      basedOnRevision: number;
      clientSequence: number;
      payload: DocumentEditPayload;
    })
  | (DocumentIdentity & {
      type: 'document:conflict-action';
      action: 'retry-apply';
    })
  | (DocumentIdentity & {
      type: 'document:conflict-action';
      conflictRevision: number;
      diskHash: string;
      action: 'compare' | 'keep-local' | 'use-disk';
    });

export interface DocumentSyncBootstrap {
  uri: string;
  documentSessionId: string;
  viewEpoch: string;
}

export class DocumentProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentProtocolError';
  }
}

const VIEW_TYPES = new Set<DocumentViewMessage['type']>([
  'document:ready',
  'document:applied',
  'document:edit',
  'document:conflict-action',
]);

const HOST_TYPES = new Set<DocumentHostMessage['type']>([
  'document:update',
  'document:sync-state',
  'document:edit-result',
  'document:conflict',
]);

const UPDATE_REASONS = new Set<DocumentUpdateReason>([
  'open', 'external', 'peer-edit', 'undo-redo', 'revert', 'resolution',
]);

const SYNC_STATES = new Set<DocumentSyncState>([
  'synced', 'local-only', 'applying', 'conflict', 'apply-error', 'failed',
]);

const CONFLICT_ACTIONS = new Set(['compare', 'keep-local', 'use-disk', 'retry-apply']);
const EDIT_RESULTS = new Set(['accepted', 'stale', 'rejected']);
const MAX_CONTENT_LENGTH = 25 * 1024 * 1024;

export function isDocumentViewMessage(value: unknown): boolean {
  return isObject(value) && VIEW_TYPES.has(value.type as DocumentViewMessage['type']);
}

export function isDocumentHostMessage(value: unknown): value is DocumentHostMessage {
  if (!isObject(value) || !HOST_TYPES.has(value.type as DocumentHostMessage['type'])) return false;
  try {
    parseDocumentHostMessage(value);
    return true;
  } catch {
    return false;
  }
}

export function parseDocumentViewMessage(value: unknown): DocumentViewMessage {
  const input = object(value);
  const type = requiredString(input, 'type', 64) as DocumentViewMessage['type'];
  if (!VIEW_TYPES.has(type)) throw new DocumentProtocolError(`Unknown document message type: ${type}`);
  const identity = parseIdentity(input);

  if (type === 'document:ready') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch']);
    return { type, ...identity };
  }
  if (type === 'document:applied') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'revision', 'payloadHash']);
    return { type, ...identity, revision: integer(input, 'revision'), payloadHash: hash(input, 'payloadHash') };
  }
  if (type === 'document:edit') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'basedOnRevision', 'clientSequence', 'payload']);
    return {
      type,
      ...identity,
      basedOnRevision: integer(input, 'basedOnRevision'),
      clientSequence: integer(input, 'clientSequence'),
      payload: parseEditPayload(input.payload),
    };
  }

  const action = requiredString(input, 'action', 32);
  if (!CONFLICT_ACTIONS.has(action)) throw new DocumentProtocolError('Unknown conflict action');
  if (action === 'retry-apply') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'action']);
    return { type, ...identity, action };
  }
  exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'conflictRevision', 'diskHash', 'action']);
  return {
    type,
    ...identity,
    conflictRevision: integer(input, 'conflictRevision'),
    diskHash: hash(input, 'diskHash'),
    action: action as 'compare' | 'keep-local' | 'use-disk',
  };
}

export function parseDocumentHostMessage(value: unknown): DocumentHostMessage {
  const input = object(value);
  const type = requiredString(input, 'type', 64) as DocumentHostMessage['type'];
  if (!HOST_TYPES.has(type)) throw new DocumentProtocolError(`Unknown document host message type: ${type}`);
  const identity = parseIdentity(input);

  if (type === 'document:update') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'revision', 'baseDiskHash', 'modelHash', 'payloadHash', 'reason', 'attempt', 'payload']);
    const reason = requiredString(input, 'reason', 32) as DocumentUpdateReason;
    if (!UPDATE_REASONS.has(reason)) throw new DocumentProtocolError('Unknown update reason');
    return {
      type,
      ...identity,
      revision: integer(input, 'revision'),
      baseDiskHash: hash(input, 'baseDiskHash'),
      modelHash: hash(input, 'modelHash'),
      payloadHash: hash(input, 'payloadHash'),
      reason,
      attempt: positiveInteger(input, 'attempt'),
      payload: parseRenderPayload(input.payload),
    };
  }
  if (type === 'document:sync-state') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'state', 'revision', 'acknowledgedRevision', 'attempt', 'message', 'conflictRevision', 'diskHash']);
    const state = requiredString(input, 'state', 32) as DocumentSyncState;
    if (!SYNC_STATES.has(state)) throw new DocumentProtocolError('Unknown sync state');
    return {
      type,
      ...identity,
      state,
      revision: integer(input, 'revision'),
      acknowledgedRevision: integer(input, 'acknowledgedRevision'),
      ...(input.attempt === undefined ? {} : { attempt: positiveInteger(input, 'attempt') }),
      ...(input.message === undefined ? {} : { message: requiredString(input, 'message', 512) }),
      ...(input.conflictRevision === undefined ? {} : { conflictRevision: integer(input, 'conflictRevision') }),
      ...(input.diskHash === undefined ? {} : { diskHash: hash(input, 'diskHash') }),
    };
  }
  if (type === 'document:edit-result') {
    exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'clientSequence', 'status', 'revision', 'payloadHash', 'message']);
    const status = requiredString(input, 'status', 16);
    if (!EDIT_RESULTS.has(status)) throw new DocumentProtocolError('Unknown edit result');
    return {
      type,
      ...identity,
      clientSequence: integer(input, 'clientSequence'),
      status: status as 'accepted' | 'stale' | 'rejected',
      revision: integer(input, 'revision'),
      ...(input.payloadHash === undefined ? {} : { payloadHash: hash(input, 'payloadHash') }),
      ...(input.message === undefined ? {} : { message: requiredString(input, 'message', 512) }),
    };
  }

  exactKeys(input, ['type', 'uri', 'documentSessionId', 'viewEpoch', 'conflictRevision', 'revision', 'diskHash', 'filename']);
  return {
    type,
    ...identity,
    conflictRevision: integer(input, 'conflictRevision'),
    revision: integer(input, 'revision'),
    diskHash: hash(input, 'diskHash'),
    filename: requiredString(input, 'filename', 512),
  };
}

function parseIdentity(input: Record<string, unknown>): DocumentIdentity {
  return {
    uri: requiredString(input, 'uri', 16_384),
    documentSessionId: requiredString(input, 'documentSessionId', 128),
    viewEpoch: requiredString(input, 'viewEpoch', 128),
  };
}

function parseEditPayload(value: unknown): DocumentEditPayload {
  const input = object(value);
  const fileType = requiredString(input, 'fileType', 16);
  const content = requiredString(input, 'content', MAX_CONTENT_LENGTH, true);
  if (fileType === 'csv') {
    exactKeys(input, ['fileType', 'content']);
    return { fileType, content };
  }
  if (fileType === 'markdown') {
    exactKeys(input, ['fileType', 'content', 'properties']);
    return { fileType, content, properties: record(input.properties, 'properties') };
  }
  throw new DocumentProtocolError('Unknown editable file type');
}

function parseRenderPayload(value: unknown): DocumentRenderPayload {
  const input = object(value);
  const fileType = requiredString(input, 'fileType', 16);
  const filename = requiredString(input, 'filename', 512);
  const content = requiredString(input, 'content', MAX_CONTENT_LENGTH, true);
  if (fileType === 'csv') {
    exactKeys(input, ['fileType', 'filename', 'content', 'sizeBytes']);
    return { fileType, filename, content, sizeBytes: integer(input, 'sizeBytes') };
  }
  if (fileType !== 'markdown') throw new DocumentProtocolError('Unknown render file type');
  exactKeys(input, ['fileType', 'filename', 'content', 'properties', 'hasProperties', 'imageMappings', 'features', 'isAgentMode', 'agentFrontmatter', 'agentFlows', 'agentSkills']);
  if (typeof input.hasProperties !== 'boolean') throw new DocumentProtocolError('hasProperties must be boolean');
  if (input.isAgentMode !== undefined && typeof input.isAgentMode !== 'boolean') throw new DocumentProtocolError('isAgentMode must be boolean');
  const features = record(input.features, 'features');
  exactKeys(features, ['voiceDictation', 'markdownExport', 'saveAsMarkdownFromPreview', 'commentCallouts']);
  if (typeof features.voiceDictation !== 'boolean' || typeof features.markdownExport !== 'boolean') {
    throw new DocumentProtocolError('Document features are malformed');
  }
  if (features.saveAsMarkdownFromPreview !== undefined && typeof features.saveAsMarkdownFromPreview !== 'boolean') {
    throw new DocumentProtocolError('saveAsMarkdownFromPreview must be boolean');
  }
  if (features.commentCallouts !== undefined && typeof features.commentCallouts !== 'boolean') {
    throw new DocumentProtocolError('commentCallouts must be boolean');
  }
  return {
    fileType,
    filename,
    content,
    properties: record(input.properties, 'properties'),
    hasProperties: input.hasProperties,
    imageMappings: stringRecord(input.imageMappings, 'imageMappings'),
    features: {
      voiceDictation: features.voiceDictation,
      markdownExport: features.markdownExport,
      ...(typeof features.saveAsMarkdownFromPreview === 'boolean' ? { saveAsMarkdownFromPreview: features.saveAsMarkdownFromPreview } : {}),
      ...(typeof features.commentCallouts === 'boolean' ? { commentCallouts: features.commentCallouts } : {}),
    },
    ...(input.isAgentMode === true ? { isAgentMode: true } : {}),
    ...(input.agentFrontmatter === undefined ? {} : { agentFrontmatter: record(input.agentFrontmatter, 'agentFrontmatter') }),
    ...(input.agentFlows === undefined ? {} : { agentFlows: stringArray(input.agentFlows, 'agentFlows') }),
    ...(input.agentSkills === undefined ? {} : { agentSkills: array(input.agentSkills, 'agentSkills') }),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new DocumentProtocolError('Message must be an object');
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, key: string): Record<string, unknown> {
  if (!isObject(value)) throw new DocumentProtocolError(`${key} must be an object`);
  return value;
}

function stringRecord(value: unknown, key: string): Record<string, string> {
  const input = record(value, key);
  if (Object.values(input).some(item => typeof item !== 'string')) throw new DocumentProtocolError(`${key} must contain strings`);
  return input as Record<string, string>;
}

function array(value: unknown, key: string): unknown[] {
  if (!Array.isArray(value)) throw new DocumentProtocolError(`${key} must be an array`);
  return value;
}

function stringArray(value: unknown, key: string): string[] {
  const input = array(value, key);
  if (input.some(item => typeof item !== 'string')) throw new DocumentProtocolError(`${key} must contain strings`);
  return input as string[];
}

function requiredString(input: Record<string, unknown>, key: string, max: number, allowEmpty = false): string {
  const value = input[key];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > max) {
    throw new DocumentProtocolError(`${key} must be a string of at most ${max} characters`);
  }
  return value;
}

function integer(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DocumentProtocolError(`${key} must be a non-negative safe integer`);
  return value as number;
}

function positiveInteger(input: Record<string, unknown>, key: string): number {
  const value = integer(input, key);
  if (value < 1) throw new DocumentProtocolError(`${key} must be positive`);
  return value;
}

function hash(input: Record<string, unknown>, key: string): string {
  const value = requiredString(input, key, 128);
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new DocumentProtocolError(`${key} must be a SHA-256 hash`);
  return value.toLowerCase();
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowlist = new Set(allowed);
  const extra = Object.keys(input).find(key => !allowlist.has(key));
  if (extra) throw new DocumentProtocolError(`Unknown document message field: ${extra}`);
}
