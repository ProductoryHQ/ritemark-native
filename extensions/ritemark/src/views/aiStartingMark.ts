/**
 * The AI column's turning mark, drawn by the AI's view itself (Sprint 152, R5, #624; the Experience lead's answer 5).
 *
 * While the AI's view waits for its extension, patch 018 draws a turning mark at the column's centre a second after the
 * column's first frame (`webviewViewPane.ts`, `ritemarkSurfaces.css` `.ritemark-ai-starting`). When the view takes over
 * it draws the same mark, in the same place, from its first frame, until it knows whether its settled look is the chat
 * or the sign-in: the same ring (16, 1.5 of `--vscode-input-border`, its top in `--vscode-foreground`, once a second),
 * centred in the view's window, which VS Code lays over the same pane the shell's mark is centred in, with the same
 * words for screen readers. It is plain HTML and CSS in the view's page, so it is there before the webview's script
 * has run (A4: the bundle draws nothing for 0.3–0.4 s after the page loads).
 *
 * The 1 s never starts again: if the shell's mark was showing, the view's shows from its first frame; if not, it shows
 * when 1 s has passed since the column's first frame, turning in step with where the shell's would be. Only the shell
 * knows that moment exactly; until it hands it over (Sprint 152, PR 2), the host gives its best estimate
 * (`aiColumnShownSince`).
 *
 * Dependency-free (no `vscode`), so its tests run under `npx tsx`.
 */

/** The element's id in the view's page; the view removes it when it draws its settled look. */
export const AI_STARTING_MARK_ID = 'rm-ai-starting';

/** What a screen reader says for the mark: the shell's words (`ritemark.aiStarting` in patch 018). */
export const AI_STARTING_WORDS = 'The AI is starting';

/** How long the column is bare ground before the mark shows: patch 018's `RITEMARK_STARTING_MARK_AFTER_MS`. */
export const AI_STARTING_MARK_AFTER_MS = 1000;

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
 * The host's estimate of the column's first frame, from which the 1 s counts.
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
