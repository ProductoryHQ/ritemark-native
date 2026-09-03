import { useMemo } from 'react';
import { useActiveConversation, useAISidebarStore } from './store';
import {
  RUNTIME_LABELS,
  resolveAvailableRuntimeModel,
  type RuntimeAvailability,
} from './runtimeAvailability';
import { RuntimeNotice, type RuntimeNoticeAction } from './RuntimeNotice';
import type { AgentId } from './types';
import { vscode } from '../../lib/vscode';

interface RuntimeAvailabilityNoticeProps {
  runtimeId: AgentId;
  availability: RuntimeAvailability;
  alternativeRuntime: AgentId | null;
}

function stateTitle(runtimeId: AgentId, availability: RuntimeAvailability): string {
  const label = RUNTIME_LABELS[runtimeId];
  switch (availability.state) {
    case 'needs-auth': return `${label} is signed out`;
    case 'auth-in-progress': return `Finish signing in to ${label}`;
    case 'needs-configuration': return `${label} needs setup`;
    case 'not-installed': return `${label} is not installed`;
    case 'broken': return `${label} needs repair`;
    case 'disabled': return `${label} is turned off`;
    case 'error': return `Could not check ${label}`;
    default: return `${label} is unavailable`;
  }
}

function stateMessage(
  runtimeId: AgentId,
  availability: RuntimeAvailability,
  alternativeRuntime: AgentId | null,
): string {
  const label = RUNTIME_LABELS[runtimeId];
  const alternative = alternativeRuntime ? RUNTIME_LABELS[alternativeRuntime] : null;
  const base = availability.state === 'auth-in-progress'
    ? `Complete the account flow in your browser. Ritemark will update ${label} automatically.`
    : availability.state === 'needs-auth'
      ? `Sign in again to continue with ${label}.`
      : availability.state === 'needs-configuration'
        ? `${label} does not have the account or provider setup required to answer.`
        : availability.state === 'not-installed'
          ? `${label} must be installed before it can answer.`
          : availability.state === 'broken'
            ? `${label} is present but Ritemark could not start it correctly.`
            : availability.state === 'error'
              ? `Ritemark could not confirm whether ${label} is ready.`
              : `${label} cannot accept a message right now.`;
  return alternative
    ? `${base} Or continue this conversation with ${alternative}.`
    : base;
}

export function RuntimeAvailabilityNotice({
  runtimeId,
  availability,
  alternativeRuntime,
}: RuntimeAvailabilityNoticeProps) {
  const conversation = useActiveConversation();
  const models = useAISidebarStore((s) => s.models);
  const codexModels = useAISidebarStore((s) => s.codexModels);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const selectRuntimeModel = useAISidebarStore((s) => s.selectRuntimeModel);
  const startInstall = useAISidebarStore((s) => s.startInstall);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const reloadWindow = useAISidebarStore((s) => s.reloadWindow);
  const startCodexLogin = useAISidebarStore((s) => s.startCodexLogin);
  const repairCodex = useAISidebarStore((s) => s.repairCodex);
  const openAgentSettings = useAISidebarStore((s) => s.openAgentSettings);

  const alternativeModel = useMemo(() => {
    if (!alternativeRuntime) return '';
    return resolveAvailableRuntimeModel(alternativeRuntime, {
      claude: conversation.selectedModel,
      codex: conversation.codexSelectedModel,
      opencode: conversation.opencodeSelectedModel,
    }, {
      claude: models,
      codex: codexModels,
      opencode: byokProviderModels,
      acpProviders,
    }) ?? '';
  }, [acpProviders, alternativeRuntime, byokProviderModels, codexModels, conversation.codexSelectedModel, conversation.opencodeSelectedModel, conversation.selectedModel, models]);

  const alternativeAction: RuntimeNoticeAction | undefined = alternativeRuntime && alternativeModel
    ? {
        label: `Use ${RUNTIME_LABELS[alternativeRuntime]}`,
        icon: 'chat-circle',
        onAction: () => selectRuntimeModel(alternativeRuntime, alternativeModel),
      }
    : undefined;

  let recoveryAction: RuntimeNoticeAction | undefined;
  if (availability.state === 'error') {
    recoveryAction = {
      label: 'Try again',
      icon: 'arrows-clockwise',
      onAction: () => vscode.postMessage({ type: 'agent:status/recheck', runtimeId }),
    };
  } else if (runtimeId === 'claude-code') {
    if (availability.state === 'needs-auth') {
      recoveryAction = {
        label: alternativeAction ? 'Sign in' : 'Sign in to Claude',
        icon: 'sign-in',
        onAction: () => startLogin(),
      };
    } else if (availability.state === 'not-installed') {
      recoveryAction = { label: 'Install Claude', icon: 'wrench', onAction: startInstall };
    } else if (availability.state === 'broken') {
      recoveryAction = setupStatus?.repairAction === 'reload'
        ? { label: 'Reload Window', icon: 'arrows-clockwise', onAction: reloadWindow }
        : { label: 'Repair Claude', icon: 'wrench', onAction: startInstall };
    } else if (availability.state === 'disabled' || availability.state === 'needs-configuration') {
      recoveryAction = { label: 'Open AI Settings', icon: 'gear', onAction: openAgentSettings };
    }
  } else if (runtimeId === 'codex') {
    if (availability.state === 'needs-auth') {
      recoveryAction = {
        label: alternativeAction ? 'Sign in' : 'Sign in with ChatGPT',
        icon: 'sign-in',
        onAction: startCodexLogin,
      };
    } else if (availability.state === 'broken') {
      recoveryAction = { label: 'Repair Codex', icon: 'wrench', onAction: repairCodex };
    } else if (availability.state === 'disabled' || availability.state === 'needs-configuration') {
      recoveryAction = { label: 'Open AI Settings', icon: 'gear', onAction: openAgentSettings };
    }
  } else if (availability.state !== 'auth-in-progress') {
    recoveryAction = { label: 'Open AI Settings', icon: 'gear', onAction: openAgentSettings };
  }

  if (availability.state === 'ready' || availability.state === 'checking') {
    return null;
  }

  const progress = availability.state === 'auth-in-progress';
  return (
    <div className="px-3 pb-2">
      <RuntimeNotice
        tone={progress ? 'progress' : 'warning'}
        title={stateTitle(runtimeId, availability)}
        message={stateMessage(runtimeId, availability, alternativeRuntime)}
        statusLabel={progress ? 'Waiting for sign-in…' : undefined}
        secondaryAction={alternativeAction ? recoveryAction : undefined}
        primaryAction={alternativeAction ?? recoveryAction}
      />
    </div>
  );
}
