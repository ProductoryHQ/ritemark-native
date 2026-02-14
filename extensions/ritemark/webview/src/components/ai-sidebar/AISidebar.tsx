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
import { ChatInput } from './ChatInput';
import { IndexFooter } from './IndexFooter';
import { SelectionIndicator } from './SelectionIndicator';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { markdownStyles } from './RenderedMarkdown';
import { History } from 'lucide-react';
import type { ExtensionMessage } from './types';

export function AISidebar() {
  const handleMessage = useAISidebarStore((s) => s.handleExtensionMessage);
  const hasApiKey = useAISidebarStore((s) => s.hasApiKey);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const ready = useAISidebarStore((s) => s.ready);
  const agenticEnabled = useAISidebarStore((s) => s.agenticEnabled);
  const selectedAgent = useAISidebarStore((s) => s.selectedAgent);

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
        });
      }
      if (savedState.agentConversation) {
        useAISidebarStore.setState({
          agentConversation: savedState.agentConversation as typeof store.agentConversation,
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
      });
    });
  }, []);

  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const hasSeenWelcome = useAISidebarStore((s) => s.hasSeenWelcome);
  const showHistoryPanel = useAISidebarStore((s) => s.showHistoryPanel);
  const toggleHistoryPanel = useAISidebarStore((s) => s.toggleHistoryPanel);
  const loadConversationList = useAISidebarStore((s) => s.loadConversationList);
  const chatFontSize = useAISidebarStore((s) => s.chatFontSize);

  // Initialize chat font size CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size', `${chatFontSize}px`);
  }, [chatFontSize]);

  // Load conversation list on mount
  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

  const isClaudeCode = selectedAgent === 'claude-code';
  const needsOpenAIKey = !isClaudeCode && !hasApiKey;
  const needsSetup = isClaudeCode && setupStatus !== null
    && (!setupStatus.cliInstalled || !setupStatus.authenticated);
  const showWelcome = isClaudeCode && setupStatus !== null
    && setupStatus.cliInstalled && setupStatus.authenticated && !hasSeenWelcome;

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[var(--vscode-foreground)] bg-[var(--vscode-sideBar-background)]">
      {/* Inject markdown styles once at root level */}
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />

      {/* Header with history toggle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--vscode-panel-border)]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
          AI Chat
        </span>
        <button
          onClick={toggleHistoryPanel}
          className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-colors"
          title="Chat History"
        >
          <History size={14} />
        </button>
      </div>

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
      ) : (
        <>
          {/* Selection indicator */}
          <SelectionIndicator />

          {/* Main content area */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isClaudeCode ? <AgentView /> : <ChatView />}
          </div>

          {/* Shared input */}
          <ChatInput />
        </>
      )}

      {/* Index footer — only for Ritemark Agent (RAG) */}
      {!isClaudeCode && <IndexFooter />}
    </div>
  );
}
