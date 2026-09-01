/**
 * AISidebar — Root component for the AI sidebar.
 *
 * Sets up the message listener, sends the `ready` handshake,
 * and renders the correct view based on store state.
 */

import { useEffect, useRef } from 'react';
import { useAISidebarStore, useActiveConversation } from './store';
import { vscode } from '../../lib/vscode';
import { OfflineBanner } from './OfflineBanner';
import { OnboardingWizard } from './OnboardingWizard';
import { sidebarGate } from './sidebarGate';
import { SetupWizard } from './SetupWizard';
import { AgentView } from './AgentView';
import { CodexView } from './CodexView';
import { UnifiedConversationView } from './UnifiedConversationView';
import { LegacyConversationView } from './LegacyConversationView';
import { CodexSetupView } from './CodexSetupView';
import { OpenCodeSetupView } from './OpenCodeSetupView';
import { ChatInput } from './ChatInput';
import { SelectionIndicator } from './SelectionIndicator';
import { ConversationsPanel } from './ConversationsPanel';
import { ThreadRail } from './ThreadRail';
import { ActivePlanBanner } from './ActivePlanBanner';
import { getActiveApprovedPlanForClaude, getActiveApprovedPlanForCodex } from './lifecycle';
import { markdownStyles } from './RenderedMarkdown';
import type { ExtensionMessage } from './types';
import { sendConversationRequest } from '../../bridge';

export function AISidebar() {
  const handleMessage = useAISidebarStore((s) => s.handleExtensionMessage);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const ready = useAISidebarStore((s) => s.ready);
  const dismissCurrentPlan = useAISidebarStore((s) => s.dismissCurrentPlan);
  const {
    selectedAgent,
    dismissedCurrentPlanKey,
    agentConversation,
    codexConversation,
    legacyConversation,
  } = useActiveConversation();

  // Set up message listener + handshake
  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionMessage>) => {
      handleMessage(event.data);
    };
    window.addEventListener('message', listener);

    // Restore persisted state if available
    const savedState = vscode.getState() as Record<string, unknown> | null;
    if (savedState) {
      const store = useAISidebarStore.getState();
      if (Array.isArray(savedState.pinnedConversationIds)) {
        store.setPinnedConversationIds(savedState.pinnedConversationIds.filter((id): id is string => typeof id === 'string'));
      }
      if (typeof savedState.currentConversationId === 'string' && /^[0-9a-f]{8}-/i.test(savedState.currentConversationId)) {
        sendConversationRequest({ type: 'conversation/get', requestId: `restore-${Date.now()}`, conversationId: savedState.currentConversationId });
      }
    }

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', listener);
  }, [handleMessage]);

  // Persist state across hide/show
  useEffect(() => {
    let selectedConversationId = useAISidebarStore.getState().activeConversationId;
    if (selectedConversationId) {
      vscode.postMessage({ type: 'conversation:selected', conversationId: selectedConversationId });
    }
    return useAISidebarStore.subscribe((state) => {
      vscode.setState({
        currentConversationId: state.activeConversationId,
        pinnedConversationIds: state.pinnedConversationIds,
      });
      if (state.activeConversationId !== selectedConversationId) {
        selectedConversationId = state.activeConversationId;
        if (selectedConversationId) {
          vscode.postMessage({ type: 'conversation:selected', conversationId: selectedConversationId });
        }
      }
    });
  }, []);

  const onboardingStatus = useAISidebarStore((s) => s.onboardingStatus);
  const onboardingDismissed = useAISidebarStore((s) => s.onboardingDismissed);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const hasSeenWelcome = useAISidebarStore((s) => s.hasSeenWelcome);
  const dismissWelcome = useAISidebarStore((s) => s.dismissWelcome);
  const showHistoryPanel = useAISidebarStore((s) => s.showHistoryPanel);
  const loadConversationList = useAISidebarStore((s) => s.loadConversationList);
  const chatFontSize = useAISidebarStore((s) => s.chatFontSize);
  const historyWasOpen = useRef(showHistoryPanel);

  useEffect(() => {
    const wasOpen = historyWasOpen.current;
    historyWasOpen.current = showHistoryPanel;
    if (!wasOpen || showHistoryPanel) return;
    const timeout = window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')?.focus();
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [showHistoryPanel]);

  // Initialize chat font size CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${chatFontSize}px`);
  }, [chatFontSize]);

  // Load conversation list on mount
  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const isClaudeCode = selectedAgent === 'claude-code';
  const isCodex = selectedAgent === 'codex';
  const isOpenCode = selectedAgent === 'opencode';
  const needsSetup = isClaudeCode && setupStatus !== null
    && setupStatus.state !== 'ready';
  const latestClaudeTurn = agentConversation[agentConversation.length - 1];
  const inlineRecoveryAvailable = isClaudeCode
    && latestClaudeTurn?.result?.failureKind === 'authentication';
  const hasAnyRuntimeConversation = agentConversation.length > 0 || codexConversation.length > 0;
  const showWelcome = isClaudeCode && setupStatus !== null
    && setupStatus.state === 'ready' && !hasSeenWelcome && !hasAnyRuntimeConversation;

  // Sprint 107 R4: the "Claude is ready — Get Started" card no longer renders.
  // Its bookkeeping still runs the moment the ready-with-no-conversation state
  // is reached, so hasSeenWelcome / ritemark.ai.hasSeenClaudeWelcome end up
  // exactly as a manual "Get Started" click would have left them.
  useEffect(() => {
    if (ready && showWelcome) dismissWelcome();
  }, [ready, showWelcome, dismissWelcome]);

  const showCodexSetup = isCodex && codexStatus.state !== 'ready';
  // OpenCode zero-key: no conversation yet and all four provider booleans are false
  const showOpenCodeSetup = isOpenCode && !hasAnyRuntimeConversation
    && acpProviders
    && !acpProviders.google && !acpProviders.openai && !acpProviders.anthropic && !acpProviders.openrouter;
  const sidebarView = sidebarGate({
    ready,
    inlineRecoveryAvailable,
    onboardingNeeded: Boolean(onboardingStatus && !onboardingStatus.anyAgentReady && !onboardingDismissed),
    needsSetup,
    showCodexSetup: Boolean(showCodexSetup),
    showOpenCodeSetup: Boolean(showOpenCodeSetup),
  });
  const currentApprovedPlan = isClaudeCode
    ? getActiveApprovedPlanForClaude(agentConversation)
    : (isCodex || isOpenCode)
      ? getActiveApprovedPlanForCodex(codexConversation)
      : null;
  const visibleCurrentPlan = currentApprovedPlan && currentApprovedPlan.key !== dismissedCurrentPlanKey
    ? currentApprovedPlan
    : null;

  return (
    <div className="relative flex flex-col h-screen overflow-hidden text-[var(--r-ink-strong)] bg-[var(--vscode-sideBar-background)]">
      {/* Inject markdown styles once at root level */}
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />


      {/* Conversations panel overlay; the rail remains visible. */}
      {showHistoryPanel && <ConversationsPanel />}

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Onboarding wizard — shown on first run when no agent is ready */}
      {sidebarView === 'onboarding' ? (
        <OnboardingWizard />
      ) : sidebarView === 'claude-setup' ? (
        <>
          <SelectionIndicator />
          <SetupWizard />
        </>
      ) : sidebarView === 'codex-setup' ? (
        <>
          <SelectionIndicator />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CodexSetupView />
          </div>
        </>
      ) : sidebarView === 'opencode-setup' ? (
        <>
          <SelectionIndicator />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <OpenCodeSetupView />
          </div>
        </>
      ) : (
        <>
          {/* Sprint 64 bonus track (S5): selection is now shown as a docked
              tab inside ChatInput, not as a global banner here. The
              SelectionIndicator above is still used for Welcome and Setup
              flows where there's no chat input to anchor to. */}

          {/*
            Sprint 99 (R6): messages + thread rail share ONE row; the composer
            below is a sibling of that row, so it spans the full sidebar width
            and the rail stops at the composer boundary. Do not nest ChatInput
            inside this flex row — that was the explicit correction from Jarmo.
          */}
          <div className="flex-1 min-h-0 flex overflow-hidden border-t border-[var(--r-hairline)]">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {agentConversation.length > 0 || codexConversation.length > 0
                  ? <UnifiedConversationView />
                  : legacyConversation !== null
                  ? <LegacyConversationView />
                  : isCodex ? <CodexView />
                  : <AgentView />}
              </div>
              {visibleCurrentPlan && (
                <ActivePlanBanner
                  planText={visibleCurrentPlan.planText}
                  planSteps={'planSteps' in visibleCurrentPlan ? visibleCurrentPlan.planSteps : undefined}
                  isRunning={visibleCurrentPlan.isRunning}
                  allCompleted={Boolean(visibleCurrentPlan.allCompleted)}
                  onDismiss={() => dismissCurrentPlan(visibleCurrentPlan.key)}
                />
              )}
              <ChatInput />
            </div>
            <ThreadRail />
          </div>
        </>
      )}

    </div>
  );
}
