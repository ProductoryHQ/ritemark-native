/**
 * The status bar's AI item (Sprint 144, P3): names the AI the next message goes to and what Ritemark knows about it,
 * live for Claude, ChatGPT and OpenCode. The words come from `aiStatusPolicy.ts`; this file only gathers the inputs
 * and draws them.
 *
 * Where the inputs come from, all on the host, so the item is right before the AI's sheet has ever been opened:
 * - the internet: `connectivity.ts` (`isOnline`, `connectivityChanged`, `hasInternetAnswered`); Offline is decided
 *   before any probe, and "ready" waits for the internet's first answer;
 * - which AI: the open chat's, as the sheet reports it (`conversation/active`), else `ritemark.ai.selectedAgent`;
 * - its state: `UnifiedViewProvider.runtimeAvailability`, the one availability rule (Sprint 117, D12), re-read when
 *   Claude's or ChatGPT's status changes, when an OpenCode key changes, and when the open chat or the default AI does;
 * - a sign-in that ended: the open chat's last turn on that AI failed on sign-in, as the sheet reports it.
 *
 * Probing costs something (ChatGPT's probe starts its app server), so only the AI in question is probed, and results
 * are reused for 15 s. Only when that AI can't take a turn are the others probed, because "No AI yet" and
 * "Claude: sign in" differ by whether another AI can; the cheapest first (OpenCode reads its keys, Claude its CLI's
 * status, ChatGPT asks its app server), stopping at the first that can. The AI's sheet reads Claude's and ChatGPT's
 * status itself when it starts (`UnifiedViewProvider`'s hydration), and in a project window it starts with the window
 * (P5), so ChatGPT's app server runs either way.
 *
 * In 2.1 the item is its words only, in body ink, with one name, one hover and one click (the Experience lead,
 * experience 13, 3c0a2ae). A separate dot item sat 16 px from the words (VS Code's item padding), so it was dropped;
 * a dot may return in 2.2 only when one item can draw it 6 px from its words with one hover.
 */

import * as vscode from 'vscode';
import type { AgentId } from '../agent/types';
import { onClaudeStatusInvalidated } from '../agent/claudeStatusEvents';
import { onCodexStatusInvalidated } from '../codex/codexStatusEvents';
import { RUNTIME_LABELS, type RuntimeAvailability } from '../runtime/availability';
import { connectivityChanged, hasInternetAnswered, internetAnswered, isOnline, whenFirstConnectivityRound } from './connectivity';
import { describeAiStatus, type AiStatusView } from './aiStatusPolicy';

const AGENT_IDS: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];
/** The order the other AIs are probed in, cheapest first (ChatGPT's probe starts its app server). */
const BY_PROBE_COST: readonly AgentId[] = ['opencode', 'claude-code', 'codex'];
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
  /** The internet, `connectivity.ts` by default; a test passes its own. */
  internet?: InternetSource;
}

export interface InternetSource {
  isOnline(): boolean;
  /** A probe round has succeeded at least once; before that, `isOnline()` is the starting guess. */
  hasAnswered(): boolean;
  /** The online verdict changed, or the internet answered for the first time. */
  onDidChange(listener: () => void): vscode.Disposable;
  /** The first probe round has ended, whatever it found. */
  whenFirstRound(): Promise<void>;
}

const CONNECTIVITY: InternetSource = {
  isOnline,
  hasAnswered: hasInternetAnswered,
  onDidChange: (listener) => {
    const changed = connectivityChanged.event(() => listener());
    const answered = internetAnswered.event(() => listener());
    return { dispose: () => { changed.dispose(); answered.dispose(); } };
  },
  whenFirstRound: whenFirstConnectivityRound,
};

function asAgentId(value: unknown): AgentId {
  return AGENT_IDS.includes(value as AgentId) ? (value as AgentId) : 'claude-code';
}

function defaultAgent(): AgentId {
  return asAgentId(vscode.workspace.getConfiguration('ritemark.ai').get<string>('selectedAgent'));
}

export function initAiStatusItem(context: vscode.ExtensionContext, sources: AiStatusSources): void {
  const internet = sources.internet ?? CONNECTIVITY;
  const words = vscode.window.createStatusBarItem('ritemark.aiStatus', vscode.StatusBarAlignment.Right, 100);
  words.name = 'Ritemark AI status';
  words.command = 'ritemark.aiStatus.open';
  context.subscriptions.push(words);

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
    if (view.state === 'waiting') {
      words.hide(); // a signed-in AI before the internet has answered: claim nothing yet
      return;
    }
    words.text = view.text;
    words.tooltip = view.tooltip;
    words.accessibilityInformation = { label: view.text };
    words.show();
  }

  async function derive(): Promise<void> {
    const mine = ++generation;
    const chat = sources.openChat();
    const target = chat?.agentId ?? defaultAgent();
    const label = RUNTIME_LABELS[target];
    const base = { label, signInEnded: chat?.signInEnded === true, planRefused: false };
    let view: AiStatusView;
    if (!internet.isOnline()) {
      view = describeAiStatus({ ...base, online: false, internetAnswered: internet.hasAnswered(), usable: false, anyUsable: false });
    } else {
      let usable = false;
      try {
        usable = (await availability(target)).usable;
      } catch {
        usable = false;
      }
      let anyUsable = usable;
      if (!usable) {
        for (const other of BY_PROBE_COST.filter((id) => id !== target)) {
          try {
            if ((await availability(other)).usable) { anyUsable = true; break; }
          } catch {
            // an AI that can't be probed doesn't count as ready
          }
        }
      }
      view = describeAiStatus({ ...base, online: true, internetAnswered: internet.hasAnswered(), usable, anyUsable });
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
  // A sign-in or a repair that has only started changes nothing yet; its end (or a sign-out) does.
  const onCodex = onCodexStatusInvalidated((event) => {
    if (event.reason !== 'login-started' && event.reason !== 'repair-started') schedule(['codex']);
  });
  context.subscriptions.push(
    { dispose: onClaude },
    { dispose: onCodex },
    internet.onDidChange(() => schedule()),
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
  void internet.whenFirstRound().then(() => {
    started = true;
    void derive();
  });
}
