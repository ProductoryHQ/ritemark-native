# Sprint 67: Browser-Aware AI Chat Context

## Goal

Give the AI chat panel useful, browser-aware context about the active in-app browser tab: URL, page title when available, compacted DOM/text summary, and an explicit higher-context annotation mode that can attach visible-page context and a viewport screenshot for the current turn. The goal is that Claude Code SDK and Codex can answer questions about what is on the page, not merely identify the URL.

---

## Background / Context

The "Ritemark Agent" runtime (OpenAI Chat Completions, `openAIClient.ts`, `selectedAgent: 'ritemark-agent'`) is deprecated ghost code slated for removal. New features must not target it. This sprint explicitly excludes the OpenAI runtime. See project memory: `~/.claude/projects/-Users-jarmotuisk-Projects-ritemark-native/memory/project_ritemark_agent_deprecated.md`.

---

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - Browser-aware context now includes DOM/text summaries and optional screenshot/annotation context, which is higher risk than URL-only.
  - **Decision: Add a kill-switch/config guard if implementation touches workbench BrowserView read/screenshot APIs.** The normal user-facing control remains chip-level dismiss/annotation consent; the engineering guard protects incomplete full-app builds.

---

## Success Criteria

- [ ] Asking “what page am I looking at?” returns the active browser tab URL and, when available, page title.
- [ ] Asking content/layout questions about the active page (e.g. “what does this button say?”, “why is the spacing around the title narrow?”, “summarize this article”) receives page-aware answers based on compacted browser context, not just the URL.
- [ ] Claude Code SDK chat receives browser context for the current turn when the browser chip is present.
- [ ] Codex chat receives browser context for the current turn when the browser chip is present.
- [ ] Composer chip shows the active browser context state: normal browser context vs annotation/high-context mode.
- [ ] Dismissing the chip via X removes browser context from that turn only; the chip reappears on the next eligible turn.
- [ ] Annotation mode is explicit per-turn and, if technically feasible, toggled from the existing browser menu where users already access browser actions such as DevTools. The chat chip may reflect the state, but the primary control should live in the browser menu rather than adding another permanent composer control. It does not silently attach high-risk page contents forever.
- [ ] Browser context is compacted and bounded so large pages cannot explode prompt size.
- [ ] Sensitive/high-context sharing has a clear consent boundary before DOM/screenshot content is sent.
- [ ] When no browser tab is focused, no browser context is injected and the chip is absent.
- [ ] Ritemark Agent (OpenAI runtime) receives no browser context — it is excluded as deprecated.
- [ ] `npm run compile` passes.
- [ ] Webview bundle rebuild passes when UI changes are included.
- [ ] `./scripts/validate-qa.sh` passes.
- [ ] Dev smoke proves: external site render + local file render + DOM-aware answer + annotation/screenshot path.

---

## Scope

**In scope (5 tracks):**
- **Track 1 — `BrowserContextStore`:** Extension-host singleton tracking active browser tab metadata: URL, page/title when known, browser/page identifier if available, last-updated timestamp, and whether the tab is eligible for content sharing.
- **Track 2 — Workbench browser read bridge:** Add the minimum VS Code/Ritemark workbench bridge needed to read the active BrowserView page context from the Electron browser stack. Target capabilities:
  - current URL/title for the active browser tab
  - compact page text / accessibility-ish DOM summary via existing browser/playwright infrastructure where possible
  - viewport screenshot capture for annotation mode
  - active-tab/focus tracking robust enough for browser ↔ editor switching
- **Track 3 — Context compactor / stripper:** Convert raw browser page data into bounded model context. Strip scripts/styles/noise, preserve headings/buttons/forms/visible text/landmarks, include URL/title, and enforce hard token/character caps.
- **Track 4 — Passive + annotation injection:** Claude Code SDK (`AgentRunner.ts`) and Codex (`UnifiedViewProvider.ts`) receive browser context. Normal mode sends a compact text/DOM summary; annotation mode can additionally attach richer visible-page context and screenshot evidence for the current turn. Ritemark Agent/OpenAI remains excluded.
- **Track 5 — Composer chip UI:** Mirror active-file chip pattern but make state explicit: `Browser: <title-or-url>` plus an annotation/high-context toggle/action and X dismiss. The chip must make it visible when page content/screenshot will be shared.

**Out of scope (explicitly excluded):**
- Ritemark Agent / OpenAI runtime support — deprecated ghost code, excluded by design
- Full autonomous browser control tools (click/type/navigate by AI) — this sprint is context/read/annotation, not remote-control automation
- Persistent page capture history — context is current-tab/current-turn only
- Cross-origin bypasses or scraping protected content outside what the active BrowserView can legitimately render/read
- Unbounded full DOM dumps — large pages must be compacted/capped
- Settings master toggle as first-class settings work — if implementation needs a kill switch, prefer an internal/default config or feature flag; UX is chip-level consent/dismiss
- Windows-specific testing beyond compile verification unless the workbench bridge touches platform-specific code

**Release implication:**
- This is no longer extension-only if Track 2 requires VS Code workbench changes. Treat Sprint 67 as a full app sprint with workbench patch + dev smoke + QA gates.


## Phase 2A — Technical Feasibility Audit

- [x] Audit completed: `research/technical-feasibility.md`
- [x] Result: DOM/text summary and screenshot are feasible by reusing existing BrowserView + Playwright internals.
- [x] Constraint: implementation is **not extension-only**; a workbench bridge is needed for reliable active BrowserView state, page summary, screenshot, and browser-menu annotation toggle.
- [x] Recommendation: proceed as a full app/workbench patch sprint, with bounded/consented browser context.

---

## Phase 2B — Implementation Reality Audit

Substantial pre-implementation has already landed on this branch ahead of the approval gate. Recorded here for accuracy and to feed the open-decision list — **not** treated as approval-by-default. Phase 3 sign-off still required before further coding.

### Pre-implemented surface

Extension-host:
- `extensions/ritemark/src/browser/BrowserContextStore.ts` (new, untracked)
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` — browser-context injection in Claude `_handleAgentExecution` + Codex `_handleCodexExecution`, 1500 ms metadata poll, `active-browser-changed` postMessage
- `extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx` — `Browser:` chip with X dismiss + annotation styling
- `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` — `currentBrowserContext`, `skipBrowserContext` plumbing
- `extensions/ritemark/media/webview.js` — rebuilt bundle

Workbench (in `vscode/` submodule, not yet captured in a patch):
- `src/vs/platform/browserView/common/browserView.ts` — 5 new `BrowserViewCommandId` enum values (`GetActiveContext`, `GetActiveSummary`, `CaptureActiveViewport`, `ToggleAnnotationMode`, `GetAnnotationMode`)
- `src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserContextFeature.ts` — new file (221 lines): 5 `Action2` registrations, `CONTEXT_RITEMARK_BROWSER_ANNOTATION_MODE` context key, `RitemarkBrowserAnnotationContribution` lifecycle hook
- `src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts` — single import line to register the feature

### Findings against the plan

| # | Finding | Conflict with plan? |
|---|---|---|
| 1 | Workbench feature sets `annotationMode: model.sharedWithAgent` (line 56) — the two states are the **same boolean**. `ToggleAnnotationMode` action calls `setSharedWithAgent(!current)`. There is no distinct annotation state on `IBrowserViewModel`. | **Yes** — contradicts D3 (normal vs annotation modes are separate) |
| 2 | `BrowserContextStore.buildTurnContext` is called with `includeScreenshot: true` for every Claude/Codex turn. Once user toggles share, **every turn ships a viewport JPEG** (~50–200 KB base64). | **Yes** — D3 implies screenshot is annotation-only and per-turn opt-in |
| 3 | `setInterval(..., 1500)` runs unconditionally once webview initializes — including when AI sidebar is hidden and no browser tab is open. Polls workbench command, posts `active-browser-changed` each tick. | Operational concern, not a plan conflict |
| 4 | `ToggleAnnotationMode` reuses `setSharedWithAgent`, which triggers the existing "Share with Agent?" consent dialog (agent automation framing). Sprint 67 is read-only chat context, narrower than full agent sharing. | Possible UX confusion, not a plan conflict |
| 5 | `getSummary()` ARIA snapshot in `'ai'` mode can run 30–80 k chars on content-heavy pages. 12 k char cap in `compactText` slices the **head**, which on most pages is `<header>`/`<nav>` boilerplate, not the content the user is asking about. | Operational concern — affects success criterion "content/layout questions" |
| 6 | Workbench changes (3 files) are not yet captured in a patch. Will conflict with upstream-sync if not patched. | Process gap |
| 7 | Implementation code landed before Phase 2→3 approval phrase. Per CLAUDE.md HARD rule, code should not have been written. | Process gap |

### Mitigations (resolved)

- **Finding 1 + 2 (annotation collapse):** D8 locked to Option B — see refactor checklist in **Phase 3 Refactor Work** below.
- **Finding 3 (polling cost):** Gate `setInterval` on `webviewView.visible`. Follow-up (not v1): replace polling with workbench-side `onDidChangeSharedWithAgent` / `onDidChangeAnnotationMode` event fan-out to extension; `RitemarkBrowserAnnotationContribution.subscribeToModel` already provides the hook surface.
- **Finding 4 (consent copy):** Reuse existing "Share with Agent?" prompt in v1; revisit if users flag confusion.
- **Finding 5 (head-truncation):** Accept for v1; document the limitation in sprint-end notes. Follow-up: prefer `<main>` landmark text when ARIA snapshot exceeds the cap.
- **Finding 6 (patch capture):** Capture workbench changes in `patches/vscode/007-ritemark-browser-context-bridge.patch` after D8 refactor lands. Verify unrelated submodule edits do not leak in.
- **Finding 7 (process):** Resolved by D9 — keep spike, refactor to D8, approve as one block.

---

### Phase 3 Refactor Work (drives the spike to D8 compliance)

Workbench (in `vscode/`):
- [ ] Add `annotationMode: boolean` field + `onDidChangeAnnotationMode` event to `IBrowserViewModel` (in `vscode/src/vs/workbench/contrib/browserView/common/browserView.ts`) and the concrete model implementation.
- [ ] Add new context key `CONTEXT_RITEMARK_BROWSER_ANNOTATION_MODE` distinct from `sharedWithAgent`. Rename current placeholder to reflect that it tracks annotation, not share.
- [ ] In `ritemarkBrowserContextFeature.ts`:
  - [ ] Change `dtoFromModel` to set `annotationMode: model.annotationMode` (not `model.sharedWithAgent`).
  - [ ] Change `ToggleAnnotationMode` action to call `model.setAnnotationMode(!model.annotationMode)` instead of `setSharedWithAgent`. Title: "Include Screenshot in Chat Context".
  - [ ] Update `RitemarkBrowserAnnotationContribution.subscribeToModel` to bind annotation context key from `model.annotationMode` + `onDidChangeAnnotationMode`.
  - [ ] Ensure `GetActiveSummary` still requires `sharedWithAgent` (summary needs share). `CaptureActiveViewport` requires `annotationMode` (screenshot is annotation-only).

Extension-host:
- [ ] `BrowserContextStore.buildTurnContext`: only call `CaptureActiveViewport` when `snapshot.annotationMode` (not `sharedWithAgent && annotationMode`).
- [ ] `UnifiedViewProvider`: gate `setInterval` poll on `webviewView.visible`; clear on `onDidChangeVisibility(false)`.
- [ ] Chip styling already differentiates annotation visually — confirm chip reflects the new independent `annotationMode` correctly.

Patch + invariants:
- [ ] Run `./scripts/create-patch.sh "ritemark-browser-context-bridge"` after refactor — captures workbench files only.
- [ ] `npm run compile` (extension) + workbench TS check.
- [ ] Rebuild `media/webview.js`.
- [ ] `./scripts/validate-qa.sh`.

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `BrowserContextStore` | Active browser metadata + page-context state, not URL-only |
| Workbench browser read bridge | Extension-accessible command/service for active BrowserView URL/title/summary/screenshot |
| Browser context compactor | Bounded DOM/text summarizer that strips noise and preserves useful visible semantics |
| Passive/annotation injection | Claude Code SDK and Codex receive compact context; annotation mode can include screenshot/viewport details |
| Browser context chip | Visible chip with URL/title, dismiss, and explicit high-context/annotation action |
| Smoke fixtures | Local long-anchor/spacing fixture and external-site checks to prove content-aware answers |

---

## Implementation Checklist

### Track 1: Browser state observer (`BrowserContextStore`)

- [ ] Create/extend `extensions/ritemark/src/browser/BrowserContextStore.ts`
  - Track `url`, `title`, `pageId`/browser identifier where available, `lastUpdatedAt`, `summary`, `screenshotRef`/attachment metadata, and `mode: 'normal' | 'annotation'`.
  - Session-only; no persistence of page content.
  - Safe default: no browser context when focus cannot be proven.
- [ ] Update `openInIntegratedBrowser()` to set URL immediately after successful open.
- [ ] Add active browser focus tracking via workbench tab/browser events; clear context on focus-away if reliable, otherwise document limitation and keep chip state explicit.
- [ ] Add extension-host logging/debug command for smoke verification.

### Track 2: Workbench browser read bridge

- [ ] Audit current BrowserView/playwright services under `vscode/src/vs/workbench/contrib/browserView/` and `vscode/src/vs/platform/browserView/`.
- [ ] Identify the smallest bridge from workbench BrowserView state to extension-host command(s), e.g.:
  - `ritemark.browser.getActiveContext` → URL/title/pageId/focus state
  - `ritemark.browser.getActiveSummary` → compact page/DOM summary
  - `ritemark.browser.captureActiveViewport` → screenshot bytes/URI/attachment handle
- [ ] Prefer reusing existing `IPlaywrightService.getSummary()` / browser read infrastructure if present. If not viable, add a focused Ritemark command around BrowserView `webContents.executeJavaScript()` with strict caps.
- [ ] Ensure local `file://` pages and external HTTPS pages are both readable when rendered in the integrated BrowserView.
- [ ] Ensure failures degrade gracefully: context chip can show URL-only/error state rather than breaking chat.

### Track 3: Context compactor / stripper

- [ ] Implement a bounded browser-context compactor in extension/workbench shared path as appropriate.
- [ ] Strip `<script>`, `<style>`, hidden nodes, repetitive nav/footer noise where possible.
- [ ] Preserve useful semantics: title, URL, headings, buttons, links, labels, inputs, selected/visible text, main landmarks, viewport dimensions/scroll.
- [ ] Enforce hard caps (initial target: summary under ~8–12k chars unless annotation mode explicitly requests more).
- [ ] Add tests/fixtures for:
  - long page with widely spaced anchors
  - page with obvious spacing/layout issue around title
  - forms/buttons/links
  - oversized DOM that must be capped

### Track 4: Passive + annotation injection (Claude + Codex only)

- [ ] **Claude Code SDK (`AgentRunner.ts`):** Inject compact browser context into the per-turn prompt/system append when chip is present. Include URL/title and compact page summary.
- [ ] **Codex (`UnifiedViewProvider.ts`):** Inject equivalent compact context into Codex turn instructions.
- [ ] Add annotation-mode payload path for richer context and screenshot attachment/description where supported by runtime. If screenshots cannot be attached directly to a runtime yet, include a clear screenshot path/reference plus viewport metadata and document limitation.
- [ ] **Ritemark Agent (`openAIClient.ts`):** No changes. Deprecated runtime must remain excluded.
- [ ] Add clear prompt framing: browser context is current-page evidence, may be truncated, and the agent should say when it needs annotation mode for visual/layout confidence.

### Track 5: Composer chip UI

- [ ] Extend AI sidebar store/message channel with browser context state: `currentBrowserContext`, `hideBrowserContext`, `browserContextMode`, setters.
- [ ] In `ChatInput.tsx`, render chip as `Browser: <title-or-url>` with:
  - X dismiss for this turn
  - explicit annotation/high-context toggle/action
  - visual state when DOM/screenshot will be shared
- [ ] Reset per-turn dismiss/annotation state after send.
- [ ] Preserve active-file chip and path chip behavior.
- [ ] Rebuild `extensions/ritemark/media/webview.js`.

---

## Test Plan

### Browser rendering baseline
- Open `https://example.com`, `https://ritemark.app`, and one locally served/local file HTML page in the integrated browser. Confirm they render in BrowserView, not in source editor.
- Confirm active browser tab URL/title are visible to `BrowserContextStore`.

### DOM/content context
- Open a local fixture with headings, buttons, links, forms, and long gaps between `#anchor` links. Ask Claude and Codex content questions that require page text/DOM, not just URL. Expect page-aware answers.
- Open a fixture with a deliberately narrow title spacing/layout issue. Ask “why is spacing around the title too narrow?” Expect answer to cite DOM/CSS evidence or say annotation mode is needed for visual confirmation.
- Open an oversized fixture. Confirm compacted context is capped and chat still works.

### Annotation mode
- Enable annotation mode for a turn. Confirm the outgoing payload includes richer page/viewport context and screenshot evidence/path where supported.
- Ask a viewport-specific/layout question. Expect the answer to use the annotation evidence.
- Confirm annotation mode resets after send and does not silently stay enabled.

### Privacy / consent / dismiss
- Dismiss browser chip via X; confirm no browser context is sent in that turn.
- With no browser tab focused, confirm chip absent and no context injected.
- Confirm high-context/annotation sharing is visibly indicated before send.

### Runtime scope
- Claude Code SDK: URL/title + compact DOM summary works.
- Codex: URL/title + compact DOM summary works.
- Ritemark Agent/OpenAI: unchanged and excluded.

---

## Pre-Commit Invariants to Watch

1. `vscode/extensions/ritemark` symlink intact — not affected by this sprint.
2. `media/webview.js` > 500 KB — **watch**: Track 5 adds webview UI; rebuild before staging.
3. `postcss.config.js` not empty — not affected.
4. No raw `@tailwind` in bundle — not affected, but rebuild ensures processed CSS.
5. Webview source staged → bundle must also be staged — **watch**: any `ChatInput.tsx` / ai-sidebar store change requires `media/webview.js` to be rebuilt and staged.
6. `ai-sidebar` sentinel in bundle — **watch**: Track 5 modifies `ChatInput.tsx` / ai-sidebar store; confirm the sentinel remains in the rebuilt bundle.
7. Extension TypeScript compiles — **watch**: Tracks 1 and 2 add/modify `.ts` files; run `npm run compile` before each commit.
8. Settings page integrity (400+ line guard) — no Settings UI work planned; guard should pass unchanged unless a kill-switch setting is added.

---

## Phase 3→4 Handoff Criteria

- All checklist items above checked off or explicitly documented as deferred with reason.
- `npm run compile` exits 0.
- Webview build exits 0 if chip UI changes landed.
- `./scripts/validate-qa.sh` exits 0.
- Dev instance smoke proves browser chip appears when a browser tab is active and is absent/dismissed when expected.
- Dev instance smoke proves Claude Code SDK and Codex can answer at least one DOM/content question from the active browser page.
- Dev instance smoke proves annotation/high-context mode attaches richer viewport/screenshot context or clearly documents runtime attachment limitation.
- Dev instance smoke proves external HTTPS site and workspace/local HTML file both work.
- Sprint notes document the workbench bridge shape, compaction caps, and any known focus-tracking limitations.

---

## Locked Decisions

### D1 — URL-only is not sufficient
Per Jarmo (2026-05-11): URL-level awareness has too little user value. Sprint 67 must include page-aware context: compact DOM/text summary and a path toward viewport/screenshot annotation.

### D2 — Runtime scope
Claude Code SDK and Codex are in scope. Ritemark Agent / OpenAI runtime is excluded because it is deprecated ghost code slated for removal.

### D3 — Browser context modes
- **Normal mode:** sends bounded URL/title + compact DOM/text summary when the browser chip is present.
- **Annotation mode:** explicit per-turn higher-context mode that can include richer visible-page context and screenshot evidence. This mirrors Codex’s normal-vs-annotation pattern conceptually without requiring all future automation features in this sprint.

### D4 — Workbench patch accepted
This sprint may require VS Code/Ritemark workbench changes. Extension-only release is no longer a constraint. If a BrowserView read bridge is needed, implement it and treat Sprint 67 as a full app sprint.

### D5 — Token and privacy boundaries are mandatory
No raw unbounded DOM dumps. Page context must be stripped/compacted/capped. Screenshot/annotation sharing must be explicit in the chip UI for the current turn.

### D6 — Multi-tab semantics
Context reflects the active/focused browser tab. If reliable active-tab detection is unavailable from extension-only APIs, the workbench bridge must expose enough state to avoid misleading the user.

### D7 — Title and navigation tracking
Title and in-page navigation tracking are desirable because DOM-aware answers depend on current page state. Implement if available through the bridge; otherwise document exact limitations and ensure the chip labels context freshness.

### D8 — Annotation mode shape (LOCKED: Option B — two-state)

Phase 2B audit revealed the pre-implementation collapses normal and annotation modes into a single `sharedWithAgent` toggle. Decision: **two-state model**.

- `sharedWithAgent` (existing upstream VS Code state) — gates the bounded URL/title + summary path. Already has consent prompt + don't-ask-again.
- `annotationMode` (new, Ritemark-owned, per-tab boolean on `IBrowserViewModel`) — when ON, current turn additionally attaches viewport screenshot and richer visible-page metadata.
- Both states are workbench-owned, per-tab. Chip mirrors state, does not own it.
- BrowserActionsToolbar exposes two distinct actions (keep upstream "Share with Agent"; add Ritemark "Include Screenshot in Chat Context").

Rationale:
- Aligns with D5 (token/privacy hard boundary) — a content-only question must not pay the screenshot cost.
- Aligns with D3 wording without rewriting it.
- Workbench surface is small: 1 extra boolean on the model, 1 extra context key, 1 extra toolbar action, distinct fields in `IRitemarkBrowserContextDto`.

### D8 — Addendum: auto-share trigger (LOCKED: chip-visibility = consent-prompt)

Phase 4 smoke discovered a UX gap with D8 Option B: the existing VS Code "Share with Agent" toggle (`browserEditorChatFeatures.ts:259`) is gated behind Copilot configs that Ritemark does not enable, so there is no built-in way for a user to enable `sharedWithAgent` alone. The camera (annotation) toggle cascades share + screenshot, which means asking the AI a content question requires also paying the screenshot cost.

Decision (Jarmo, 2026-05-11): **auto-trigger the existing `setSharedWithAgent` consent dialog the first time a browser tab becomes the active context per session**. Implementation:

- New workbench command `workbench.action.browser.ensureActiveBrowserShared` (added to `BrowserViewCommandId`). It calls `model.setSharedWithAgent(true)` only when `!model.sharedWithAgent`.
- Extension-side `BrowserContextStore` tracks `autoSharedPageIds: Set<string>`. After `refreshMetadata`, if the new snapshot has a `pageId` that is not yet in the set AND `sharedWithAgent === false`, the store calls the workbench command once (fire-and-forget).
- Upstream `setSharedWithAgent` already shows the "Share with Agent?" dialog with a "Don't ask again" preference. First consent → dialog appears. Subsequent tabs in the same session → silent if the user checked "Don't ask again", or dialog again if not.

Outcome:
- Default state for any active browser tab is now "shared = summary, no screenshot" after first consent.
- Camera toggle remains the explicit per-tab screenshot/annotation control.
- D5 (consent boundary) is satisfied — there is still an explicit Yes/No before content goes to the model.

### D9 — Pre-implementation spike disposition (LOCKED: keep + refactor)

Code landed before Phase 2→3 approval. Disposition:

- **Keep** the spike — extension-host, webview, workbench files. Reverting working code is waste.
- **Refactor** before approval to satisfy D8. The current `annotationMode: model.sharedWithAgent` line is incorrect and must change.
- Treat the refactor as the first Phase-3 work item. Approval phrase covers spike + refactor as one block.
- All pre-implemented files (extension-host + workbench) audited in Phase 2B above; no surprises beyond the D8 collapse.

---

## Follow-up Work (not Sprint 67 unless discovered cheap)

- Full AI browser control (click/type/navigate) after read/annotation context is stable.
- Persistent browser session memory/history.
- Fine-grained Settings page for browser context defaults if chip-level controls prove insufficient.
- Windows-specific end-to-end GUI smoke after macOS path is validated.
- **Sprint 65 race-condition follow-up (discovered 2026-05-11 during Sprint 67 smoke):** `BrowserHtmlOpenRedirector` race when (a) HTML file opened via cold-start CLI/Finder before extension activates, or (b) HTML file open + folder opened on top. Both leave the editor stuck "loading" with blank content area. Workaround: close the HTML tab and reopen via File → Open or by re-clicking the file. Suggested fixes (any one suffices): (i) eager retry in `setTimeout` fallback using `window.onDidChangeVisibleTextEditors`; (ii) register `*.html` editor association with BrowserEditor at `default` priority so VS Code routes natively; (iii) make `redirectIfNeeded` resilient to `vscode.window.visibleTextEditors` returning empty during activation.

---

## Status

**Track:** Full 6-phase
**Current Phase:** Phase 4 complete — smoke passed; ready for Phase 5 (sprint-end QA + commit) and Phase 6 (PR).
**Approval Required:** Sprint-end commit + PR.

### Phase 4 smoke results (2026-05-11)

- ✅ Dev VS Code launched cleanly with Node v22.21.1 arm64 + `unset ELECTRON_RUN_AS_NODE`
- ✅ Workbench bridge live: `getActiveContext`, `getActiveSummary`, `captureActiveViewport`, `toggleAnnotationMode`, `getAnnotationMode` all callable via `vscode.commands.executeCommand`
- ✅ Camera-icon toolbar action visible in `BrowserActionsToolbar` next to DevTools
- ✅ "Share with Agent?" consent prompt triggered on first annotation toggle (existing VS Code consent dialog, reused)
- ✅ Browser chip rendered in composer with globe icon; chip flipped from grey → indigo with "· Annotation" suffix on toggle (note: required adding `'globe': Globe` to `webview/src/components/ui/Icon.tsx` — pre-implementation used an unregistered icon name causing React error #130)
- ✅ Claude content question answered correctly using compact ARIA summary + viewport screenshot ("The in-app browser is showing the Sprint 65 test fixture ... Header ... Navigation checks card: Five links ... Status line: 'loaded at 15:57:23' ... Large grey spacer ...")
- ✅ Local `file://` fixture render works; external HTTPS works (verified previously in Sprint 65)
- ✅ Auto-share addendum (D8): after window reload, opening `https://ritemark.app/en/` automatically triggered "Share with Agent?" consent prompt; on Allow, Claude answered a page question with rich content (hero, feature pills, tabs, marketing section) using only the summary path — annotation/screenshot toggle NOT required for content-aware answers
- ✅ Editor `npm run compile` green
- ✅ Workbench `compile-check-ts-native` green
- ✅ `./scripts/validate-qa.sh` green (rerun after `Icon.tsx` + `webview.js` rebuild)
- ⚠ Sprint 65 redirector race discovered (see Follow-up Work) — does not block Sprint 67

## Approval

- [x] Jarmo approved sprint plan including D8 (Option B two-state) and D9 (keep + refactor spike) — 2026-05-11
- [x] Jarmo confirmed smoke passes — 2026-05-11
- [ ] Sprint-end commit + PR
