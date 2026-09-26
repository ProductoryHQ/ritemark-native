# Release Plan — v1.12.0 Publish to Google Docs + Everyday UX

**Status:** **Feature complete (2026-09-25).** Every sprint is merged: Sprint 124 (PR #345), Sprint 125 (PR #350) and Sprint 127 (PRs #347 and #349), plus the PDF-search follow-up #344 (PR #348), which Jarmo took into this release. Main is frozen for the release. What remains is the release candidate: its build, Gate 1, Gate 2 and the checks only a candidate can prove, listed under *Release Readiness*. The history below records how the release got here.<br>
**History:** Mapped. Sprint 121 was absorbed into v1.11.0 Sprint 117 on 2026-09-14. **Sprints 118 and 119 moved here from v1.11.0 on 2026-09-15**, packages intact, when that release was re-cut around Microsoft Store certification. Eight sprints now stand: 118, 119, 120, 122–126. **Sprint 119 is merged** (2026-09-22, PR #326): Google Docs publishing, with its OAuth app in production. **Sprint 118 is merged** (2026-09-22, PR #330): direct recording in Transcribe; its signed-build microphone and Windows capture checks join the release gate. **Sprint 120 is merged** (2026-09-22, PR #331): a typed number only starts a list up to 99. **Sprint 126 is merged** (2026-09-22, PR #336): Shift+End selects the line rather than the rest of the document. **Sprint 122 is merged** (2026-09-23, PR #339): the current conversation is named with a ⋮ menu, the composer is resized from its top edge, and every chat link opens, reveals, locates or explains. **Sprint 123 is merged** (2026-09-23, PR #342): transcript search and a tab row that shrinks to fit, with no VS Code patch. **Sprint 124 is in review** (2026-09-24): Word's pages and page numbers, one toolbar for Word and PDF, plain refusals, and the Word preview in its own bundle; it is shell-tier because its Office-preview bundle must be known to the shell build. Sprint 125 has not started. **Sprint 127 is in development** (2026-09-24). Decision D4 changed its scope the same day: v1.12.0 bundles Claude Code 2.1.281, so Opus 5.5 arrives natively, and every release checks Anthropic's model catalog. The planned feed publisher was withdrawn. The bump is shell-tier, which this release already is.<br>
**Target:** v1.12.0<br>
**GitHub milestone:** [v1.12.0](https://github.com/ProductoryHQ/ritemark-native/milestone/10)<br>
**Release type:** Full app distribution, provisionally shell-tier because Sprint 123 is expected to change integrated-browser/editor tab labels. Downgrade to extension-only only if Phase 0 proves no VS Code patch or shell source changes are required. *(2026-09-23: Sprint 123 Phase 0 found no patch and no shell source change is needed, so Sprint 123 no longer forces the shell tier; the release's tier is set at release time from everything merged.)* **Set 2026-09-25: shell-tier.** Three merged sprints change shell-tier paths between v1.11.0 and main. Sprint 119 changes `scripts/build-prod.sh`, `scripts/build-prod-windows.sh`, `scripts/google-oauth-release-env.sh` and both build workflows, which compile in the Google OAuth client. Sprint 124 changes `scripts/stage-extension-for-shell-build.sh`, so the shell build carries `office-preview.js`. Sprint 127 changes `extensions/ritemark/binaries/agents/manifest.json`, the bundled Claude Code 2.1.281. No VS Code patch and no submodule change.<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-09-12<br>
**Source:** Jarmo's hands-on UX friction log collected while editing, transcribing, and working with agent conversations on 2026-09-12, expanded with Office-preview requirements on 2026-09-13, and joined on 2026-09-15 by Sprints 118 and 119 from the v1.11.0 plan — the latter originating in a 2026-09-07 voice memo about publishing teaching material to Google Docs.

## Release Thesis

A Ritemark author can finish a markdown document and push it to Google Docs in one action — connect a Google account once in Settings, optionally pick a Docs template, then **Create Google Docs** from the toolbar; the created Doc identity is remembered so every later **Sync** updates the same Doc instead of creating a new one. The Transcriber gains direct in-app recording alongside file upload. Both arrived from v1.11.0 on 2026-09-15 and are this release’s headline work.

Around them, Ritemark should stay out of the user's way during ordinary long-form work. v1.12.0 removes a focused set of recurring paper cuts: prose no longer turns into a list against the author's intent, comments are comfortable to write and hand to an agent, the active agent conversation and its links are predictable, long transcripts are searchable, crowded tabs remain distinguishable, Word documents are substantially easier to inspect, and modern PowerPoint files open in a useful local preview.

This is a workflow-coherence release, not a collection of unrelated cosmetic tweaks. Every included item must reduce uncertainty or friction in one of five repeated actions: write, comment, work with an agent, find the active material again, or inspect the documents that arrive in everyday work.

## User-Facing Headlines

1. **Publish markdown to Google Docs** — connect your Google account in Settings, choose an optional Docs template, create the Doc from the toolbar, and keep it updated with one Sync action. One-way push: Ritemark stays the source of truth.
2. **Record directly in Transcribe** — a Record button next to "Add recording"; the recording becomes a normal library item and goes through the same engine/consent/transcript pipeline as an uploaded file.
3. **The editor respects what you type** — a year such as `2026. a` stays prose while deliberate numbered-list input continues to work.
4. **Comments are comfortable and accountable** — delivered ahead of this release by v1.11.0 Sprint 117; v1.12.0 builds on that vocabulary.
5. **Agent conversations are easier to understand and operate** — the active conversation has a title and actions, long prompts get more room, and project/file/web links behave according to their destination.
6. **Long work stays findable** — search inside a transcription and distinguish open documents and web pages in a crowded tab row.
7. **Office documents become first-class reading material** — Word gains a PDF-like page-viewing experience and modern PowerPoint files gain a secure local preview.

## Product Contract

1. **Never reinterpret obvious prose silently.** Editor shortcuts may accelerate explicit structure, but plausible prose such as a year followed by an abbreviation must remain prose.
2. **Never hide an AI destination.** Before a comment task is sent, the assigned runtime and destination conversation are visible; completion remains connected to that same conversation (implemented by v1.11.0 Sprint 117).
3. **Never let controls cover the user's content.** Comment callouts and resizable composers preserve readable text and reachable actions at supported widths.
4. **Never let a supported link fail silently.** Project files, other local paths, and web URLs have distinct, safe actions and clear failure feedback.
5. **Never overstate document fidelity or move local files silently.** Office previews remain local by default, expose unsupported content honestly, and always offer a safe external-open fallback.

## Release Sequencing and Cross-Release Dependency

Sprints 118 and 119 arrived from v1.11.0 on 2026-09-15. Both have complete SDD packages — spec, scenarios, technical plan, tasks, current-state audits, design documents, and for Sprint 119 an official-source Google API/OAuth contract audit — and both still owe their own scope decisions and kickoffs. Sprint 119 additionally carries external blockers that are not code: Google Cloud project ownership, OAuth consent publication and verification, release client configuration, and dedicated test accounts. Those should start early, because they run on Google’s clock rather than ours.

Sprint 119 also depends on two pieces of work outside this repository, added on 2026-09-18 when Ritemark was given its own legal pages. Sprints are repo-scoped, so they are tracked here as external dependencies rather than folded into the sprint:

| Dependency | Repository | What it delivers | Needed before |
|---|---|---|---|
| Ritemark privacy policy and terms | `ritemark-web` (ritemark.app) | New EN + ET privacy and terms pages. The content moves out of Productory's policy, Productory Services OÜ stays the provider, and a Google Docs section is added from Sprint 119 Phase 0 facts | Sprint 119 R11 switches the in-app links; the Google OAuth consent screen is published |
| Productory legal update | `productory-2026` (productory.ai) | Productory's privacy policy and terms keep a short Ritemark reference and a link to ritemark.app; the existing URLs keep resolving for installed apps (≤ 1.11) | The Ritemark pages are live |

The Microsoft Store listing's privacy and terms URLs move to ritemark.app once the pages are live; that is a Partner Center change Jarmo owns.

Sprint 121 was absorbed into v1.11.0 Sprint 117 on 2026-09-14, so v1.12.0 carries no in-flight cross-release dependency. Sprint 122 depends on the merged Sprint 117: the comment/agent interaction vocabulary, the visible-destination contract, and the resizable composer primitive. Sprint 122 must not add a second dispatch path or weaken the invariant that every conversation-scoped message carries a canonical `conversationId`.

## Scope Envelope

### In scope

- Publishing a markdown document to Google Docs: account connect in Settings, optional template selection, toolbar **Create Google Docs** and **Sync**, and a remembered Doc identity per markdown file. One-way push.
- Direct audio recording in the Transcribe panel, feeding the existing path-driven transcription pipeline unchanged.
- Ordered-list input intent: prevent plausible year prefixes from triggering a numbered list while preserving deliberate list creation and Markdown round trips.
- Active agent conversation header with a clear title and actions consistent with History.
- Agent composer vertical resize without hiding Send, attachment, runtime, model, autonomy, or effort controls.
- Destination-aware agent-chat links for project files, other local filesystem targets, and web URLs, including appropriate reveal/open/copy actions and clear error states.
- In-transcript text search with match count, previous/next navigation, active result highlighting, and keyboard access.
- Compact, distinguishable file and browser tab labels; browser labels do not append a redundant full URL to the primary title.
- Page-oriented Word preview with improved measured fidelity and PDF-like navigation, zoom, fit, search, loading, refresh, and fallback behavior.
- Secure local read-only preview for modern `.pptx` files with thumbnails, navigation, zoom, fit, search where supported, and external-open fallback.
- An Office-preview-specific webview asset boundary so ordinary editor views do not load large document renderers.
- Automated regression coverage, focused dev-mode/manual scenarios, release notes, and architecture documentation where the architecture gate applies.

### Out of scope / explicitly deferred

- Google Docs publishing, direct Transcribe recording, runtime/model refreshes, and the underlying comment-task completion reply; those remain in the v1.11.0 plan.
- Comment composer resize, `@` agent picker, collapsed-comment layout, and the open-conversation handoff (the task goes to the conversation open in the AI sidebar, named on the Send surface, no confirmation step) — delivered by v1.11.0 Sprint 117 (#281).
- Multi-turn comment threads, comment collaboration, or a new persisted comment schema.
- Workspace-wide or cross-recording transcript search.
- A complete workbench tab-system redesign, tab groups, browser Favorites/Recents, or per-conversation browser instances.
- Executable `command:`, `vscode:`, `javascript:`, or other privileged link schemes from agent output.
- TipTap 2→3 migration and broad Markdown list serialization cleanup beyond the year/input-intent defect.
- New agent runtimes, model IDs, approval message types, or runtime-specific browser/link implementations.
- DOCX/PPTX editing, legacy `.doc`/`.ppt`, complete Office animation or macro support, or a promise of universal pixel-identical Microsoft Office rendering.
- Uploading Office files to a cloud conversion service by default, or bundling/requiring Microsoft Office or LibreOffice.

## Sprint Map

| Sprint | Working name | User outcome | GitHub issue | Dependency | Status |
|---|---|---|---|---|---|
| [Sprint 118](./sprint-118-transcribe-recording/sprint-plan.md) | Transcriber direct recording | Record straight into the Transcribe panel instead of only uploading a file | [#328](https://github.com/ProductoryHQ/ritemark-native/issues/328) | none | Merged 2026-09-22 (PR #330). Signed-build microphone and Windows capture carried to the release gate |
| [Sprint 119](./sprint-119-google-docs-publishing/sprint-plan.md) | Publish to Google Docs | Push a finished markdown document to a Google Doc and keep it updated; Ritemark gets its own legal pages (R11) | [#319](https://github.com/ProductoryHQ/ritemark-native/issues/319) | External Google Cloud/OAuth setup; Ritemark legal pages (`ritemark-web`) and Productory legal update (`productory-2026`) | Merged 2026-09-22 (PR #326); hardening tests carried to [#325](https://github.com/ProductoryHQ/ritemark-native/issues/325) |
| [Sprint 120](./sprint-120-editor-input-intent/sprint-plan.md) | Editor input intent | Years and similar prose stay prose; deliberate numbered lists still work | [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280) | none | Merged 2026-09-22 (PR #331) |
| Sprint 121 | Comment ergonomics and visible handoff | Comments are easy to compose and review, and AI assignment has a visible destination | [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) | — | Absorbed into v1.11.0 Sprint 117 (2026-09-14) |
| [Sprint 122](./sprint-122-conversation-clarity/sprint-plan.md) | Agent conversation clarity | Active conversation, long-prompt composer, and destination-aware links behave predictably | [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282) | v1.11.0 Sprint 117 merged (interaction vocabulary, composer primitive); existing durable conversation APIs | Merged 2026-09-23 (PR #339) |
| [Sprint 123](./sprint-123-findability/sprint-plan.md) | Findability across long work | Users can search transcripts and distinguish crowded tabs | [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283) | none; can run after Sprint 120 while 121/122 follow their dependency | Merged 2026-09-23 (PR #342) |
| [Sprint 124](./sprint-124-word-preview-fidelity/sprint-plan.md) | Word preview fidelity | Word documents get PDF-like page viewing and measured fidelity improvements | [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284) | none; establishes the Office-preview asset boundary | Merged 2026-09-24 (PR #345). Follow-up [#344](https://github.com/ProductoryHQ/ritemark-native/issues/344), PDF search, merged 2026-09-25 (PR #348) |
| [Sprint 125](./sprint-125-powerpoint-preview/sprint-plan.md) | PowerPoint preview | Modern `.pptx` files open locally in a secure read-only slide preview | [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285) | Sprint 124 viewer shell and asset boundary | Merged 2026-09-25 (PR #350) |
| [Sprint 126](./sprint-126-editor-selection-keys/sprint-plan.md) | Editor selection keys | Shift+End selects the line you are on, and can never reach past the current block | [#332](https://github.com/ProductoryHQ/ritemark-native/issues/332) | none | Merged 2026-09-22 (PR #336) |
| [Sprint 127](./sprint-127-day-zero-models/sprint-plan.md) | New Anthropic models on day zero | Opus 5.5 in the Claude Code agent via the bundled Claude Code 2.1.281, and a release check that keeps Claude Code current (D4) | [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) | none; the Claude Code bump is shell-tier, like this release | Merged 2026-09-25 (PR #347, review fixes PR #349). #343 stays open until its candidate checks pass |

Headline order: 119 first, since its external OAuth blockers gate it and nothing else waits on it; 118 has no hard interdependency with 119, and the order between them is Jarmo’s call. Mainline UX order: 120 → 122, with Sprint 123 as an independent findability track after Sprint 120. Office-preview order: 124 → 125. The Office track may proceed independently once release foundations are stable, but Sprint 125 does not start before Sprint 124 has established and validated the preview asset boundary. Sprint 126 was added on 2026-09-22 out of that order, as an unplanned data-loss fix. The release remains feature-incomplete until all eight sprints are merged or explicitly deferred. Sprint 127 was added on 2026-09-24, from Jarmo's question about why new Anthropic models do not appear, and depends on no other sprint. *(D4, 2026-09-24.)* It ships with this release, because the Claude Code bump is shell-tier. The feed publisher was withdrawn.

## Sprint Outcomes and Boundaries

### Sprint 120 — Editor input intent

**Goal:** remove the false numbered-list conversion without weakening real list authoring.

**Required outcomes:**

- Typing `2026. a` at the start of a paragraph does not transform the paragraph into an ordered list.
- Typing an intentional short marker such as `1. Item` still creates an ordered list.
- Pasted and reopened Markdown lists keep their original semantics.
- Undo/redo and save/reopen behavior are covered, not only the first keystroke.

**Boundary:** Phase 0 must identify whether the behavior comes from TipTap's ordered-list input rule, an editor wrapper, or Markdown rehydration. The fix belongs at the narrowest correct layer and must not special-case one literal year.

### Sprint 126 — Editor selection keys

**Goal:** stop a selection keystroke from reaching content the person is not looking at.

**Required outcomes:**

- `Shift+End` and `Shift+Home` extend to the end and start of the current visual line, matching plain `End`/`Home`.
- Neither can extend past the paragraph, list item or code block holding the cursor.
- Plain `Home`/`End` and the document-boundary `Shift+Mod+Home`/`End` are unchanged.

**Boundary:** the typing and selection layer only. Nothing in the Markdown load or save path changes. Added unplanned on 2026-09-22 after a data-loss report; not part of the original v1.12.0 map.

### Sprint 121 — Comment ergonomics and visible handoff

Absorbed into v1.11.0 Sprint 117 on 2026-09-14. Its outcomes now live in [`../v1.11.0/sprint-117-comment-agent-honesty/spec.md`](../v1.11.0/sprint-117-comment-agent-honesty/spec.md) (R4, R6, R7, and the R10 ergonomics requirement Sprint 117 Phase 0 adds) and close with issue #281 under milestone v1.11.0.

### Sprint 122 — Agent conversation clarity

**Goal:** make the current conversation and the objects referenced inside it unambiguous.

**Required outcomes:**

- A persistent header shows the active conversation title and status without competing with the transcript.
- Header actions reuse the same rename, pin/unpin, and safe delete/archive behavior and terminology as History.
- Long titles truncate visually while their full accessible name remains available.
- The prompt composer supports bounded vertical resizing and preserves reachable controls at minimum supported sidebar width.
- Chat links are classified through one policy as project file, other local file/folder, web URL, or unsupported.
- Ordinary click performs the safest likely action; a context menu offers destination-specific secondary actions such as Reveal in project, Locate in Finder, Open externally, and Copy.
- Missing/inaccessible targets and unsupported schemes produce explicit feedback; no supported link appears inert.

**Boundary:** extend the existing `chatLinks`/host bridge policy and durable conversation actions. Do not enable privileged URL schemes or duplicate filesystem access in the sandboxed webview. Reuse the resizable composer primitive from Sprint 117.

### Sprint 123 — Findability across long work

**Goal:** keep content and open surfaces identifiable when the work becomes large.

**Required outcomes:**

- Transcript search supports case-insensitive text matching, a result count, previous/next navigation, active-match highlighting, Enter/Shift+Enter navigation, Escape/clear, and no-result feedback.
- Search remains local to the loaded transcript and does not mutate transcript/session data.
- Choosing a result scrolls it into view and deliberately pauses automatic playback-follow until the user resumes it.
- Browser tab primary labels use the page title without appending the full URL.
- Long file/page titles use middle- or end-truncation appropriate to the content; full title/URL remains available through hover or the open-tabs list.
- Active-tab identity, close affordances, and keyboard navigation remain intact across supported platforms.

**Boundary:** Phase 0 must identify whether compact tab labeling can be implemented in the integrated-browser editor input or requires a VS Code patch. Any patch makes the planned full-app release tier final.

### Sprint 124 — Word preview fidelity

**Goal:** make Word documents feel like deliberate page-based reading surfaces rather than best-effort HTML output.

**Required outcomes:**

- A representative DOCX corpus has Word- or LibreOffice-rendered PDF/image ground truth before renderer changes are accepted.
- The current `docx-preview` 0.3.7 implementation is measured against a 0.4.0 spike; upgrade only if the visual and regression evidence supports it.
- Common pagination, fonts, headers/footers, lists, tables, images, footnotes, and section behavior improve measurably.
- The viewer gains page position, zoom, fit-width/fit-page, text search, loading, refresh, actionable errors, and Open externally.
- DOCX renderer code leaves the shared editor bundle for an Office-preview-specific entry or equivalent lazy asset boundary.
- Expected fidelity limits are documented; no unsupported document silently appears complete.

**Boundary:** “PDF-like” describes the viewer experience and measured representative fidelity, not universal pixel parity with Microsoft Word. DOCX editing, legacy `.doc`, default cloud conversion, and bundling or requiring LibreOffice are excluded. See [Office preview analysis](research/office-preview-analysis.md).

### Sprint 125 — PowerPoint preview

**Goal:** let users inspect modern PowerPoint presentations locally without leaving Ritemark.

**Required outcomes:**

- Phase 0 audits and visually tests the exact candidate `@aiden0z/pptx-renderer@1.2.4` before dependency approval.
- A custom read-only `.pptx` document/provider pipeline uses a dedicated PPTX asset rather than the shared editor bundle.
- The viewer provides thumbnails, current/total slide position, previous/next and keyboard navigation, zoom, fit, search where supported, loading, refresh, actionable errors, and Open externally.
- Common text, images, tables, shapes, charts, groups, and theme behavior are measured against PowerPoint- or LibreOffice-exported ground truth.
- Malformed/oversized ZIPs, unsafe links/media, object URLs, large buffers, and renderer disposal are handled explicitly.
- A default-on experimental `powerpoint-preview` feature flag provides a real kill switch with a truthful fallback.

**Boundary:** modern `.pptx` read-only preview only. Legacy `.ppt`, editing, macros, full animation/transition playback, slideshow parity, and default cloud conversion are excluded. See [Office preview analysis](research/office-preview-analysis.md).

### Sprint 127 — New Anthropic models on day zero

**Goal:** a newly released Anthropic model can be chosen in the Claude Code agent by every user within minutes, with no Claude Code CLI update and no Ritemark update.

**Required outcomes:**

- Existence, runnability and presentation have separate authorities (Jarmo, 2026-09-24). The bundled CLI's model list stops deciding which models exist for subscription users.
- ~~A publisher in `ritemark-public` adds each new Anthropic model to the feed automatically and immediately, after a canary on the pinned CLI. It only appends; it never changes defaults.~~ Withdrawn by D4 (2026-09-24).
- *(D4)* v1.12.0 bundles Claude Code 2.1.281 with Agent SDK 0.3.281, and Opus 5.5 joins the bundled lineup. Anthropic's catalog requires Claude Code 2.1.280 or newer for Opus 5.5.
- *(D4)* `npm run check:anthropic-models` checks Anthropic's Claude Code model catalog before every release. It raises an alert when the catalog is unreadable, has changed, or lists a model that the bundled Claude Code is too old for.
- The client merges feed and bundled rows per row, and declares published models to the bundled CLI through the SDK's `settings.modelPicker`, with an output budget.
- The client uses `/v1/models` only when the runtime uses that API key, and checks the feed every 10 minutes with conditional requests.
- A model the user cannot have is named, never silently swapped.

**Boundary:** Anthropic models only. After D4 the tier is shell, because `binaries/agents/manifest.json` changes; it ships inside this full release. Updating the bundled CLI between shell releases, automatic defaults, retirements and behavior profiles are out of scope. See [sprint plan](./sprint-127-day-zero-models/sprint-plan.md) and [model visibility audit](./sprint-127-day-zero-models/research/model-visibility-audit.md).

## GitHub Issue Intake

| Observation | Decision | Sprint / issue | Notes |
|---|---|---|---|
| A year such as `2026. a` becomes a numbered list | Include | Sprint 120 / [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280) | Correctness defect, not cosmetic polish |
| Send-to-AI destination is unclear | Moved to v1.11.0 | v1.11.0 Sprint 117 / [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) | Absorbed 2026-09-14 |
| Search inside a transcription | Include | Sprint 123 / [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283) | Local loaded-transcript search only |
| Agent prompt composer should resize | Include | Sprint 122 / [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282) | Bounded height; controls remain visible |
| Agent-chat links need destination-aware behavior | Include | Sprint 122 / [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282) | Project/local/web taxonomy; safe schemes only |
| Open-tab names do not fit | Include | Sprint 123 / [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283) | Remove redundant browser URL from primary label |
| Comment composer should resize and `@` should open agent choices | Moved to v1.11.0 | v1.11.0 Sprint 117 / [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) | Absorbed 2026-09-14 |
| Collapsed comments cover document text | Moved to v1.11.0 | v1.11.0 Sprint 117 / [#281](https://github.com/ProductoryHQ/ritemark-native/issues/281) | Absorbed 2026-09-14 |
| Active agent conversation needs a title header and actions | Include | Sprint 122 / [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282) | Reuse History actions and host-owned title |
| Word preview should approach the PDF reading experience | Include as separate sprint | Sprint 124 / [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284) | Improve measured fidelity and viewer UX; do not promise universal Word parity |
| PowerPoint is not currently supported | Include as separate sprint | Sprint 125 / [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285) | Local `.pptx` preview; renderer accepted only after spike |

## Feature-Complete Definition

- [x] Sprint 118 merged; its issue (created at kickoff) closed or explicitly deferred with evidence. *(merged 2026-09-22 as `e9094517`, PR #330; #328 closed)*
- [ ] Sprint 118 release-candidate checks, which only a candidate can prove:
  - On the signed arm64 DMG: the first Record asks macOS for microphone access under the Ritemark name, a short recording with speech is saved, plays back, and transcribes on-device. The dev build's permission is tied to a different bundle ID (Phase 0 S6).
  - On the Windows installer: the same, plus **Microphone Settings** opens the Windows privacy page after a denial. This is the first native Windows run of the capture path.
  - A spoken recording's level is checked on both: the capture is unprocessed (no automatic gain), and Jarmo's dev-build test peaked around −19 dBFS.
- [x] Sprint 119 merged; #319 closed or explicitly deferred with evidence; the Google OAuth app is published and verified for public use; the Ritemark legal pages are live and the in-app links point to them. *(2026-09-21/22: OAuth app In production with verified branding; legal pages live, including the approved Google Docs section, ritemark-web #152; in-app links switched. Merged 2026-09-22 as `b9f4717d`, PR #326; #319 closed)*
- [ ] Sprint 119 release-candidate checks, which only a candidate can prove:
  - Both CI build workflows compile in the Google OAuth client from the `RITEMARK_GOOGLE_CLIENT_ID`/`_SECRET` repository secrets, and pass `scripts/check-google-oauth-build.mjs`.
  - `build-prod.sh` does the same from `~/.config/ritemark/release.env`.
  - On the signed arm64 DMG, the Intel DMG and the Windows installer: Settings → Google Docs → Connect shows "Ritemark" on Google's consent screen, then Create (with a local image) and Sync work. Windows is the first native run of the loopback OAuth flow.
  - Jarmo changes the Microsoft Store listing's privacy and terms URLs to ritemark.app in Partner Center, recorded in `docs/microsoft-store-submission/LEGAL-AND-URLS.md`.
  - After release: delete the disposable canary OAuth client and the Phase 0 / RunDev test Docs, each with Jarmo's go-ahead.
- [x] Sprint 120 merged; #280 closed or explicitly deferred with evidence. *(merged 2026-09-22 as `d97712c7`; #280 closed)*
- [x] Sprint 121 absorbed into v1.11.0 Sprint 117; #281 closes with that sprint. *(#281 closed; shipped in v1.11.0)*
- [x] Sprint 122 merged; #282 closed or explicitly deferred with evidence. *(merged 2026-09-23 as `f622c646`, PR #339; #282 closed)*
- [x] Sprint 123 merged; #283 closed or explicitly deferred with evidence. *(merged 2026-09-23 as `4070ffc6`, PR #342; #283 closed)*
- [x] Sprint 124 merged; #284 closed or explicitly deferred with evidence. *(merged 2026-09-24 as `9940d086`; #284 closed)*
- [x] Sprint 125 merged; #285 closed or explicitly deferred with evidence. *(merged 2026-09-25 as `dd5cf9ba`, PR #350; #285 closed)*
- [x] Follow-up #344 (PDF search) merged. *(merged 2026-09-25 as `10ce2628`, PR #348)*
- [x] Sprint 126 merged; #332 closed or explicitly deferred with evidence. *(merged 2026-09-22 as `032437c8`; #332 closed)*
- [ ] Sprint 127 merged; its issue closed or explicitly deferred with evidence; *(Revised by D4.)* `npm run check:anthropic-models` passes on the release source. The candidate bundles Claude Code 2.1.281 (runtime matrix plus `verify-agent-runtimes.sh` on the release Mac). On a release candidate, a subscription account sees and runs Opus 5.5. *(Merged 2026-09-25 as `b10b0575`, PR #347, with review fixes as `be201eca`, PR #349. The model check, the runtime verification and the Opus 5.5 run are candidate checks; #343 closes after them.)*
- [x] v1.11.0 Sprint 117 is merged before Sprint 122 starts. *(Sprint 122 branched from main `04231de2` on 2026-09-23)*
- [ ] Every new or changed webview↔host message is typed/validated at its boundary.
- [x] `docs/development/architecture.md` is updated for any structural message, subsystem, feature-flag, or shell-patch change; its date is not older than the relevant sprint branch. *(2026-09-25: Sprints 124, 125 and 127 and the PDF search follow-up)*
- [ ] Cross-platform tab-label behavior is verified in dev/RC evidence where the shell is involved.
- [ ] Office preview renderers are isolated from the ordinary editor bundle and the resulting packaged assets are verified. *(Isolated: Word and PowerPoint load `office-preview.js`, and `webview.js` carries neither renderer. The packaged assets are checked on the candidate.)*
- [ ] Word and PowerPoint visual fixture corpora pass their accepted baselines on macOS arm64/x64 and Windows.
- [ ] Automated editor, comment, conversation, link, transcript-search, tab-label, and Office-preview regressions pass.
- [ ] `./scripts/validate-qa.sh` passes at each readiness handoff.
- [x] `docs/CHANGELOG.md` and `docs/releases/v1.12.0/release-notes.md` cover every shipped user-facing behavior. *(2026-09-25 docs freeze: PDF search, strikethrough and literal tildes, and the model-list check were added to the notes)*
- [ ] `docs/releases/v1.12.0/TEST-CHECKLIST.md` includes the release canary matrix.
- [x] The release tracker records sprint branches, PRs, issue outcomes, QA state, and release-note state. *(2026-09-25 docs freeze)*

## Sprint / Issue / PR Tracker

| Sprint | Planned branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| Sprint 118 | `sprint-118-transcribe-recording` | [#330](https://github.com/ProductoryHQ/ritemark-native/pull/330) | #328 (closed) | **Merged 2026-09-22** as `e9094517`; RunDev-validated with a real microphone and a one-hour synthetic run | `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 119 | `sprint-119-google-docs-publishing` | [#326](https://github.com/ProductoryHQ/ritemark-native/pull/326) | #319 (closed); follow-ups #325 | **Merged 2026-09-22** as `b9f4717d`; RunDev-validated with real Google APIs and the production client | `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 120 | `sprint-120-editor-input-intent` | [#331](https://github.com/ProductoryHQ/ritemark-native/pull/331) | #280 (closed) | **Merged 2026-09-22** as `d97712c7`; RunDev-validated in a dev build, evidence in the sprint's `qa-evidence.md` | full `npm test` + webview typecheck green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 121 | `sprint-121-comment-ergonomics` | — | #281 | absorbed into v1.11.0 Sprint 117 | n/a | n/a |
| Sprint 122 | `sprint-122-conversation-clarity` | [#339](https://github.com/ProductoryHQ/ritemark-native/pull/339) | #282 (closed) | **Merged 2026-09-23** as `f622c646`; RunDev-validated in a dev build, evidence in the sprint's `qa-evidence.md` | full `npm test` + both typechecks green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 123 | `sprint-123-findability` | [#342](https://github.com/ProductoryHQ/ritemark-native/pull/342) | #283 (closed) | **Merged 2026-09-23** as `4070ffc6`; RunDev-validated in a dev build, evidence in the sprint's `qa-evidence.md` | full `npm test` green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 124 | `sprint-124-word-preview-fidelity` | [#345](https://github.com/ProductoryHQ/ritemark-native/pull/345) | #284 (closed); follow-up #344 (PDF search) | **Merged 2026-09-24** as `9940d086`; RunDev-validated in a dev build, evidence in the sprint's `qa-evidence.md` | full `npm test` green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| #344 (Sprint 124 follow-up) | `claude/issue-344-pdf-search` | [#348](https://github.com/ProductoryHQ/ritemark-native/pull/348) | #344 | **Merged 2026-09-25** as `10ce2628`; dev-build validated on a 29-page PDF (highlights drawn, stepping, wrap, no scroll jump, no text-layer redraw loop) | full `npm test` + both typechecks green; macOS x64 and Windows runtime CI green | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 125 | `sprint-125-powerpoint-preview` | [#350](https://github.com/ProductoryHQ/ritemark-native/pull/350) | #285 (closed) | **Merged 2026-09-25** as `dd5cf9ba`; RunDev-validated in a dev build, evidence in the sprint's `qa-evidence.md` | full `npm test` + both typechecks green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 126 | `sprint-126-editor-selection-keys` | [#336](https://github.com/ProductoryHQ/ritemark-native/pull/336) | #332 (closed) | **Merged 2026-09-22** as `032437c8`; dev-build validated, evidence in the sprint's `qa-evidence.md` | full `npm test` + webview typecheck green; `validate-qa.sh` passed | drafted in `docs/releases/v1.12.0/release-notes.md` |
| Sprint 127 | `sprint-127-day-zero-models` | [#347](https://github.com/ProductoryHQ/ritemark-native/pull/347), [#349](https://github.com/ProductoryHQ/ritemark-native/pull/349) | #343 (open until the candidate checks) | **Merged 2026-09-25** as `b10b0575`, review fixes as `be201eca`; D4 scope (Claude Code 2.1.281, pre-release check, publisher withdrawn) | full `npm test` green, `tsc --noEmit` clean, `check:anthropic-models` passes; manual QA runs on the candidate (tasks.md Phases 7 and 8) | drafted in `docs/releases/v1.12.0/release-notes.md` |

## Risk Register

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| Google OAuth consent publication or verification is not finished in time, leaving shipped users on seven-day Testing tokens or an unverified-app block | High | Create the project at Phase 0 start; submit for publication and verification right after the Phase 0 gate fixes the scopes; track owner and status in the Sprint 119 tracker | Closed 2026-09-21: the app is In production with verified branding; `drive.file` needs no scope review |
| Ritemark legal pages are not live when the consent screen or the in-app links need them | Medium | Start the `ritemark-web` and `productory-2026` work in parallel with Phase 0; keep the old productory.ai URLs resolving for installed apps | Closed 2026-09-21: the pages are live with the Google Docs section (ritemark-web #152), and the in-app links point to them (Sprint 119 R11) |
| Ordered-list suppression breaks legitimate high-number list starts or imported CommonMark | High | Phase 0 input-rule audit; explicit boundary tests for intentional lists, paste, save, reopen, undo/redo | Closed 2026-09-22 (Sprint 120): typed markers convert only from 1 to 99; toolbar, slash menu and existing files keep any start; round trips pinned in `orderedListRoundTrip.test.ts` |
| Sprint 121 duplicates or races the v1.11.0 comment dispatch refactor | High | Treat Sprint 117 as a hard dependency; one canonical conversation ID and one queue/dispatch path | Closed 2026-09-14 (absorbed) |
| Comment resize/rail changes create overlap or unreachable controls at narrow widths | Medium | Responsive layout matrix plus keyboard, zoom, long-text, and multi-comment scenarios | Moved 2026-09-14 with Sprint 121 into v1.11.0 Sprint 117, which shipped it; not a v1.12.0 risk |
| New chat link actions expose unsafe paths or schemes | High | Central classifier; host-side path/scheme validation; deny unsupported schemes; clear failures | Closed 2026-09-23 (Sprint 122): one link classifier; a model-authored path outside the project is revealed in Finder, never opened; a scheme chat does not open is refused with **Copy link** |
| Conversation header actions diverge from History and create two lifecycle semantics | Medium | Reuse the existing store/actions and shared labels rather than implementing new mutations | Closed 2026-09-23 (Sprint 122): the header's ⋮ menu uses History's actions, words and confirmations |
| Office ZIP parsing permits decompression bombs (Sprint 124 part) | High | Host pre-check before any bytes reach the webview | Closed 2026-09-24 for Word: size cap, CFB detection and ZIP-directory limits in `officePackageCheck.ts`, driven with the corpus's bomb and 80 MB fixtures; Sprint 125 reuses it. **Reopened 2026-09-24:** the check read only the sizes the ZIP declares; a Word bomb declaring 4 KiB for a 512 MiB part passed it, and the Word webview then grew from 106 to 759 MB and showed JSZip's error. **Closed 2026-09-25 (Sprint 125 R5):** every part is inflated in the host, capped at its declared size + 1 byte; both lying bombs (`.pptx`, `.docx`) are refused before the webview, with renderer memory flat |
| Transcript search over long sessions harms render/playback performance | Medium | Keep a derived local index; test large-session navigation and playback-follow interaction | Closed 2026-09-23: matching is memoised and deferred while typing; a 600-segment, hour-long session searched, stepped and wrapped live while playing |
| Tab-label change requires fragile upstream VS Code patch work | High | Phase 0 locates the label authority; prefer existing browser editor-input APIs; patch only if necessary and add patch-application coverage | Closed 2026-09-23: browser tabs already use the page title; tab sizing is an extension default — no patch |
| Full-app release cost is incurred for one shell-facing polish item | Medium | Confirm release tier at Sprint 123 Phase 0 before source changes; retain full release if shell code changes | Closed 2026-09-23: Sprint 123 changes no shell source |
| “PDF-like Word” is interpreted as universal pixel parity that browser HTML cannot guarantee | High | Define representative corpus and accepted differences before implementation; label unsupported content and retain external-open fallback | Closed 2026-09-24 (Sprint 124): a measured Word corpus with its accepted differences; unsupported content is announced; **Open in Word** is the main action; the notes say plainly that a non-Word export has no saved page breaks |
| A new PPTX renderer adds immature behavior, dependency, or bundle risk | High | Exact-version Phase 0 spike; dependency/license/security audit; dedicated lazy asset; accept only with visual evidence | Closed 2026-09-25 (Sprint 125): `@aiden0z/pptx-renderer` 1.3.0 pinned after its spike and audit, loaded only in `office-preview.js`, and compared with PowerPoint's own exports of the corpus; `powerpoint-preview` is a kill switch |
| Office ZIP parsing permits decompression bombs, unsafe URLs, or leaked large buffers | High | Enforce ZIP limits and host/webview validation; CSP/link filtering; disposal and large-file tests | Closed 2026-09-25 (Sprint 125): every part is inflated in the host with a cap (R5); slide links go through the host, http(s) only, after the usual prompt; slides are drawn in a window and disposed outside it; the bomb and 80 MB fixtures are part of the corpus |
| Missing or platform-different fonts produce misleading Office layouts | Medium | Cross-platform corpus, font fallback policy, expected-difference documentation, and external-open action | Open until Gate 2: on macOS, missing Office fonts are aliased at 88 % (Sprints 124 and 125); Windows, where Calibri is installed, is checked at Gate 2 |

## Release QA Strategy

### Automated

- Editor input-rule and Markdown round-trip tests for prose-year and deliberate-list cases.
- Comment model, mention suggestion, resize-boundary, rail-placement, and task-correlation tests.
- Durable conversation header action and chat-link classification/validation tests.
- Transcript search reducer/index and keyboard-navigation tests against large synthetic sessions.
- Browser/file tab label unit or integration coverage at the actual label authority.
- DOCX/PPTX provider, message-boundary, feature-flag, ZIP-limit, unsafe-link, loading/error, search/navigation, and disposal tests.
- Visual baselines for representative Word pages and PowerPoint slides, plus bundle-size and large-document performance checks.
- Full repository QA at every sprint close and release feature-complete review.

### Manual canaries

1. Type Estonian and English prose beginning with several plausible years; save, close, reopen, undo, and redo.
2. Create short and long anchored/standalone comments at the top, middle, and bottom of a document; resize, collapse, zoom, and narrow the editor.
3. Assign single and bulk comments with keyboard-only `@` selection; verify the shown destination conversation is the actual running/result conversation.
4. Rename, pin/unpin, and safely delete/archive the active conversation from both Header and History; confirm identical outcomes.
5. Compose a long prompt at minimum/typical/wide sidebar widths and verify all controls remain reachable.
6. Open project-relative, absolute local, missing, external HTTPS, and blocked-scheme links from Claude, Codex, and OpenCode output.
7. Search a long transcript while stopped and while playing; navigate matches and confirm speaker rename/seek still work.
8. Open enough long-named documents and web pages to overflow the tab row; verify compact labels, full-name discovery, active identity, close, and keyboard navigation on macOS and Windows.
9. Open the Word corpus; compare pagination and common content to the accepted PDF/image ground truth, then exercise zoom, fit, search, refresh, failure, and external-open paths.
10. Open the PowerPoint corpus; navigate via thumbnails and keyboard, inspect common and unsupported content, test search/zoom/fit, then try malformed, oversized, missing-media, and unsafe-link fixtures.

### Release gates

Because the planned tier is full app, release execution follows the standard clean-room worktree, preflight, signed-unnotarized Gate 1 arm64 candidate, Gate 2 x64/Windows candidates, hardening windows, notarization, GitHub release, and canonical update-feed sequence. Planning approval does not clear either release gate.

## Documentation and Release Assets

- Add concise user documentation for transcript search and destination-aware links if the final interaction is not self-explanatory.
- Update comment and agent conversation documentation with the visible-destination contract.
- Capture one release-note image showing the improved active conversation/comment workflow and one showing transcript search if visual clarity benefits.
- Release-note angle: fewer interruptions and less uncertainty in everyday document work; do not market this as a redesign.
- Record any platform-specific tab-label limitation explicitly rather than silently reducing scope.
- Add Office preview support/limitations documentation, including the local-first contract and external-open fallback.
- Add a Google Docs publishing user guide (connect, template, Create, Sync, the overwrite rule, reconnect and recovery), linked from the Ritemark privacy policy's Google section.
- Capture release-note evidence for improved Word viewing and the new PowerPoint preview if both ship.

## Decisions Log

| Date | Decision | Source |
|---|---|---|
| 2026-09-26 | The first v1.12.0 candidate failed on the Word preview: a document without Word's saved page breaks showed no pages. No revert. A bounded fix in the same renderer — pages for any document, a default page size, Symbol and Wingdings bullets, pictures placed against the page, and paragraph borders — with a stop rule: if new classes of defects keep appearing, go back to the renderer question. No new candidate until the Word checks pass. The PowerPoint preview passed. | Jarmo: "sorry to say, but RC already failed! word preview does not have pages … do not build new RC before validations pass. Good news - PPT seems to work OK"; "jah, alusta viiepunktilise nimekirjaga" |
| 2026-09-26 | Word itself is the reference for the fix: the Sprint 124 corpus and four real documents are compared page by page with Word for Mac's own PDFs, and each rule taken from Word (widow and orphan control on unless turned off, an empty paragraph as one line of its paragraph mark, a variable font drawn at the weight its name gives, line height from the embedded font's metrics) was confirmed with a probe document laid out in Word. Evidence: `sprint-124-word-preview-fidelity/research/rc-fix-evidence.md`. | Engineering, under Jarmo's overnight brief: "otsi ise edge case’e ja loo teste" |
| 2026-09-25 | v1.12.0 is feature complete. PDF search (#344, PR #348) ships in it, alongside Sprint 127 (PRs #347 and #349). #343 stays open until its candidate checks pass. Main is frozen, and the next step is a release candidate that Jarmo uses for a while to judge its stability before Gate 1. | Jarmo: "348, 343, 349 sisse kõik! ja hakkame reliisi valmistama. Ma siivin RC'd saada ja siis ma töötan sellega natuke aega ja vaatan, kui stabiilne see on" |
| 2026-09-25 | Sprint 125: the renderer defects found in the spike are not reported upstream, and the corpus's git history is left as it is. | Jarmo: "jäta ajalugu nii, upstream'i ära postita" |
| 2026-09-22 | Google Docs publishing ships fully in v1.12.0, not as an experiment: the `google-docs-publishing` flag becomes `stable`, the Settings card loses its Experimental label, and the now-inert `ritemark.features.google-docs-publishing` setting is removed. It gets the same product presentation as the other features: a feature page on ritemark.app, drafted in the v1.12.0 marketing materials. | Jarmo: "Google Docs läheb fully sisse! ja see vajab samasugust tootetutvustust!" |
| 2026-09-22 | Kick off Sprint 120 (editor input intent): lightweight track, audit-first Phase 0; issue [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280); branch `sprint-120-editor-input-intent` from main `e9094517`. Phase 0 found a second defect: typing a number above an existing ordered list merges into it and rewrites its `start`. | Jarmo: "alusta ja liigume edasi" |
| 2026-09-22 | Sprint 120 input-rule bound: convert `1.`–`99.` only, the bound LibreOffice Writer uses in its own autoformat; three digits and up stay prose. No year-specific logic. | Jarmo: "kas sa tead kuidas MS word teeb seda? või Libre? kui ei tea siis variant A on ka ok" — LibreOffice's source answers it, so the bound follows that precedent |
| 2026-09-22 | Sprint 120 does **not** guard against the adjacent-list merge found in Phase 0. A round-trip probe showed Markdown cannot hold two adjacent ordered lists with different starts — the first marker wins — so blocking the merge would show a document the file cannot keep. The behaviour is pinned in `orderedListRoundTrip.test.ts` instead, and Cmd+Z restores the original numbering. | Evidence in the sprint audit, *The adjacent-list merge, re-examined* |
| 2026-09-24 | Sprint 124 renderer checkpoint: adopt docx-preview 0.4.1, honour Word's page markers only where a document has them, alias Office-only fonts at 88 %. No LibreOffice path for now. Sprint 125 stays a separate sprint right after 124; its renderer spike (`@aiden0z/pptx-renderer` is now 1.3.0) starts in parallel. | Jarmo: "jah, järjest — 0.4.1 ok, fondid 88% ok"; "libre office on overkill" |
| 2026-09-24 | Kick off Sprint 125 (PowerPoint preview): full track, audit-first; issue [#285](https://github.com/ProductoryHQ/ritemark-native/issues/285); branch `sprint-125-powerpoint-preview` from main `9940d086` (Sprint 124 merged). The renderer spike measured `@aiden0z/pptx-renderer` 1.3.0, the current release, rather than 1.2.4; it recommends 1.3.0 and rejects `pptx-preview`. PowerPoint joins Sprint 124's `office-preview.js`, so the sprint stays extension-tier | Jarmo: "Pärast seda alustan Sprint 125-ga" — "sobib!" |
| 2026-09-23 | Kick off Sprint 124 (Word preview fidelity): full track, audit-first; issue [#284](https://github.com/ProductoryHQ/ritemark-native/issues/284); branch `sprint-124-word-preview-fidelity` from main `4070ffc6`. Shell-tier: a dedicated `office-preview.js` bundle must be known to the shell build. Renderer changes wait for an evidence checkpoint with Jarmo. The PDF viewer adopts the same toolbar; PDF search and LibreOffice research become follow-up issues. | Jarmo: "plaan on ok, PDF saab sama tööriistariba — alusta" |
| 2026-09-23 | Kick off Sprint 123 (findability): lightweight track, audit-first Phase 0; issue [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283); branch `sprint-123-findability` from main `f55dbebe`. Phase 0 found no VS Code patch is needed: browser tabs already show the page title, and a crowded row is fixed by defaulting `workbench.editor.tabSizing` to `shrink`. **Back to playing line** also appears after a wheel scroll. | Jarmo: "plaan on ok, alusta" |
| 2026-09-23 | Sprint 123 accepts VS Code's shrink-mode rules as they are: a long tab name is clipped with a fade rather than an ellipsis, and the close button shows on hover, the active tab included (Cmd+W still closes it). Changing either would need a VS Code patch and make the release shell-tier. | Jarmo on PR #342: "jah, sobib" |
| 2026-09-23 | The transcript search bar sits in its own row above the scrolling transcript, not as a sticky header inside it. | Jarmo, on the first build: "layout errors - top gap and right gap"; re-checked: "nüüd on korras!" |
| 2026-09-23 | Kick off Sprint 122 (agent conversation clarity): lightweight track, audit-first Phase 0; issue [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282); branch `sprint-122-conversation-clarity` from main `04231de2`. An out-of-project file in a chat reply is revealed in Finder, never opened, because the path is model-authored. | Jarmo: "plaan on ok — Finderi valik sobib" |
| 2026-09-23 | Sprint 122 header actions sit behind one ⋮ menu instead of three icon buttons. | Jarmo, on the first build: "need pane : (kebab) meny alla" |
| 2026-09-23 | Sprint 122 composer is resized from a handle on its top edge, to any height the sidebar allows, instead of a native corner grip. | Jarmo, on the PR build: "EI see kirjutuskast peaks olema dünaamiliselt lohistatava kõrgusega vertikaalselt kasutaja poolt" |
| 2026-09-22 | Add Sprint 126 (editor selection keys) to v1.12.0, unplanned: `Shift+End` selected to the end of the document, so a following keystroke destroyed blocks elsewhere. Numbered 126 because 121 is a retired gap (#281) and 122–125 are allocated. | Data-loss report [#332](https://github.com/ProductoryHQ/ritemark-native/issues/332); Jarmo: "approved, start Phase 1" |
| 2026-09-22 | Sprint 126 `Shift+End`/`Shift+Home` extend to the **visual line**, clamped to the current text block — not to the whole paragraph. The browser computes the line boundary; the clamp is what removes the data loss and still applies without it. Plain `Home`/`End` stay untouched. | Jarmo: "visual line, approved, start Phase 1" |
| 2026-09-22 | Kick off Sprint 118 (direct Transcribe recording): scope as packaged, audit-first Phase 0; issue [#328](https://github.com/ProductoryHQ/ritemark-native/issues/328); branch `sprint-118-transcribe-recording` from main `d8d90ad7`. Destination: in the project with a folder open; with none, ask where to save before recording. | Jarmo: "118, alusta" |
| 2026-09-22 | Close Sprint 119 after QA and merge. Items only a candidate can prove (CI and packaged-build OAuth, Windows loopback, Store URLs) become v1.12.0 release gates. Planned hardening tests move to [#325](https://github.com/ProductoryHQ/ritemark-native/issues/325). | Jarmo: "jah, tee 1–4 kohe" |
| 2026-09-22 | Release builds compile in the production Google OAuth client ("Ritemark desktop"): from repository secrets in CI and from `~/.config/ritemark/release.env` locally. A release compile without it is refused. | Jarmo added the secrets and the local file; Claude wired the build paths |
| 2026-09-21 | Google OAuth app published (Testing → In production), with branding verified and published. `drive.file` needs no scope review. | Jarmo: "jah, vajuta mõlemat", after verifying ritemark.app in Search Console |
| 2026-09-21 | Google Docs section of the Ritemark privacy policy approved and published (EN + ET, ritemark-web #152) | Jarmo: "poliitika tekst kinnitatud, avalda see" |
| 2026-09-18 | Kick off Sprint 119: scope and Phase 0 approved; issue [#319](https://github.com/ProductoryHQ/ritemark-native/issues/319); branch `sprint-119-google-docs-publishing` from main `c2522479`. Implementation stays gated on Jarmo's approval of `research/integration-decisions.md`. | Jarmo: "jah" to the kickoff as proposed |
| 2026-09-18 | Phase 0 may create the Google Cloud project in Testing mode, with test users only, for disposable canaries. Publication, verification and the production client configuration wait for the Phase 0 gate. | Resolves a contradiction in the Sprint 119 package, whose Phase 0 tasks needed a project its own gate text forbade. Jarmo approved it with the kickoff |
| 2026-09-18 | Ritemark gets its own privacy policy and terms on ritemark.app, and Productory Services OÜ stays the provider. The native side is Sprint 119 R11. The pages (`ritemark-web`) and the Productory update (`productory-2026`) are external dependencies, because sprints are repo-scoped | Jarmo: "Toode on arenenud ja seega väärt eraldi" |
| 2026-09-18 | ritemark.app is the official product domain for the OAuth consent screen, legal URLs and authorized domains; getritemark.com remains only the Windows installer host | Jarmo |
| 2026-09-15 | Receive Sprints 118 and 119 from v1.11.0 | Jarmo re-cut v1.11.0 around the four Microsoft Store certification findings and moved the unstarted sprints here: "meil on vaja Microsofti asjad korda teha ja siis teha uus release ja see üles panna." Packages moved intact; Google Docs publishing becomes this release’s headline. |
| 2026-09-12 | Collect UX friction first; do not create a sprint plan until Jarmo asks | Jarmo, UX collection task |
| 2026-09-12 | Start release planning from the nine collected observations | Jarmo |
| 2026-09-12 | Keep the existing v1.11.0 draft untouched and map the UX work as a separate v1.12.0 release | Jarmo confirmation |
| 2026-09-12 | Use four sprints, numbered 120–123 after the proposed v1.11.0 sprints 116–119 | Jarmo confirmation of the proposed release map |
| 2026-09-12 | Keep Send-to-AI destination truth dependent on the v1.11.0 Sprint 117 dispatch contract instead of building a duplicate path | Release planning decision |
| 2026-09-12 | Treat the release as full app unless Sprint 123 proves tab labels can be fixed without shell changes | Release planning decision |
| 2026-09-13 | Add Word preview fidelity and PowerPoint preview as two separate sprints, 124 and 125 | Jarmo |
| 2026-09-13 | Keep Office previews browser-native and local by default; cloud or LibreOffice conversion remains a separately approved future option | Office preview feasibility analysis |
| 2026-09-13 | Isolate Office renderers from the shared editor bundle; Sprint 125 depends on the boundary established in Sprint 124 | Office preview feasibility analysis |
| 2026-09-13 | Treat `@aiden0z/pptx-renderer@1.2.4` as a spike candidate, not an approved dependency, and put PPTX preview behind a default-on experimental kill switch | Office preview feasibility analysis |
| 2026-09-14 | Absorb Sprint 121 into v1.11.0 Sprint 117; keep 121 as a numbering gap rather than renumbering 122–125 | Jarmo |
