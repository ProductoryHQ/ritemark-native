/**
 * The AI column's turning mark, drawn by the AI's view itself (Sprint 152, R5, #624; the Experience lead's answer 5).
 *
 * While the AI's view waits for its extension, the shell draws a turning mark at the column's centre a second after the
 * column's first frame (Sprint 152, PR 3: the shell's loading look, patch 002's `ritemarkLoadingLook.ts`, drawn by patch
 * 018's `ritemarkSurfaces.css` `.ritemark-loading-mark`; `webviewViewPane.ts`). When the view takes over
 * it draws the same mark, in the same place, from its first frame, until it knows whether its settled look is the chat
 * or the sign-in: the same ring (16, 1.5 of `--vscode-input-border`, its top in `--vscode-foreground`, once a second),
 * centred in the view's window, which VS Code lays over the same pane the shell's mark is centred in, with the same
 * words for screen readers. It is plain HTML and CSS in the view's page, so it is there before the webview's script
 * has run (A4: the bundle draws nothing for 0.3–0.4 s after the page loads).
 *
 * The 1 s never starts again: if the shell's mark was showing, the view's shows from its first frame; if not, it shows
 * when 1 s has passed since the column's first frame, turning in step with where the shell's would be. Only the shell
 * knows that moment exactly, and it hands it over (W5, Sprint 152 PR 3: `_ritemark.loadingLook.since`, the moment the
 * column's slot began to wait); where it can't (an older shell, the view not in the AI column), the host gives its best
 * estimate (`aiColumnShownSince`).
 *
 * Dependency-free (no `vscode`), so its tests run under `npx tsx`.
 */

/** The element's id in the view's page; the view removes it when it draws its settled look. */
export const AI_STARTING_MARK_ID = 'rm-ai-starting';

/** What a screen reader says for the mark: the shell's words (`ritemark.aiStarting` in patch 018). */
export const AI_STARTING_WORDS = 'The AI is starting';

/** How long the column is bare ground before the mark shows: patch 002's `RITEMARK_MARK_AFTER_MS`. */
export const AI_STARTING_MARK_AFTER_MS = 1000;

/** The shell's command that hands over when a slot began to wait (W5; patch 002's `ritemarkLoadingLook.ts`). */
export const SHELL_LOOK_SINCE_COMMAND = '_ritemark.loadingLook.since';

/** How long the host waits for the shell's answer before its own estimate stands in. */
export const SHELL_LOOK_SINCE_WAIT_MS = 250;

/**
 * W5: when the shell's slot for this view began to wait (epoch ms), or undefined when the shell has no such moment (an
 * older shell without the command, a view the shell drew no look for) or doesn't answer within SHELL_LOOK_SINCE_WAIT_MS.
 * `execute` runs a command (`vscode.commands.executeCommand`), so this stays free of `vscode`.
 */
export async function shellLookSince(execute: (command: string, viewId: string) => Thenable<unknown>, viewId: string): Promise<number | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), SHELL_LOOK_SINCE_WAIT_MS); });
  try {
    const answer = await Promise.race([Promise.resolve(execute(SHELL_LOOK_SINCE_COMMAND, viewId)).catch(() => undefined), late]);
    return typeof answer === 'number' && Number.isFinite(answer) && answer > 0 ? answer : undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A view resolved this soon after Ritemark activated belongs to the window's start, so its column has been showing
 * since about when the extension host started. One resolved later is a column opened (or moved) later.
 */
export const AI_START_RESOLVE_WINDOW_MS = 1500;

export interface AiColumnTiming {
  /** When this extension host started (epoch ms): `performance.timeOrigin` in the extension host. */
  extensionHostStartedAt: number;
  /** When Ritemark activated (epoch ms). */
  activatedAt: number;
  /** When VS Code asked for this view (epoch ms): `resolveWebviewView`. */
  resolvedAt: number;
}

/**
 * The host's estimate of the column's first frame, from which the 1 s counts, where the shell hands over none.
 *
 * A view resolved as part of the start: the extension host is spawned when VS Code starts reading the extensions,
 * 0.05–0.25 s after the window's first frame (A4; A2's Windows marks), so its start is the closest moment the host
 * knows, never earlier than the column's. A view resolved later (the person opened the column, or the view moved): the
 * shell's mark started with that view's pane, just before the resolve.
 */
export function aiColumnShownSince(timing: AiColumnTiming): number {
  const partOfTheStart = timing.resolvedAt - timing.activatedAt <= AI_START_RESOLVE_WINDOW_MS;
  return partOfTheStart ? Math.min(timing.extensionHostStartedAt, timing.resolvedAt) : timing.resolvedAt;
}

/**
 * The mark's CSS and the script that times it, for the view page's `<head>`. The script runs before the page's first
 * paint: it sets how long the mark waits (`--rm-ai-starting-wait`) and where its turn starts (`--rm-ai-starting-turn`),
 * from the column's first frame and the page's own clock. It touches nothing else.
 */
export function aiStartingMarkHead(nonce: string, columnShownSince: number): string {
  const since = Number.isFinite(columnShownSince) ? Math.round(columnShownSince) : 0;
  return `<style>
    .rm-ai-starting {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 10;
      box-sizing: border-box;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      border-radius: 50%;
      border: 1.5px solid var(--vscode-input-border);
      border-top-color: var(--vscode-foreground);
      pointer-events: none;
      opacity: 0;
      animation: rm-ai-starting-show 0s linear var(--rm-ai-starting-wait, 0ms) forwards, rm-ai-starting-turn 1s linear var(--rm-ai-starting-turn, 0ms) infinite;
    }
    body.vscode-reduce-motion .rm-ai-starting {
      animation: rm-ai-starting-show 0s linear var(--rm-ai-starting-wait, 0ms) forwards;
    }
    @keyframes rm-ai-starting-show { to { opacity: 1; } }
    @keyframes rm-ai-starting-turn { to { transform: rotate(360deg); } }
  </style>
  <script nonce="${nonce}">
    (function () {
      var since = ${since};
      var shownAt = since + ${AI_STARTING_MARK_AFTER_MS};
      var now = Date.now();
      var wait = Math.max(0, shownAt - now);
      var turn = wait > 0 ? wait : -((now - shownAt) % 1000);
      document.documentElement.style.setProperty('--rm-ai-starting-wait', wait + 'ms');
      document.documentElement.style.setProperty('--rm-ai-starting-turn', turn + 'ms');
    })();
  </script>`;
}

/** The mark itself, for the end of the view page's `<body>`, above the view's root until the view removes it. */
export function aiStartingMarkBody(): string {
  return `<div id="${AI_STARTING_MARK_ID}" class="rm-ai-starting" role="status" aria-label="${AI_STARTING_WORDS}"></div>`;
}
