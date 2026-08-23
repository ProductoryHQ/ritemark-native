import { createHmac } from 'crypto';
import type { AgentId } from '../agent/types';

export const RUNTIME_CONTINUATION_DESCRIPTOR_VERSION = 1 as const;
export const RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION = 1 as const;

export type ContinuationMode =
  | 'not-attempted'
  | 'pending'
  | 'native-restored'
  | 'transcript-restored'
  | 'context-unavailable'
  | 'runtime-unavailable';

export type ContinuationFailureCategory =
  | 'invalid-descriptor'
  | 'incompatible-descriptor'
  | 'authentication'
  | 'runtime-unavailable'
  | 'provider-rejected'
  | 'ambiguous-dispatch'
  | 'no-usable-context';

/**
 * Host-owned provider checkpoint. `nativeReference` never crosses the extension
 * host/webview boundary and must be redacted from diagnostics.
 */
export interface RuntimeContinuationDescriptorV1 {
  descriptorVersion: typeof RUNTIME_CONTINUATION_DESCRIPTOR_VERSION;
  runtimeId: AgentId;
  nativeReference: string;
  scopeId: string;
  runtimeVersion: string;
  adapterContractVersion: number;
  modelId: string | null;
  compatibilityFingerprint: string;
  coveredThroughEventId: string | null;
  capturedAt: string;
}

export interface NormalizedRuntimeContext {
  text: string;
  coveredThroughEventId: string | null;
  truncated: boolean;
  omittedEventCount: number;
  hasUnansweredRequest: boolean;
}

export interface RuntimeContinuationRequest {
  descriptor?: RuntimeContinuationDescriptorV1;
  /** Host-derived exact compatibility target for this accepted Send. */
  compatibility?: RuntimeContinuationCompatibility;
  /** Canonical events not yet covered by a compatible native descriptor. */
  nativeDelta?: NormalizedRuntimeContext;
  /** Full bounded context for a fresh provider session. */
  fallbackContext?: NormalizedRuntimeContext;
}

export interface RuntimeContinuationState {
  mode: ContinuationMode;
  failureCategory?: ContinuationFailureCategory;
  truncated?: boolean;
  unansweredPriorRequest?: boolean;
}

export interface RuntimeContinuationCompatibility {
  runtimeId: AgentId;
  scopeId: string;
  runtimeVersion: string;
  adapterContractVersion: number;
  modelId: string | null;
  compatibilityFingerprint: string;
}

export type RuntimeContinuationCompatibilityResult =
  | { compatible: true }
  | {
      compatible: false;
      reason:
        | 'runtime'
        | 'scope'
        | 'runtime-version'
        | 'adapter-version'
        | 'model'
        | 'policy-or-auth';
    };

export type RuntimeContinuationResolution =
  | { kind: 'fresh' }
  | { kind: 'native'; descriptor: RuntimeContinuationDescriptorV1; compatibility: RuntimeContinuationCompatibility }
  | { kind: 'fallback'; failureCategory: ContinuationFailureCategory };

/** Exact compatibility is the v1.10 safety policy; upgrades use fallback. */
export function checkRuntimeContinuationCompatibility(
  descriptor: RuntimeContinuationDescriptorV1,
  expected: RuntimeContinuationCompatibility,
): RuntimeContinuationCompatibilityResult {
  if (descriptor.runtimeId !== expected.runtimeId) return { compatible: false, reason: 'runtime' };
  if (descriptor.scopeId !== expected.scopeId) return { compatible: false, reason: 'scope' };
  if (descriptor.runtimeVersion !== expected.runtimeVersion) return { compatible: false, reason: 'runtime-version' };
  if (descriptor.adapterContractVersion !== expected.adapterContractVersion) return { compatible: false, reason: 'adapter-version' };
  if (descriptor.modelId !== expected.modelId) return { compatible: false, reason: 'model' };
  if (descriptor.compatibilityFingerprint !== expected.compatibilityFingerprint) {
    return { compatible: false, reason: 'policy-or-auth' };
  }
  return { compatible: true };
}

/** Shared adapter gate: no provider may interpret an unchecked native id. */
export function resolveRuntimeContinuation(
  runtimeId: AgentId,
  request: RuntimeContinuationRequest | undefined,
): RuntimeContinuationResolution {
  if (!request?.descriptor) return { kind: 'fresh' };
  if (!request.compatibility || request.compatibility.runtimeId !== runtimeId) {
    return { kind: 'fallback', failureCategory: 'incompatible-descriptor' };
  }
  const compatibility = checkRuntimeContinuationCompatibility(request.descriptor, request.compatibility);
  if (!compatibility.compatible) {
    return { kind: 'fallback', failureCategory: 'incompatible-descriptor' };
  }
  return { kind: 'native', descriptor: request.descriptor, compatibility: request.compatibility };
}

export function continuationCheckpoint(
  nativeReference: string,
  compatibility: RuntimeContinuationCompatibility,
  coveredThroughEventId: string | null,
  capturedAt = new Date().toISOString(),
): RuntimeContinuationDescriptorV1 {
  return {
    descriptorVersion: RUNTIME_CONTINUATION_DESCRIPTOR_VERSION,
    runtimeId: compatibility.runtimeId,
    nativeReference,
    scopeId: compatibility.scopeId,
    runtimeVersion: compatibility.runtimeVersion,
    adapterContractVersion: compatibility.adapterContractVersion,
    modelId: compatibility.modelId,
    compatibilityFingerprint: compatibility.compatibilityFingerprint,
    coveredThroughEventId,
    capturedAt,
  };
}

export function frameRuntimePrompt(prompt: string, context: NormalizedRuntimeContext | undefined): string {
  if (!context?.text.trim()) return prompt;
  return [
    context.text,
    '',
    '--- CURRENT USER INSTRUCTION (execute this once) ---',
    prompt,
  ].join('\n');
}

export function transcriptRestoredState(context: NormalizedRuntimeContext): RuntimeContinuationState {
  return {
    mode: 'transcript-restored',
    truncated: context.truncated,
    unansweredPriorRequest: context.hasUnansweredRequest,
  };
}

export interface RuntimeCompatibilityFingerprintInput {
  runtimeId: AgentId;
  scopeId: string;
  runtimeVersion: string;
  modelId: string | null;
  approvalMode: 'auto' | 'ask' | 'plan';
  planFirst: boolean;
  sandboxMode: string | null;
  approvalPolicy: string | null;
  /** API/BYOK value, stable account identity, or a provider-managed marker. */
  authBinding: string;
}

/**
 * Produces a host-installation-scoped binding. HMAC prevents an on-disk value
 * from becoming an offline-comparable API-key/account hash.
 */
export function createRuntimeCompatibilityFingerprint(
  hostSecret: string | Uint8Array,
  input: RuntimeCompatibilityFingerprintInput,
): string {
  const canonical = JSON.stringify([
    input.runtimeId,
    input.scopeId,
    input.runtimeVersion,
    input.modelId,
    input.approvalMode,
    input.planFirst,
    input.sandboxMode,
    input.approvalPolicy,
    input.authBinding,
  ]);
  return createHmac('sha256', hostSecret).update(canonical).digest('hex');
}

export interface RedactedContinuationDescriptor {
  descriptorVersion: number;
  runtimeId: AgentId;
  scopeMatches?: boolean;
  runtimeVersion: string;
  adapterContractVersion: number;
  modelId: string | null;
  hasNativeReference: boolean;
  hasCoverageWatermark: boolean;
  capturedAt: string;
}

/** Safe diagnostic projection: no provider reference or compatibility HMAC. */
export function redactRuntimeContinuationDescriptor(
  descriptor: RuntimeContinuationDescriptorV1,
  expectedScopeId?: string,
): RedactedContinuationDescriptor {
  return {
    descriptorVersion: descriptor.descriptorVersion,
    runtimeId: descriptor.runtimeId,
    ...(expectedScopeId ? { scopeMatches: descriptor.scopeId === expectedScopeId } : {}),
    runtimeVersion: descriptor.runtimeVersion,
    adapterContractVersion: descriptor.adapterContractVersion,
    modelId: descriptor.modelId,
    hasNativeReference: descriptor.nativeReference.length > 0,
    hasCoverageWatermark: descriptor.coveredThroughEventId !== null,
    capturedAt: descriptor.capturedAt,
  };
}
