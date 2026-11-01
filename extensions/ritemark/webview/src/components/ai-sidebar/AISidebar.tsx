/**
 * AISidebar — Root component for the AI sidebar.
 *
 * Sets up the message listener, requests the atomic host bootstrap,
 * and renders the correct view based on store state.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAISidebarStore, useActiveConversation } from './store';
import { vscode } from '../../lib/vscode';
import { OfflineBanner } from './OfflineBanner';
import { OnboardingWizard } from './OnboardingWizard';
import { hasUndismissedInlineRecovery, sidebarGate, sidebarGateInput } from './sidebarGate';
import { SetupWizard } from './SetupWizard';
import { AgentView } from './AgentView';
import { CodexView } from './CodexView';
import { UnifiedConversationView } from './UnifiedConversationView';
import { LegacyConversationView } from './LegacyConversationView';
import { CodexSetupView } from './CodexSetupView';
import { OpenCodeSetupView } from './OpenCodeSetupView';
import { ChatInput } from './ChatInput';
import { ReportDialog, useReportDialog } from './reporting/ReportDialog';
import { SelectionIndicator } from './SelectionIndicator';
import { ConversationsPanel } from './ConversationsPanel';
import { ConversationHeader } from './ConversationHeader';
import { BackgroundSwitchDialog } from './ConversationDialogs';
import { ThreadRail } from './ThreadRail';
import { ActivePlanBanner } from './ActivePlanBanner';
import { getActiveApprovedPlanForClaude, getActiveApprovedPlanForCodex } from './lifecycle';
import { markdownStyles } from './RenderedMarkdown';
import type { AgentId, ExtensionMessage } from './types';
import { sendConversationRequest } from '../../bridge';
import { RuntimeAvailabilityNotice } from './RuntimeAvailabilityNotice';
import { ShareQuestionCard } from './ShareQuestionCard';
import { RUNTIME_LABEL } from './threadStatus';
import { deriveRuntimeAvailabilities, listReadyAlternatives, RUNTIME_LABELS } from './runtimeAvailability';
import { START_EXTRAS_GRACE_MS, startLook } from './startLook';
import { StartFailure, StartingLook } from './StartingLook';
import { AI_STARTING_MARK_ID } from '../../../../src/views/aiStartingMark';

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

  // Mounted here, not inside ChatInput, so the status bar's "Report AI issue"
  // reaches a live dialog in EVERY sidebar state — onboarding, agent setup,
  // bootstrapping — not only once a chat composer exists (#317).
  const reportDialog = useReportDialog();

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
      if (Array.isArray(savedState.dismissedAuthRecoveryTurnIds)) {
        useAISidebarStore.setState({
          dismissedAuthRecoveryTurnIds: savedState.dismissedAuthRecoveryTurnIds
            .filter((id): id is string => typeof id === 'string')
            .slice(-100),
        });
      }
      if (typeof savedState.currentConversationId === 'string' && /^[0-9a-f]{8}-/i.test(savedState.currentConversationId)) {
        useAISidebarStore.setState({ startConversationPending: true });
        sendConversationRequest({ type: 'conversation/get', requestId: `restore-${Date.now()}`, conversationId: savedState.currentConversationId });
      }
    }

    // Tell extension we're ready
    vscode.postMessage({ type: 'agent:bootstrap/request' });

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
        dismissedAuthRecoveryTurnIds: state.dismissedAuthRecoveryTurnIds,
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
  const bootstrapError = useAISidebarStore((s) => s.bootstrapError);
  const runtimeHydration = useAISidebarStore((s) => s.runtimeHydration);
  const onboardingDismissed = useAISidebarStore((s) => s.onboardingDismissed);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const dismissedAuthRecoveryTurnIds = useAISidebarStore((s) => s.dismissedAuthRecoveryTurnIds);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const hasSeenWelcome = useAISidebarStore((s) => s.hasSeenWelcome);
  const dismissWelcome = useAISidebarStore((s) => s.dismissWelcome);
  const showHistoryPanel = useAISidebarStore((s) => s.showHistoryPanel);
  const loadConversationList = useAISidebarStore((s) => s.loadConversationList);
  const chatFontSize = useAISidebarStore((s) => s.chatFontSize);
  const historyWasOpen = useRef(showHistoryPanel);
  // The transcript-and-composer column. The composer's menus are kept inside
  // it, clear of the thread rail beside it.
  const [conversationColumn, setConversationColumn] = useState<HTMLDivElement | null>(null);

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
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const opencodeEnabled = useAISidebarStore((s) => s.opencodeEnabled);
  const browserShareQuestion = useAISidebarStore((s) => s.browserShareQuestion);
  const answerBrowserShareQuestion = useAISidebarStore((s) => s.answerBrowserShareQuestion);
  const conversationRolloutMode = useAISidebarStore((s) => s.conversationRolloutMode);
  const startConversationPending = useAISidebarStore((s) => s.startConversationPending);
  const isClaudeCode = selectedAgent === 'claude-code';
  const isCodex = selectedAgent === 'codex';
  const isOpenCode = selectedAgent === 'opencode';
  const runtimeAvailabilities = deriveRuntimeAvailabilities({
    runtimeHydration,
    setupStatus,
    codexStatus,
    opencodeEnabled,
    acpProviders,
    byokProviderModels,
  });
  const selectedRuntimeAvailability = runtimeAvailabilities[selectedAgent];
  const readyAlternatives = listReadyAlternatives(runtimeAvailabilities, selectedAgent);
  const latestClaudeTurn = agentConversation[agentConversation.length - 1];
  const inlineRecoveryAvailable = isClaudeCode
    && hasUndismissedInlineRecovery(latestClaudeTurn, dismissedAuthRecoveryTurnIds);
  const hasAnyRuntimeConversation = agentConversation.length > 0
    || codexConversation.length > 0
    || legacyConversation !== null;
  const showWelcome = isClaudeCode && setupStatus !== null
    && setupStatus.state === 'ready' && !hasSeenWelcome && !hasAnyRuntimeConversation;

  // Sprint 107 R4: the "Claude is ready — Get Started" card no longer renders.
  // Its bookkeeping still runs the moment the ready-with-no-conversation state
  // is reached, so hasSeenWelcome / ritemark.ai.hasSeenClaudeWelcome end up
  // exactly as a manual "Get Started" click would have left them.
  useEffect(() => {
    if (ready && showWelcome) dismissWelcome();
  }, [ready, showWelcome, dismissWelcome]);

  const sidebarFacts = {
    ready,
    selectedAgent,
    availabilities: runtimeAvailabilities,
    onboardingStatusKnown: onboardingStatus !== null,
    onboardingDismissed,
    hasConversation: hasAnyRuntimeConversation,
    inlineRecoveryAvailable,
  };
  const sidebarView = sidebarGate(sidebarGateInput(sidebarFacts));

  // Sprint 152 (R5, #624): the view draws once. Until the messages make its look certain it shows the turning mark it
  // took over from the shell; then the gate's look, which stays (a later re-check never brings the mark back).
  const [extrasWaitOver, setExtrasWaitOver] = useState(false);
  const [settledOnce, setSettledOnce] = useState(false);
  const start = startLook({
    ...sidebarFacts,
    bootstrapError,
    conversationOnItsWay: conversationRolloutMode === 'unknown' || startConversationPending,
    extrasWaitOver,
  });
  const look: 'starting' | 'failed' | 'settled' = !ready
    ? (bootstrapError ? 'failed' : 'starting')
    : settledOnce ? 'settled' : start.look;
  const waitingForExtras = start.look === 'starting' && (start.waitingFor === 'conversation' || start.waitingFor === 'onboarding');
  useEffect(() => {
    if (!waitingForExtras || extrasWaitOver) return;
    const timeout = window.setTimeout(() => setExtrasWaitOver(true), START_EXTRAS_GRACE_MS);
    return () => window.clearTimeout(timeout);
  }, [waitingForExtras, extrasWaitOver]);
  useLayoutEffect(() => {
    if (look === 'settled' && !settledOnce) setSettledOnce(true);
    // The page's own mark (aiStartingMark.ts) goes in the same frame as the look that replaces it
    if (look !== 'starting') document.getElementById(AI_STARTING_MARK_ID)?.remove();
  }, [look, settledOnce]);
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

      {/* Mounted unconditionally (#317): every sidebarView value — including
          onboarding and agent setup, which render no ChatInput — must be able
          to receive the host's `report/open` message. */}
      <ReportDialog
        open={reportDialog.open}
        context={reportDialog.context}
        onOpenChange={reportDialog.setOpen}
      />

      {/* Conversations panel overlay; the rail remains visible. */}
      {showHistoryPanel && <ConversationsPanel />}

      {/* Offline banner */}
      {!isOnline && <OfflineBanner />}

      {/* Sprint 152 (R5, #624): the turning mark until the look is certain, then that look, once */}
      {look === 'starting' ? (
        <StartingLook
          aiName={ready ? RUNTIME_LABELS[selectedAgent] : null}
          onTryAgain={() => {
            if (!ready) {
              vscode.postMessage({ type: 'agent:bootstrap/request' });
              return;
            }
            // The AIs still being checked, or the chosen one when every AI has answered
            const checking = (Object.keys(runtimeAvailabilities) as AgentId[]).filter((id) => runtimeAvailabilities[id].state === 'checking');
            for (const runtimeId of checking.length > 0 ? checking : [selectedAgent]) {
              vscode.postMessage({ type: 'agent:status/recheck', runtimeId });
            }
          }}
        />
      ) : look === 'failed' ? (
        <StartFailure
          onTryAgain={() => {
            useAISidebarStore.setState({ bootstrapError: null });
            vscode.postMessage({ type: 'agent:bootstrap/request' });
          }}
        />
      ) : sidebarView === 'onboarding' ? (
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
            Sprint 109: header, transcript and composer share ONE column, and
            the permanent 56 px thread rail runs the full height beside it. The
            composer is therefore 56 px narrower than the sidebar: whatever
            opens from it has to fit this column or be drawn above the rail.
          */}
          <div className="flex-1 min-h-0 flex overflow-hidden rm-ai-ground">{/* Ritemark 2.0: the AI's sheet on the ground, the rail beside it */}
            <div ref={setConversationColumn} className="flex-1 min-w-0 flex flex-col overflow-hidden rm-ai-sheet">
              {/* Sprint 122 (#282): the conversation you are in, named, with History's actions. */}
              <ConversationHeader />
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
              {!inlineRecoveryAvailable && (
                <RuntimeAvailabilityNotice
                  runtimeId={selectedAgent}
                  availability={selectedRuntimeAvailability}
                  alternativeRuntime={readyAlternatives[0] ?? null}
                />
              )}
              {browserShareQuestion && (
                <ShareQuestionCard
                  key={browserShareQuestion.pageId}
                  aiName={RUNTIME_LABEL[selectedAgent === 'claude-code' ? 'claude' : selectedAgent]}
                  pageTitle={browserShareQuestion.title}
                  onAnswer={answerBrowserShareQuestion}
                />
              )}
              <ChatInput onReport={reportDialog.request} menuBoundary={conversationColumn} />
            </div>
            <ThreadRail />
            <BackgroundSwitchDialog />
          </div>
        </>
      )}

    </div>
  );
}
