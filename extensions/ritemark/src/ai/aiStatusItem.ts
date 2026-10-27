/**
 * The status bar's AI item (Sprint 144, P3): names the AI the next message goes to and what Ritemark knows about it,
 * live for Claude, ChatGPT and OpenCode. The words come from `aiStatusPolicy.ts`; this file only gathers the inputs
 * and draws them.
 *
 * Where the inputs come from, all on the host, so the item is right before the AI's sheet has ever been opened:
 * - the internet: `connectivity.ts` (`isOnline`, `connectivityChanged`); Offline is decided before any probe;
 * - which AI: the open chat's, as the sheet reports it (`conversation/active`), else `ritemark.ai.selectedAgent`;
 * - its state: `UnifiedViewProvider.runtimeAvailability`, the one availability rule (Sprint 117, D12), re-read when
 *   Claude's or ChatGPT's status changes, when an OpenCode key changes, and when the open chat or the default AI does;
 * - a sign-in that ended: the open chat's last turn on that AI failed on sign-in, as the sheet reports it.
 *
 * Probing costs something (ChatGPT's probe starts its app server), so only the AI in question is probed, results are
 * reused for 15 s, and the other two are probed only to tell "No AI yet" from "Claude: sign in".
 *
 * The dot is its own item just left of the words, because VS Code colours an item's text all at once and the words
 * stay in body ink. It takes no command (no hover, not clickable, not a tab stop) and is hidden from screen readers, so
 * the words carry the one name, the one hover and the one click (the Experience lead's condition, b058692).
 */

import * as vscode from 'vscode';
import type { AgentId } from '../agent/types';
import { onClaudeStatusInvalidated } from '../agent/claudeStatusEvents';
import { onCodexStatusInvalidated } from '../codex/codexStatusEvents';
import { RUNTIME_LABELS, type RuntimeAvailability } from '../runtime/availability';
import { connectivityChanged, isOnline, whenFirstConnectivityRound } from './connectivity';
import { describeAiStatus, type AiStatusDot, type AiStatusView } from './aiStatusPolicy';

const AGENT_IDS: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];
const REUSE_MS = 15_000;
const DEBOUNCE_MS = 300;

export interface OpenChatReport {
  agentId: AgentId;
  /** The chat's last turn on that AI failed on sign-in. */
  signInEnded: boolean;
}

export interface AiStatusSources {
  runtimeAvailability(runtimeId: AgentId): Promise<RuntimeAvailability>;
  /** The chat open on the AI's sheet, as the sheet last reported it; null when it reported none. */
  openChat(): OpenChatReport | null;
  onDidChangeOpenChat(listener: () => void): vscode.Disposable;
  /** The model catalog changed (`modelCatalog.onUpdate`): OpenCode's readiness follows its model list. */
  onDidUpdateModels(listener: () => void): vscode.Disposable;
}

const DOT_COLORS: Record<AiStatusDot, string> = {
  green: 'testing.iconPassed',
  grey: 'descriptionForeground',
  amber: 'editorWarning.foreground',
};

function asAgentId(value: unknown): AgentId {
  return AGENT_IDS.includes(value as AgentId) ? (value as AgentId) : 'claude-code';
}

function defaultAgent(): AgentId {
  return asAgentId(vscode.workspace.getConfiguration('ritemark.ai').get<string>('selectedAgent'));
}

export function initAiStatusItem(context: vscode.ExtensionContext, sources: AiStatusSources): void {
  const dot = vscode.window.createStatusBarItem('ritemark.aiStatus.dot', vscode.StatusBarAlignment.Right, 101);
  dot.name = 'Ritemark AI status (dot)';
  dot.text = '$(circle-filled)';
  dot.accessibilityInformation = { label: '', role: 'presentation' };
  const words = vscode.window.createStatusBarItem('ritemark.aiStatus', vscode.StatusBarAlignment.Right, 100);
  words.name = 'Ritemark AI status';
  words.command = 'ritemark.aiStatus.open';
  context.subscriptions.push(dot, words);

  const cache = new Map<AgentId, { at: number; value: RuntimeAvailability }>();
  // One probe at a time per AI, and a probe that an invalidation overtook is not kept (its epoch moved on)
  const inFlight = new Map<AgentId, Promise<RuntimeAvailability>>();
  const epoch = new Map<AgentId, number>();
  let generation = 0;
  let timer: NodeJS.Timeout | undefined;
  let started = false;

  async function availability(runtimeId: AgentId): Promise<RuntimeAvailability> {
    const hit = cache.get(runtimeId);
    if (hit && Date.now() - hit.at < REUSE_MS) return hit.value;
    const running = inFlight.get(runtimeId);
    if (running) return running;
    const startedEpoch = epoch.get(runtimeId) ?? 0;
    const probe = sources.runtimeAvailability(runtimeId)
      .then((value) => {
        if ((epoch.get(runtimeId) ?? 0) === startedEpoch) cache.set(runtimeId, { at: Date.now(), value });
        return value;
      })
      .finally(() => { if (inFlight.get(runtimeId) === probe) inFlight.delete(runtimeId); });
    inFlight.set(runtimeId, probe);
    return probe;
  }

  function draw(view: AiStatusView): void {
    words.text = view.text;
    words.tooltip = view.tooltip;
    words.accessibilityInformation = { label: view.text };
    words.show();
    if (view.dot) {
      dot.color = new vscode.ThemeColor(DOT_COLORS[view.dot]);
      dot.show();
    } else {
      dot.hide();
    }
  }

  async function derive(): Promise<void> {
    const mine = ++generation;
    const chat = sources.openChat();
    const target = chat?.agentId ?? defaultAgent();
    const label = RUNTIME_LABELS[target];
    const base = { label, signInEnded: chat?.signInEnded === true, planRefused: false };
    let view: AiStatusView;
    if (!isOnline()) {
      view = describeAiStatus({ ...base, online: false, usable: false, anyUsable: false });
    } else {
      let usable = false;
      try {
        usable = (await availability(target)).usable;
      } catch {
        usable = false;
      }
      let anyUsable = usable;
      if (!usable) {
        for (const other of AGENT_IDS.filter((id) => id !== target)) {
          try {
            if ((await availability(other)).usable) { anyUsable = true; break; }
          } catch {
            // an AI that can't be probed doesn't count as ready
          }
        }
      }
      view = describeAiStatus({ ...base, online: true, usable, anyUsable });
    }
    if (mine !== generation) return; // a newer request has started; its answer wins
    draw(view);
  }

  function schedule(forget?: AgentId[]): void {
    for (const runtimeId of forget ?? []) {
      cache.delete(runtimeId);
      inFlight.delete(runtimeId);
      epoch.set(runtimeId, (epoch.get(runtimeId) ?? 0) + 1);
    }
    if (!started) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void derive();
    }, DEBOUNCE_MS);
  }

  const onClaude = onClaudeStatusInvalidated((event) => {
    if (event.reason !== 'login-started' && event.reason !== 'install-started') schedule(['claude-code']);
  });
  const onCodex = onCodexStatusInvalidated(() => schedule(['codex']));
  context.subscriptions.push(
    { dispose: onClaude },
    { dispose: onCodex },
    connectivityChanged.event(() => schedule()),
    context.secrets.onDidChange(() => schedule(['opencode'])),
    // OpenCode's readiness also follows its model list, as the welcome's does
    sources.onDidUpdateModels(() => schedule(['opencode'])),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ritemark.ai.selectedAgent')) schedule();
    }),
    sources.onDidChangeOpenChat(() => schedule()),
    // The click opens the AI's sheet on the open chat. With no AI yet and an empty chat, the sheet's own gate shows
    // its sign-in card (`sidebarGate.ts`), so the item adds no message of its own.
    vscode.commands.registerCommand('ritemark.aiStatus.open', () => vscode.commands.executeCommand('ritemark.showAIPanel')),
    { dispose: () => { if (timer) clearTimeout(timer); } },
  );

  // The first answer waits for the first connectivity round, so the item never starts on a guess.
  void whenFirstConnectivityRound().then(() => {
    started = true;
    void derive();
  });
}
