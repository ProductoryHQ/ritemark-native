/**
 * AISidebar — Root component for the AI sidebar.
 *
 * Sets up the message listener, sends the `ready` handshake,
 * and renders the correct view based on store state.
 */

import { useEffect } from 'react';
import { useAISidebarStore } from './store';
import { vscode } from '../../lib/vscode';
import { OfflineBanner } from './OfflineBanner';
import { OnboardingWizard } from './OnboardingWizard';
import { SetupWizard } from './SetupWizard';
import { AgentView } from './AgentView';
import { CodexView } from './CodexView';
import { UnifiedConversationView } from './UnifiedConversationView';
import { LegacyConversationView } from './LegacyConversationView';
import { CodexSetupView } from './CodexSetupView';
import { OpenCodeSetupView } from './OpenCodeSetupView';
import { ChatInput } from './ChatInput';
import { SelectionIndicator } from './SelectionIndicator';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { ThreadRail } from './ThreadRail';
import { ThreadCapDialog } from './ThreadCapDialog';
import { ActivePlanBanner } from './ActivePlanBanner';
import { getActiveApprovedPlanForClaude, getActiveApprovedPlanForCodex } from './lifecycle';
import { markdownStyles } from './RenderedMarkdown';
import type { ExtensionMessage } from './types';

export function AISidebar() {
  const handleMessage = useAISidebarStore((s) => s.handleExtensionMessage);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const ready = useAISidebarStore((s) => s.ready);
  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);
  const dismissCurrentPlan = useAISidebarStore((s) => s.dismissCurrentPlan);
  const dismissedCurrentPlanKey = useAISidebarStore((s) => s.dismissedCurrentPlanKey);

  // Set up message listener + handshake
  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionMessage>) => {
      handleMessage(event.data);
    };
    window.addEventListener('message', listener);

    // Restore persisted state if available
    const savedState = vscode.getState() as Record<string, unknown> | null;
    if (savedState) {
      // Re-hydrate the ACTIVE conversation from saved webview state.
      // Sprint 99: this restores one thread (the one that was on screen). The
      // full open-thread set persists per workspace in Phase 5 (R13).
      const store = useAISidebarStore.getState();
      const restored: Parameters<typeof store.restoreActiveConversation>[0] = {};
      if (savedState.chatMessages) {
        restored.chatMessages = savedState.chatMessages as typeof store.chatMessages;
        restored.conversationHistory = (savedState.conversationHistory || []) as typeof store.conversationHistory;
      }
      if (savedState.agentConversation) {
        restored.agentConversation = savedState.agentConversation as typeof store.agentConversation;
      }
      if (savedState.codexConversation) {
        restored.codexConversation = savedState.codexConversation as typeof store.codexConversation;
      }
      if ('dismissedCurrentPlanKey' in savedState) {
        restored.dismissedCurrentPlanKey = (savedState.dismissedCurrentPlanKey as string | null) ?? null;
      }
      if (Object.keys(restored).length > 0) {
        store.restoreActiveConversation(restored);
      }
    }

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', listener);
  }, [handleMessage]);

  // Persist state across hide/show
  useEffect(() => {
    return useAISidebarStore.subscribe((state) => {
      vscode.setState({
        chatMessages: state.chatMessages,
        conversationHistory: state.conversationHistory,
        agentConversation: state.agentConversation,
        codexConversation: state.codexConversation,
        currentConversationId: state.currentConversationId,
        dismissedCurrentPlanKey: state.dismissedCurrentPlanKey,
      });
    });
  }, []);

  const onboardingStatus = useAISidebarStore((s) => s.onboardingStatus);
  const onboardingDismissed = useAISidebarStore((s) => s.onboardingDismissed);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const hasSeenWelcome = useAISidebarStore((s) => s.hasSeenWelcome);
  const showHistoryPanel = useAISidebarStore((s) => s.showHistoryPanel);
  const loadConversationList = useAISidebarStore((s) => s.loadConversationList);
  const chatFontSize = useAISidebarStore((s) => s.chatFontSize);
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const codexConversation = useAISidebarStore((s) => s.codexConversation);
  const legacyConversation = useAISidebarStore((s) => s.legacyConversation);

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
  const hasAnyRuntimeConversation = agentConversation.length > 0 || codexConversation.length > 0;
  const showWelcome = isClaudeCode && setupStatus !== null
    && setupStatus.state === 'ready' && !hasSeenWelcome && !hasAnyRuntimeConversation;
  const showCodexSetup = isCodex && codexStatus.state !== 'ready';
  // OpenCode zero-key: no conversation yet and all four provider booleans are false
  const showOpenCodeSetup = isOpenCode && !hasAnyRuntimeConversation
    && acpProviders
    && !acpProviders.google && !acpProviders.openai && !acpProviders.anthropic && !acpProviders.openrouter;
  const currentApprovedPlan = isClaudeCode
    ? getActiveApprovedPlanForClaude(agentConversation)
    : (isCodex || isOpenCode)
      ? getActiveApprovedPlanForCodex(codexConversation)
      : null;
  const visibleCurrentPlan = currentApprovedPlan && currentApprovedPlan.key !== dismissedCurrentPlanKey
    ? currentApprovedPlan
    : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[var(--r-ink-strong)] bg-[var(--vscode-sideBar-background)]">
      {/* Inject markdown styles once at root level */}
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />


      {/* Chat History Panel (overlay) */}
      {showHistoryPanel && <ChatHistoryPanel />}

      {/* Soft-cap prompt for "+" / History reopen (R11) */}
      <ThreadCapDialog />

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Onboarding wizard — shown on first run when no agent is ready */}
      {ready && onboardingStatus && !onboardingStatus.anyAgentReady && !onboardingDismissed ? (
        <OnboardingWizard />
      ) : ready && (needsSetup || showWelcome) ? (
        <>
          <SelectionIndicator />
          <SetupWizard />
        </>
      ) : ready && showCodexSetup ? (
        <>
          <SelectionIndicator />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CodexSetupView />
          </div>
        </>
      ) : ready && showOpenCodeSetup ? (
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
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {agentConversation.length > 0 || codexConversation.length > 0
                ? <UnifiedConversationView />
                : legacyConversation !== null
                ? <LegacyConversationView />
                : isCodex ? <CodexView />
                : <AgentView />}
            </div>
            <ThreadRail />
          </div>

          {/* Shared input */}
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
        </>
      )}

    </div>
  );
}
