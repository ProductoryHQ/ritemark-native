# A4: The AI view's starts (R5, #624)

1–2 November 2026, for Sprint 152's PR 1, on `origin/main` (`f84f4513`). It records what the AI column draws from the window's first frame to its settled look, for each AI, and what decides the settled look, before W2 changes it.

## How it was run

- Hidden dev instances of this tree (VS Code `d956e8a6` with the 19 patches, the extension and webview bundle as on `main`), each on a fresh profile under `/private/tmp`, with scratch Claude, Codex and XDG homes and `--use-mock-keychain`. **Nobody was signed in to any AI**, so every row below is the not-signed-in start.
- The AI was chosen before the launch (`ritemark.ai.selectedAgent`: `claude-code`, `codex`, `opencode`), and each instance was launched on a scratch project, so the first window is a project window, with its AI column.
- A tracer (a scratch script, not committed, like Sprint 145's S47 traces) read the window every 45 ms over CDP: from the workbench, whether the AI column is shown and whether patch 018's turning mark is in it; from the AI view's own frame, the text its `#root` draws. Times are from the window's first frame (`code/didRemovePartsSplash`). Each instance was traced from its launch, then again across Developer: Reload Window.
- One more start held the extension host for 10 s (`--inspect-brk-extensions`, let go by `project-check.mjs --first-frame`), so the shell's mark shows and the view takes over from it, as on a cold Windows start.

## What the column draws

Not signed in, the first window of a new profile (the column itself arrives about 0.3 s after the first frame, when VS Code has read the extensions; that move is A1's):

| ms after the first frame | Claude chosen | ChatGPT chosen | OpenCode chosen |
| --- | --- | --- | --- |
| column shown, bare ground | 343 | 266 | 372 |
| the view's frame loads, nothing drawn | 731 | 655 | 776 |
| **"Preparing Agent Chat… Loading the local model catalog and your last selection."** | 1091 | 1002 | 1108 |
| **the empty chat**: "New conversation · What shall we work on? · Claude can work across…", then its starting points | 1311–1355 | 1222–1266 | 1377–1426 |
| **the AI's own sign-in screen**: "Sign in with Claude.ai…", "Sign in with ChatGPT…", "Set up your API keys…" | 2416 | 2025 | 1577 |
| **"Almost there!"**, the settled look | 2504 | 2288 | 2694 |

After Reload Window, the same order, a little faster, with one more look first: VS Code's lazy-load **"Loading..."** for about 45 ms at 982–1028 ms (`main.tsx`'s `Suspense` fallback for the AI view), then the card at 1026–1074 ms, the chat at 1205–1258 ms, the sign-in screen (ChatGPT 2013 ms, OpenCode 1391 ms; Claude's went by between two reads), and "Almost there!" at 2054–2240 ms.

So a person who isn't signed in sees **four or five looks in about 1.5 s** before the one that stays: Loading, the card, the empty chat, a sign-in screen, then "Almost there!".

**The held start** (Claude, extension host let go at 10.0 s): the column is bare ground from 0.29 s; the shell's turning mark from 1.25 s to 10.97 s, at `[1236, 448, 16, 16]` (centre 1244, 456) in an AI column at `[1040, 0, 400, 868]`; then the mark goes with the view's resolve, the view's frame loads at 11.02 s with nothing drawn, and its first look, the card, comes at 11.35 s, followed by the chat at 11.40 s and "Almost there!" at 12.55 s. Between the shell's mark and the view's first look there are **0.33 s of bare ground**: the blink the Experience lead's answer 5 rules out.

The shell's mark is centred in the view's pane, below the column's own top edge, not in the column part: its centre is 4 px right of and 22 px below the part's. The view's frame is laid over the same pane (`WebviewViewPane.layoutWebview`, anchored to the pane's container), so a mark at the centre of the view's own window is at the shell's place; W2's proof measures both.

**Signed in: not run.** A scratch home has no signed-in AI, and these runs sign in to nothing. Read from the code (below), a signed-in start differs only at its end: the empty chat stays as the settled look once the chosen AI's check answers ready, so the card and the "Checking Claude…" chat come before it.

## What decides the look

In `AISidebar.tsx`, from the webview's mount:

1. **"Loading..."**: `main.tsx` loads the AI view lazily inside a `Suspense` whose fallback is that word. It shows until the lazy import resolves.
2. **"Preparing Agent Chat…"** (`AISidebar.tsx` lines 292–323): drawn while `ready` is false, that is until the host's `agent:bootstrap` arrives. After 8 s the same card says "Agent Chat could not start · Agent Chat is taking longer than expected to load its local configuration." with Try again; a real `agent:bootstrap-error` says it at once.
3. **The empty chat**: `agent:bootstrap` sets `ready`, and `sidebarGate` returns `chat` because every AI's availability is still `checking`, and `needsSetup` is false while checking. `RuntimeAvailabilityNotice` says the AI is being checked. After 15 s of `checking`, a warning card at the top says "Still checking Claude".
4. **The AI's sign-in screen**: the chosen AI's status arrives (`agent-setup:complete` for Claude, `codex:status` for ChatGPT, `acp-providers` for OpenCode), not usable, so `needsSetup` (or `showCodexSetup`, `showOpenCodeSetup`) is true; `onboardingStatus` is still null, so `onboardingNeeded` is false, and the gate returns the setup view.
5. **"Almost there!"**: the host sends `onboarding:status` only after Claude's and ChatGPT's checks have both answered (`UnifiedViewProvider`, the `Promise.all` after the bootstrap request), and not at all when either check failed. With no AI usable and the wizard not dismissed, the gate returns `onboarding`.

So **the message that decides the settled look** is:

- **signed in**: the chosen AI's status saying it is usable (or, with the chosen one not usable, another AI's status saying it is, once every AI has answered: the gate's `hasReadyAlternative`);
- **not signed in**: `onboarding:status`, which comes after every AI has answered;
- **a conversation already open** (restored at the start: `conversation/initialize`, then `conversation/get`): the chat, whatever the AIs answer, so the restore has to land before the view can say it is the sign-in.

**Can the host send it in `agent:bootstrap`?** No. The bootstrap is deliberately local and synchronous: "runtime, credential, process, network, and discovery work is forbidden in this path" (`_sendAgentBootstrap`), and the AIs' statuses are exactly that work (CLI checks, the keychain). Putting them in it would make the model list wait on them, which Sprint 108 removed. The view can decide from the messages it already gets, so W2 adds **no message type and no field**: it waits, in its starting look, until those messages make the look certain.

**The turning mark in the webview:** no webview component draws the kit's mark. The webview's spinners are the Phosphor `circle-notch` icon with `animate-spin` (Settings, Home's guidance), which is not the shell's mark: patch 018 draws a 16 px ring, 1.5 px of `--vscode-input-border` with its top in `--vscode-foreground`, turning once a second (`ritemarkSurfaces.css`, `.ritemark-ai-starting`). The view gets the same theme variables, so W2 draws the same ring, from the same values.

## What this means for W2

- The view's first frame must be the shell's mark, at the same place, before the webview's script has run: the 8.7 MB bundle takes 0.3–0.4 s to draw anything after the view's frame loads.
- The shell takes its mark away when the view is resolved, and the view's frame paints a moment later. The host can keep the shell's mark until the view has drawn: VS Code awaits `resolveWebviewView`'s promise before it removes the mark (`ritemarkUntilResolved` in 018's `webviewViewPane.ts`).
- The view's 1 s has to count from the column's first frame, which only the shell knows. In PR 1 the host can estimate it: the extension host's start, for a view resolved as part of Ritemark's start (it is spawned 0.05–0.25 s after the first frame: `willLoadExtensions` in A1's marks and A2's p1); the resolve itself, for a column opened later. PR 2 can hand over the shell's own moment (W5, the column slot's loading look).
- Five looks become two: the mark, then the settled look. The 8 s card and the 15 s card become the Experience lead's one slow line under the mark, after 10 s of the view's own check (answer 5). A real failure (`agent:bootstrap-error`, the only one the traces' code paths can reach before the view is ready) becomes "The AI couldn't start", with its words to the lead with the screenshots. A chosen AI whose check fails (`agent:runtime-status-error`) is not a failed start: the chat is its settled look, with `RuntimeAvailabilityNotice` saying the check failed, as today.
