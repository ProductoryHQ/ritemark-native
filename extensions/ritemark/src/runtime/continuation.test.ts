import assert from 'node:assert/strict';
import {
  RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION,
  RUNTIME_CONTINUATION_DESCRIPTOR_VERSION,
  checkRuntimeContinuationCompatibility,
  createRuntimeCompatibilityFingerprint,
  redactRuntimeContinuationDescriptor,
  type RuntimeContinuationCompatibility,
  type RuntimeContinuationDescriptorV1,
} from './continuation';

const scopeId = `ps1-${'a'.repeat(40)}`;
const expected: RuntimeContinuationCompatibility = {
  runtimeId: 'codex',
  scopeId,
  runtimeVersion: '0.144.4',
  adapterContractVersion: RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION,
  modelId: 'gpt-5.6-codex',
  compatibilityFingerprint: 'fingerprint',
};

const descriptor: RuntimeContinuationDescriptorV1 = {
  descriptorVersion: RUNTIME_CONTINUATION_DESCRIPTOR_VERSION,
  runtimeId: 'codex',
  nativeReference: 'provider-thread-secret',
  scopeId,
  runtimeVersion: '0.144.4',
  adapterContractVersion: RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION,
  modelId: 'gpt-5.6-codex',
  compatibilityFingerprint: 'fingerprint',
  coveredThroughEventId: 'assistant-final-1',
  capturedAt: '2026-08-23T10:00:00.000Z',
};

function mismatch(
  change: Partial<RuntimeContinuationCompatibility>,
  reason: Exclude<ReturnType<typeof checkRuntimeContinuationCompatibility>, { compatible: true }>['reason'],
): void {
  assert.deepEqual(
    checkRuntimeContinuationCompatibility(descriptor, { ...expected, ...change }),
    { compatible: false, reason },
  );
}

function run(): void {
  assert.deepEqual(checkRuntimeContinuationCompatibility(descriptor, expected), { compatible: true });
  mismatch({ runtimeId: 'claude-code' }, 'runtime');
  mismatch({ scopeId: `ps1-${'b'.repeat(40)}` }, 'scope');
  mismatch({ runtimeVersion: '0.145.0' }, 'runtime-version');
  mismatch({ adapterContractVersion: 2 }, 'adapter-version');
  mismatch({ modelId: 'gpt-5.7-codex' }, 'model');
  mismatch({ compatibilityFingerprint: 'other-auth-or-policy' }, 'policy-or-auth');

  const fingerprintInput = {
    runtimeId: 'codex' as const,
    scopeId,
    runtimeVersion: '0.144.4',
    modelId: 'gpt-5.6-codex',
    approvalMode: 'ask' as const,
    planFirst: false,
    sandboxMode: 'workspace-write',
    approvalPolicy: 'on-request',
    authBinding: 'account-a',
  };
  const first = createRuntimeCompatibilityFingerprint('installation-secret', fingerprintInput);
  assert.equal(first, createRuntimeCompatibilityFingerprint('installation-secret', fingerprintInput));
  assert.notEqual(first, createRuntimeCompatibilityFingerprint('installation-secret', {
    ...fingerprintInput,
    authBinding: 'account-b',
  }));
  assert.notEqual(first, createRuntimeCompatibilityFingerprint('other-installation', fingerprintInput));

  const redacted = redactRuntimeContinuationDescriptor(descriptor, scopeId);
  assert.equal(redacted.scopeMatches, true);
  assert.equal(redacted.hasNativeReference, true);
  assert.equal(redacted.hasCoverageWatermark, true);
  const diagnosticJson = JSON.stringify(redacted);
  assert.equal(diagnosticJson.includes(descriptor.nativeReference), false);
  assert.equal(diagnosticJson.includes(descriptor.compatibilityFingerprint), false);

  console.log('continuation.test.ts: all tests passed');
}

run();
