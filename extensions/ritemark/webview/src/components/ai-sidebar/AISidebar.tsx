/**
 * AISidebar — Root component for the AI sidebar.
 *
 * Sets up the message listener, sends the `ready` handshake,
 * and renders the correct view based on store state.
 */

import { useEffect } from 'react';
import { useAISidebarStore } from './store';
import { vscode } from '../../lib/vscode';
import { AgentSelector } from './AgentSelector';
import { OfflineBanner } from './OfflineBanner';
import { NoApiKey } from './NoApiKey';
import { SetupWizard } from './SetupWizard';
import { ChatView } from './ChatView';
import { AgentView } from './AgentView';
import { CodexView } from './CodexView';
import { CodexSetupView } from './CodexSetupView';
import { ChatInput } from './ChatInput';
import { IndexFooter } from './IndexFooter';
import { SelectionIndicator } from './SelectionIndicator';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { ActivePlanBanner } from './ActivePlanBanner';
import { getActiveApprovedPlanForClaude, getActiveApprovedPlanForCodex } from './lifecycle';
import { markdownStyles } from './RenderedMarkdown';
import type { ExtensionMessage } from './types';

export function AISidebar() {
  const handleMessage = useAISidebarStore((s) => s.handleExtensionMessage);
  const hasApiKey = useAISidebarStore((s) => s.hasApiKey);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const ready = useAISidebarStore((s) => s.ready);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
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
      // Re-hydrate relevant store state from saved state
      const store = useAISidebarStore.getState();
      if (savedState.chatMessages) {
        useAISidebarStore.setState({
          chatMessages: savedState.chatMessages as typeof store.chatMessages,
          conversationHistory: (savedState.conversationHistory || []) as typeof store.conversationHistory,
          currentConversationId: (savedState.currentConversationId as string | null) ?? null,
        });
      }
      if (savedState.agentConversation) {
        useAISidebarStore.setState({
          agentConversation: savedState.agentConversation as typeof store.agentConversation,
        });
      }
      if (savedState.codexConversation) {
        useAISidebarStore.setState({
          codexConversation: savedState.codexConversation as typeof store.codexConversation,
        });
      }
      if ('dismissedCurrentPlanKey' in savedState) {
        useAISidebarStore.setState({
          dismissedCurrentPlanKey: (savedState.dismissedCurrentPlanKey as string | null) ?? null,
        });
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

  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const hasSeenWelcome = useAISidebarStore((s) => s.hasSeenWelcome);
  const showHistoryPanel = useAISidebarStore((s) => s.showHistoryPanel);
  const loadConversationList = useAISidebarStore((s) => s.loadConversationList);
  const chatFontSize = useAISidebarStore((s) => s.chatFontSize);
  const agentConversation = useAISidebarStore((s) => s.agentConversation);
  const codexConversation = useAISidebarStore((s) => s.codexConversation);

  // Initialize chat font size CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${chatFontSize}px`);
  }, [chatFontSize]);

  // Load conversation list on mount
  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

  const isClaudeCode = selectedAgent === 'claude-code';
  const isCodex = selectedAgent === 'codex';
  const isAgentMode = isClaudeCode || isCodex;
  const needsOpenAIKey = !isAgentMode && !hasApiKey;
  const needsSetup = isClaudeCode && setupStatus !== null
    && setupStatus.state !== 'ready';
  const showWelcome = isClaudeCode && setupStatus !== null
    && setupStatus.state === 'ready' && !hasSeenWelcome;
  const showCodexSetup = isCodex && codexStatus.state !== 'ready';
  const currentApprovedPlan = isClaudeCode
    ? getActiveApprovedPlanForClaude(agentConversation)
    : isCodex
      ? getActiveApprovedPlanForCodex(codexConversation)
      : null;
  const visibleCurrentPlan = currentApprovedPlan && currentApprovedPlan.key !== dismissedCurrentPlanKey
    ? currentApprovedPlan
    : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[var(--vscode-foreground)] bg-[var(--vscode-sideBar-background)]">
      {/* Inject markdown styles once at root level */}
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />

      {/* Agent selector — only when agentic feature is enabled */}
      {agenticEnabled && <AgentSelector />}

      {/* Chat History Panel (overlay) */}
      {showHistoryPanel && <ChatHistoryPanel />}

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* No API key — only for Ritemark Agent mode */}
      {ready && needsOpenAIKey ? (
        <NoApiKey />
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
      ) : (
        <>
          {/* Selection indicator */}
          <SelectionIndicator />

          {/* Main content area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isCodex ? <CodexView /> : isClaudeCode ? <AgentView /> : <ChatView />}
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

      {/* Index footer — only for Ritemark Agent (RAG) */}
      {!isAgentMode && <IndexFooter />}
    </div>
  );
}
