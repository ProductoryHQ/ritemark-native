/**
 * Sprint 108 regression tests — "a runtime status probe is in flight" must
 * not be conflated with "the runtime's status is unknown".
 *
 * Root cause (pre-108): `agent:status-checking` unconditionally overwrote
 * `runtimeHydration[runtimeId].phase` with 'checking' before EVERY status
 * resolve, including background re-checks of a runtime whose answer was
 * already known. That produced two opposite symptoms downstream:
 *   1. An already-visible setup surface (needsSetup / showCodexSetup /
 *      showOpenCodeSetup all require state !== 'checking') would drop out
 *      for the round trip and reappear once the probe resolved.
 *   2. `onboardingNeeded` (`!Object.values(availabilities).some(usable)`)
 *      would spuriously become true for the round trip even when a runtime
 *      was fully configured and ready, conjuring the onboarding wizard over
 *      a usable runtime.
 *
 * These tests exercise the store + the same derivation AISidebar.tsx uses
 * (deriveRuntimeAvailabilities + sidebarGate) directly, without React, to
 * assert that a refresh tick changes neither.
 */
import assert from 'node:assert/strict';
import { vscode } from '../../lib/vscode';
import { useAISidebarStore } from './store';
import { deriveRuntimeAvailabilities } from './runtimeAvailability';
import { sidebarGate } from './sidebarGate';
import type { ExtensionMessage } from './types';

const initialState = useAISidebarStore.getState();

function resetStore(): void {
  useAISidebarStore.setState(initialState, true);
}

function deliver(message: ExtensionMessage): void {
  useAISidebarStore.getState().handleExtensionMessage(message);
}

/** Mirror AISidebar.tsx's derivation for one selected runtime's setup gate input. */
function setupFlagsFor(
  availabilities: ReturnType<typeof deriveRuntimeAvailabilities>,
  runtimeId: 'claude-code' | 'codex' | 'opencode',
): { needsSetup: boolean; showCodexSetup: boolean; showOpenCodeSetup: boolean } {
  const a = availabilities[runtimeId];
  const notCheckingOrError = a.state !== 'checking' && a.state !== 'error';
  return {
    needsSetup: runtimeId === 'claude-code' && notCheckingOrError && !a.usable,
    showCodexSetup: runtimeId === 'codex' && notCheckingOrError && !a.usable,
    showOpenCodeSetup: runtimeId === 'opencode' && notCheckingOrError && !a.usable && a.state === 'needs-configuration',
  };
}

function onboardingNeededFor(
  availabilities: ReturnType<typeof deriveRuntimeAvailabilities>,
  onboardingStatusPresent: boolean,
  onboardingDismissed: boolean,
): boolean {
  return Boolean(
    onboardingStatusPresent
    && !Object.values(availabilities).some((availability) => availability.usable)
    && !onboardingDismissed,
  );
}

function main(): void {
  const originalPostMessage = vscode.postMessage;
  vscode.postMessage = () => undefined;
  try {
    // ── Direction 1: a showing setup view survives a refresh tick ─────────
    {
      resetStore();
      deliver({
        type: 'agent:bootstrap',
        generation: 1,
        agenticEnabled: true,
        parallelChatsEnabled: true,
        durableAgentConversations: true,
        composerThinkingEffortEnabled: true,
        codexEnabled: true,
        opencodeEnabled: false,
        selectedAgent: 'codex',
        selectedModel: '',
        agents: [],
        models: [],
        codexModels: [],
        byokProviderModels: {},
        hasSeenWelcome: true,
        claudeSdkVersion: null,
        runtimeCapabilities: {} as never,
      });

      // Codex resolves to needs-auth — a real, known answer. The setup view
      // is now legitimately showing.
      deliver({
        type: 'codex:status',
        generation: 1,
        revision: 1,
        status: {
          enabled: true,
          state: 'needs-auth',
          version: '1.2.3',
          authMethod: null,
          email: null,
          plan: null,
          error: null,
          diagnostics: [],
          repairCommand: null,
          binaryPath: '/tmp/codex',
          compatibility: null,
        },
      });

      let state = useAISidebarStore.getState();
      assert.equal(state.runtimeHydration.codex.phase, 'ready', 'a resolved probe is a KNOWN phase, not checking');
      let availabilities = deriveRuntimeAvailabilities({
        runtimeHydration: state.runtimeHydration,
        setupStatus: state.setupStatus,
        codexStatus: state.codexStatus,
        opencodeEnabled: state.opencodeEnabled,
        acpProviders: state.acpProviders,
        byokProviderModels: state.byokProviderModels,
      });
      let flags = setupFlagsFor(availabilities, 'codex');
      assert.equal(flags.showCodexSetup, true, 'precondition: codex-setup is genuinely showing');
      let view = sidebarGate({
        ready: state.ready,
        inlineRecoveryAvailable: false,
        onboardingNeeded: false,
        hasConversation: false,
        hasReadyAlternative: false,
        needsSetup: flags.needsSetup,
        showCodexSetup: flags.showCodexSetup,
        showOpenCodeSetup: flags.showOpenCodeSetup,
      });
      assert.equal(view, 'codex-setup');

      // A background re-check (e.g. a login poll tick) starts. This must
      // NOT tear the phase back down to 'checking'.
      deliver({ type: 'agent:status-checking', runtimeId: 'codex', generation: 1, revision: 2 });

      state = useAISidebarStore.getState();
      assert.equal(state.runtimeHydration.codex.phase, 'ready', 'a refresh tick must not discard the known phase');
      assert.equal(state.runtimeHydration.codex.refreshing, true, 'the in-flight flag is the separate signal');

      availabilities = deriveRuntimeAvailabilities({
        runtimeHydration: state.runtimeHydration,
        setupStatus: state.setupStatus,
        codexStatus: state.codexStatus,
        opencodeEnabled: state.opencodeEnabled,
        acpProviders: state.acpProviders,
        byokProviderModels: state.byokProviderModels,
      });
      flags = setupFlagsFor(availabilities, 'codex');
      assert.equal(flags.showCodexSetup, true, 'showCodexSetup must not flip false mid-refresh');
      view = sidebarGate({
        ready: state.ready,
        inlineRecoveryAvailable: false,
        onboardingNeeded: false,
        hasConversation: false,
        hasReadyAlternative: false,
        needsSetup: flags.needsSetup,
        showCodexSetup: flags.showCodexSetup,
        showOpenCodeSetup: flags.showOpenCodeSetup,
      });
      assert.equal(view, 'codex-setup', 'the setup view must survive the refresh tick with NO sticky compensation needed');
    }

    // ── Direction 2: the onboarding wizard is not conjured over a usable
    //    runtime by a refresh tick ─────────────────────────────────────────
    {
      resetStore();
      deliver({
        type: 'agent:bootstrap',
        generation: 1,
        agenticEnabled: true,
        parallelChatsEnabled: true,
        durableAgentConversations: true,
        composerThinkingEffortEnabled: true,
        codexEnabled: false,
        opencodeEnabled: false,
        selectedAgent: 'claude-code',
        selectedModel: '',
        agents: [],
        models: [],
        codexModels: [],
        byokProviderModels: {},
        hasSeenWelcome: true,
        claudeSdkVersion: null,
        runtimeCapabilities: {} as never,
      });

      deliver({
        type: 'agent-setup:complete',
        generation: 1,
        revision: 1,
        status: {
          cliInstalled: true,
          runnable: true,
          authenticated: true,
          authMethod: 'claude-oauth',
          state: 'ready',
          diagnostics: [],
          repairAction: null,
          error: null,
        },
      });

      deliver({
        type: 'onboarding:status',
        status: {
          platform: 'darwin',
          wingetAvailable: false,
          gitInstalled: true,
          nodeInstalled: true,
          gitRequired: false,
          nodeRequired: false,
          claudeCliInstalled: true,
          claudeCliAuthenticated: true,
          codexCliInstalled: false,
          codexCliAuthenticated: false,
          hasOpenAiKey: false,
          hasAnthropicKey: true,
          anyAgentReady: true,
        },
      });

      let state = useAISidebarStore.getState();
      assert.equal(state.runtimeHydration['claude-code'].phase, 'ready');
      let availabilities = deriveRuntimeAvailabilities({
        runtimeHydration: state.runtimeHydration,
        setupStatus: state.setupStatus,
        codexStatus: state.codexStatus,
        opencodeEnabled: state.opencodeEnabled,
        acpProviders: state.acpProviders,
        byokProviderModels: state.byokProviderModels,
      });
      assert.equal(availabilities['claude-code'].usable, true, 'precondition: Claude is genuinely ready');
      let onboardingNeeded = onboardingNeededFor(availabilities, state.onboardingStatus !== null, state.onboardingDismissed);
      assert.equal(onboardingNeeded, false);
      let view = sidebarGate({
        ready: state.ready,
        inlineRecoveryAvailable: false,
        onboardingNeeded,
        hasConversation: false,
        hasReadyAlternative: false,
        needsSetup: false,
        showCodexSetup: false,
        showOpenCodeSetup: false,
      });
      assert.equal(view, 'chat', 'precondition: a ready Claude with no conversation goes straight to chat');

      // A background re-check on the ALREADY-READY runtime starts (e.g. any
      // periodic status recheck). Pre-fix this discarded the known phase and
      // made every runtime read as unusable for the round trip.
      deliver({ type: 'agent:status-checking', runtimeId: 'claude-code', generation: 1, revision: 2 });

      state = useAISidebarStore.getState();
      assert.equal(state.runtimeHydration['claude-code'].phase, 'ready', 'a refresh tick must not discard the known phase');
      assert.equal(state.runtimeHydration['claude-code'].refreshing, true);

      availabilities = deriveRuntimeAvailabilities({
        runtimeHydration: state.runtimeHydration,
        setupStatus: state.setupStatus,
        codexStatus: state.codexStatus,
        opencodeEnabled: state.opencodeEnabled,
        acpProviders: state.acpProviders,
        byokProviderModels: state.byokProviderModels,
      });
      assert.equal(availabilities['claude-code'].usable, true, 'Claude must still read usable during the refresh');
      onboardingNeeded = onboardingNeededFor(availabilities, state.onboardingStatus !== null, state.onboardingDismissed);
      assert.equal(onboardingNeeded, false, 'the onboarding wizard must not be conjured by a mid-flight refresh');
      view = sidebarGate({
        ready: state.ready,
        inlineRecoveryAvailable: false,
        onboardingNeeded,
        hasConversation: false,
        hasReadyAlternative: false,
        needsSetup: false,
        showCodexSetup: false,
        showOpenCodeSetup: false,
      });
      assert.equal(view, 'chat', 'chat must stay visible through the refresh tick — no onboarding flash');
    }

    // ── Direction 3: genuine first-load unknown still produces onboarding
    //    (this is NOT the bug — a real "nothing learned yet" state must
    //    still gate on 'checking' the same as before) ───────────────────────
    {
      resetStore();
      deliver({
        type: 'onboarding:status',
        status: {
          platform: 'win32',
          wingetAvailable: true,
          gitInstalled: false,
          nodeInstalled: false,
          gitRequired: false,
          nodeRequired: false,
          claudeCliInstalled: false,
          claudeCliAuthenticated: false,
          codexCliInstalled: false,
          codexCliAuthenticated: false,
          hasOpenAiKey: false,
          hasAnthropicKey: false,
          anyAgentReady: false,
        },
      });

      const state = useAISidebarStore.getState();
      assert.equal(state.runtimeHydration['claude-code'].phase, 'checking', 'never-checked stays checking');
      assert.equal(state.runtimeHydration.codex.phase, 'checking');
      assert.equal(state.runtimeHydration.opencode.phase, 'checking');

      const availabilities = deriveRuntimeAvailabilities({
        runtimeHydration: state.runtimeHydration,
        setupStatus: state.setupStatus,
        codexStatus: state.codexStatus,
        opencodeEnabled: state.opencodeEnabled,
        acpProviders: state.acpProviders,
        byokProviderModels: state.byokProviderModels,
      });
      const onboardingNeeded = onboardingNeededFor(availabilities, state.onboardingStatus !== null, state.onboardingDismissed);
      assert.equal(onboardingNeeded, true, 'genuine first-load unknown must still be treated as no runtime usable yet');
      const view = sidebarGate({
        ready: true,
        inlineRecoveryAvailable: false,
        onboardingNeeded,
        hasConversation: false,
        hasReadyAlternative: false,
        needsSetup: false,
        showCodexSetup: false,
        showOpenCodeSetup: false,
      });
      assert.equal(view, 'onboarding', 'first-run onboarding still shows while everything is genuinely unchecked');
    }

    console.log('runtimeHydrationRefresh tests passed.');
  } finally {
    vscode.postMessage = originalPostMessage;
    resetStore();
  }
}

main();
