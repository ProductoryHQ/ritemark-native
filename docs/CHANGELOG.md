# Changelog

All notable changes to Ritemark Native are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Transcribe Insights in any language** — search common languages or enter any language or dialect; Auto follows a recognized transcript language and otherwise falls back to English, while quotes and speaker attribution remain verbatim.
- **Faster focused Insights generation** — transcript extraction no longer inherits coding-agent tools, project instructions, or an extra-high reasoning budget.
- **Separate Insights documents** — name and create a new Insights-only Markdown snapshot with provenance and timestamps; existing files and the primary transcript are never overwritten or relinked.
- **Durable Agent Conversations** — project-safe, crash-safe host storage with first-prompt-before-dispatch ordering, typed host/webview protocol, legacy migration, corrupt-record isolation, confirmed Delete and Undo.
- **Conversations UI** — a permanent 56px rail with calm shared chat-bubble icons, optional Pin/Unpin, automatic working/needs-you/recent shortcuts, and one host-backed Conversations list that stays open beside the rail. Selecting a conversation changes only Current state and does not reorder Recents.
- **Conversation titles that become useful automatically** — the first prompt appears immediately as a shortened title, the selected runtime replaces it with a 3–6-word title after the first response, and Rename in Conversations lets the user take permanent control.
- **Truthful conversation continuation** — reopened Claude, Codex, and OpenCode conversations now attempt an exact-compatible native session resume on the next Send, then use a bounded canonical transcript fallback when native context is unavailable.
- **Calm agent handoff** — choosing another runtime applies immediately and preserves the composer draft. On the next Send, one quiet line between turns explains transcript fallback; unanswered user intent crosses as labelled context without transferring tool state, approvals, partial output, attachments, or another provider's private session ID.
- **Crash-safe dispatch tracking** — accepted prompts are durably marked before transport and only treated as provider-accepted after runtime-specific evidence; ambiguous/no-final failures abandon unsafe native bindings so a retry cannot silently duplicate context.
- **Stable conversation colors** — each project uses all eight base rainbow colors before deeper and softer variants; the same translucent-fill chat bubble follows a conversation across the rail, All conversations, restart, Rename, and Delete + Undo.
- **Refreshed built-in agents** — Codex 0.149.0, Claude Code 2.1.239, and OpenCode 1.18.21 ship with exact matching SDK edges (Claude Agent SDK 0.3.239 and ACP SDK 1.4.0). A new hard gate rejects checksum/platform gaps, stale vendor metadata, or Claude binary/SDK drift before packaging.
- **Thinking effort in the Composer** — supported Claude and Codex models expose a compact Auto/Faster→More thorough control beside the message field; OpenCode participates only when its live ACP session advertises compatible thought levels. The selection is model-filtered, durable per conversation/runtime, and snapshotted for every accepted or queued turn.
- **Trusted Windows installer (pending Windows certification)** — every executable payload is checked and signed, Inno signs its setup and uninstaller components, and standard-user install/uninstall is tested before upload. Microsoft Store becomes the recommended channel after Partner Center and Smart App Control-On testing pass.

### Changed
- Transcribe speaker rename now accepts real full names and Unicode spacing without playback shortcuts intercepting editing. Long speaker labels stay bounded and expose their complete accessible name.
- Agent transcripts are no longer owned by webview localStorage. Webview state retains only the selected canonical conversation, up to five Pin IDs, and harmless UI preferences.
- Reopened Sprint 109 transcripts explicitly disclose that the next message starts with a new agent working context; native provider continuation remains Sprint 110 scope.
- Live agent contexts are bounded in the host (five with parallel work, one otherwise). Ritemark releases only the least-recently-used non-current idle context; Working, Needs-you, and Current conversations are protected, while saved conversations remain unlimited.
- Runtime fetch and verification now use the same exact manifest contract in local development, QA, and release packaging; Codex optional input metadata and OpenCode ACP 1.x capability discovery remain contained inside their runtime adapters.

### Fixed
- **Claude models no longer appear twice or report a false mismatch.** Runtime aliases such as `default` and `opus[1m]` now resolve to one canonical picker row; the provider default is marked with a restrained `*`, and diagnostics compare the actual resolved model instead of comparing it with an alias.
- **Compact AI sidebars prioritize the selected model.** At narrow widths the closed permission control keeps only its mode icon and thinking effort becomes a level-aware icon, leaving the model name the available footer space; full labels remain available in opened controls, tooltips, and wider layouts.
- **Conversation rail controls keep a compact rhythm.** New conversation, open conversation, and history buttons now use a consistent 4 px vertical gap; the pinned divider keeps the same 4 px clearance on each side.
- **Agent and external edits appear in the open document without a reopen.** Markdown and CSV now use one per-file revision coordinator, and the host advances visible state only after the matching editor view acknowledges the exact payload it applied.
- **The file-changed action now means a real unresolved problem.** Ordinary local typing/autosave lag stays quiet; a true local-versus-disk conflict preserves both versions and exposes explicit Compare, Keep my version, and Use disk version choices.
- **No timer can replace unresolved local work.** The former ten-second forced reload, bounded self-hash heuristic, and competing webview booleans are removed; multi-view delivery is epoch-scoped, retry-bounded, and stale-message safe.

## [1.9.0] — 2026-08-20

Sprint 108 — Transcribe.

### Added
- **Transcribe: turn a recording into a document, without leaving Ritemark.** A new Activity Bar app takes an audio file (`.m4a`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`) and produces a speaker-attributed transcript you can read, correct, play back and save. It replaces the upload-to-cloud, transcribe-elsewhere, re-format-by-hand round trip
- **Two engines, and the trade is stated at the point of choice.** *On-device (Whisper)* keeps the audio on your machine and costs nothing, but cannot tell speakers apart — whisper.cpp has no real diarization. *ElevenLabs Scribe* separates speakers (up to 32) but uploads the file; before it does, the panel shows the duration and the estimated cost. Nothing runs until you pick
- **Transcript Workbench** — a dedicated editor for a recording: waveform player, speaker-separated transcript, **click any line to hear it**. That is the point: a quote can be checked against the audio in two seconds before it goes to a client
- **Speaker chips with one-click global rename.** Rename `Speaker 2` once and all its segments follow, in the workbench and in the saved document
- **Uncertainty is marked.** Words the engine was unsure about are highlighted, on **both** engines — tuned against real output so it flags names and jargon rather than every "and"
- **Insights rail** — summary, decisions, action items, open questions and key quotes, generated on the agent runtime you already use. Every item carries a timestamp that plays the moment it came from; anything the model cannot cite to a real line is discarded rather than shown
- **Save to document** — choose the folder, get Markdown with front matter, speaker headings and timestamps, opened in Ritemark's editor. The saved document stays linked in the workbench header, and the AI sidebar treats it as the active file, so "ask Claude about this recording" works
- **Windows is supported** with ElevenLabs. The on-device engine says plainly that it is not available on Windows yet ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)) instead of the feature quietly disappearing
- Jobs survive closing the panel, show progress on the Activity Bar icon, can be cancelled, and are reported honestly as **Interrupted** if the app closes mid-transcription
- **The library is project-scoped, and says so.** Recordings belong to the folder that was open when they were transcribed. A project with none reports how many are filed elsewhere and offers **Show all projects**, each row labelled with where it was made — an empty list never means a lost transcript
- On-device transcription requires **Apple silicon**; on an Intel Mac the engine card says so and ElevenLabs is the route ([#203](https://github.com/ProductoryHQ/ritemark-native/issues/203))

---

## [1.8.6] — 2026-08-09

Sprint 102 — AI Transparency (#163); Sprint 103 — Truthful Agent Plans (#132, #161); Sprint 104 — Reliable Multi-Prompt Queue (#162); Sprint 105 — Comments Command Center (#164, #165); Sprint 106 — Home Launcher (#74); Sprint 107 — Clean Start (first-open fix, daemon consent, tab healer; R4 welcome-card removal shipped early), plus the connectivity fix below.

### Fixed (post-candidate)
- **The offline banner no longer flickers on a healthy connection (#193).** Connectivity was decided by a single `HEAD` to `api.openai.com` with a 5 s timeout, re-rolled every 30 s — one slow or dropped probe flipped the UI to "Offline". Measured on 2026-08-08: ~10% of probes to OpenAI's edge failed on a working connection, so the banner reappeared every few minutes. Each round now races three independent endpoints (Anthropic, OpenAI, Apple captive portal — any HTTP response counts as online) with an 8 s timeout, and the offline verdict requires **two consecutive** failed rounds with a 5 s confirm round after the first; one success recovers instantly. Decision logic is a pure, unit-tested module (`src/ai/connectivityPolicy.ts`)

### Changed
- **Mode control is ONE dropdown: Manual / Auto / Plan only.** The separate Plan chip is gone — "Plan only" lives in the same select, still auto-resets to the underlying autonomy when a plan is approved
- **One status line while the agent works.** The old per-turn spinner box (raw tool + full path) duplicated Sprint 103's human-readable ActivityStatusLine — removed; the running-subagent badge moved into the status line
- **Folder tree, writer-grade.** Expand chevrons removed (folders toggle on row click; left padding restored, deeper default indent), the selected file reads indigo — icon and label — even when focus is in the editor, and the highlight now follows the ACTIVE tab: switching to a tab whose file isn't in the tree clears it. Outline and Timeline sections removed from the Folder view. Preview tabs are off by default — every open is a real tab
- **Home view renders in Sofia Sans** (brand font) — it was falling back to the system font; the "New document" button vertical rhythm equalized. The composer no longer shows a redundant "N context" counter
- **One word: Folder.** The sidebar view is now "Folder" (was "Project"), matching the File menu and every empty state — the third competing term, "Workspace", no longer appears anywhere in the UI
- **The File menu speaks Ritemark.** "New Document" (⌘N) and "New Table" replace "New Text File"/"New File…"; the workspace machinery (Open Workspace from File, Add Folder to Workspace, Save Workspace As, Duplicate Workspace), "New Window with Profile", "Share", and "Revert File" are hidden from the menu (every command stays reachable via the command palette). The Selection menu (multi-cursor tooling) is hidden entirely. ⌘N now creates a Ritemark markdown document instead of a plain-text untitled file

### Fixed
- **Clean first open (Sprint 107 R1).** Opening a `.md` from Finder on a fresh profile now lands directly in the Ritemark editor with workspace trust OFF — no "do you trust the authors" modal, no plain-text flash, no Restricted Mode. Root cause: VS Code only reads product-level configuration defaults on the WEB workbench; patch 013 wires Ritemark's block into the desktop bootstrap (this also activates the deeper tree indent and preview-tabs-off defaults)
- **Already-stuck markdown tabs self-heal (Sprint 107 R3).** Profiles bitten by the old bug (a `.md` pinned open in the plain-text editor) get a one-shot healer on activation that reopens those tabs in Ritemark's editor. Named tradeoff: a deliberate per-tab "Reopen With → Text Editor" choice is lost once
- **Chat file links: root-level paths with line suffixes** ("README.md:12") now open instead of being mistaken for URL schemes; comment task prompts keep informational cross-agent mentions ("@claude compare with @codex notes"); flow/daemon one-shot runs now genuinely pin their model (the pin was silently not reaching the SDK); the editor's originally-loaded content is fingerprinted as self-known so long typing sessions with pending autosave can never trigger the foreign-change banner (all four from Codex PR review)

### Added
- **Scheduled agents ask before they run (Sprint 107 R2).** A workspace that defines scheduled agents gets a one-time, non-blocking prompt ("Allow" / "Not now") before anything is armed — schedule-triggered runs fire without a user gesture, so they need explicit per-workspace consent. Reversible any time from the Agent Library's Scheduled section (Allow/Pause). Workspaces already running scheduled agents before this shipped are grandfathered in
- **Comments toolbar counts mid-sentence assignments.** Writing `@claude` in the middle of a comment assigned it on the margin rail but the toolbar overview still said "0 assigned" — the overview used a stricter prefix-only parse. Both now share the rail's rule: the first `@agent` mention anywhere in the body assigns, and the mention is stripped from the dispatched task prompt
- **The model you pick is the model that runs.** Claude sessions could silently run a different model than the UI showed (Jarmo caught Fable 5 selected, `claude-opus-4-8` actually running): the webview never sent the model on Claude turns, and a modeless session let the bundled CLI fall back to the user's personal `~/.claude.json`. Now every path pins the model explicitly — chat turns, queued prompts, comment tasks, flows, and daemon runs — and if the runtime still resolves a different model than requested, the conversation shows a visible "Model mismatch" line instead of hiding it
- **Your own edits never trigger the file-changed banner.** The editor keeps fingerprints of content it wrote itself — an autosave landing mid-typing no longer reads as an "external change"; only genuinely foreign writes (agents, CLIs, other apps) can surface the refresh banner. The "Refreshed <file>" snackbar is gone — the updated content is the feedback
- **Folder tree geometry.** Level-1 rows align with the pane title; depth indentation preserved after chevron removal (the twistie box carries the tree's indent — collapsed to width 0 instead of display:none)
- **Agent file updates now always reach the editor.** External-change detection was edge-triggered and could wedge: if one push to the editor view was suppressed (echo-guard race with autosave), the editor stayed stale forever while everything looked "in sync". The three detection paths (TextDocument events, file watcher, 3s poll) now converge on ONE level-triggered reconcile that compares disk content against a hash of what the editor view actually last received — any divergence self-heals within a poll tick. Unsaved local edits still get the refresh banner + 10s auto-reload, never a silent overwrite
- **Home is the same launcher with or without a folder.** The no-folder Home now shows the full launcher — New document (works folderless via drafts), Open document, New table, Open folder, and your recent folders (one-click re-entry) — instead of a bare "open a folder" dead end. Only "New AI task" stays folder-gated (agent runs require a workspace)
- **Chat file links now open in Ritemark.** A chat reply linking to a workspace file ("[Koondfailis](koondfail.md)") opens that file in Ritemark's own editor on click — previously the click died silently (the webview's `open-source` message had no host handler). Web links route through the browser as before; paths are confined to the workspace folder (realpath-checked), and inline-code paths like `docs/plan.md:12` work too
- **Project view speaks Ritemark, not VS Code.** The no-folder empty state now says "Open a folder to start writing — your documents live in a folder Ritemark can see" with a single Open Folder action (patch 002); the git extension's "Clone Repository" block and the "how to use Git and source control in VS Code read our docs" link no longer appear there (patch 003)
- **Finder showed "Ritemark.app (1.117.0)".** The macOS bundle's `CFBundleShortVersionString` was left at the upstream VS Code version by the build; `build-prod.sh` now stamps `Info.plist` with the Ritemark version. Both v1.8.6 macOS builds ship stamped — note that the Apple Silicon stamp comes from `build-prod.sh` while the Intel build is produced by CI, which has no stamp step: the v1.8.6 Intel bundle was stamped manually at release time and the CI gap is tracked in #200

### Removed
- **"Claude is ready — Get Started" welcome card (Sprint 107 R4).** A ready Claude sidebar with no conversation now opens straight into the chat composer — the interstitial card and its extra click are gone. Its bookkeeping (`hasSeenClaudeWelcome`) still records automatically, and the real setup states (install, repair, sign-in, Codex/OpenCode setup, first-run onboarding) are unchanged

### Added
- **Home launcher (Sprint 106, #74).** A persistent Home view in the Activity Bar: one dominant **New document — Markdown (.md)** action plus New AI task, Open document, New table, and Open folder quick actions (all existing commands), and the workspace's recently modified documents. Flag-gated (`home-launcher`, default on) as a rollout kill-switch; pinned FIRST in the Activity Bar via patch 002 (shell-tier, Jarmo-ordered 2026-08-04)
- **Comments Command Center (Sprint 105, #164).** The editor toolbar shows a Comments button with the document's true unique-comment count (multi-block comments count once via the shared ID-deduplicated index); its overview breaks the workload into assigned/unassigned and per-agent groups, and **Send assigned comments to AI** dispatches one ordered task per agent — through the Sprint 104 queue, with a confirmation that shows task counts and lets you exclude agent groups. Source comments are never modified by dispatch
- **Honest comment-task status (Sprint 105, #165).** Margin markers show the live state of dispatched comment tasks — queued, running, done, or failed — correlated by stable comment id from the sidebar's queue and turn facts; removing a queued item returns the marker to neutral
- **Bounded multi-prompt queue (Sprint 104, #162).** Each chat now holds up to 10 ordered follow-ups instead of one invisible slot: a visible "Queued · n/10" panel with per-item edit, remove, reorder, and retry; the composer never locks while items wait. Draining is gated on Sprint 103's activity states — a pending plan review, question, or approval pauses the queue, and a failed/stopped turn requires an explicit Resume
- **Comment tasks share the queue.** A comment assigned to an agent routes to a stable conversation for that runtime (reusing an idle matching thread or creating a background one) through the same queue — the old path that retargeted the visible thread's runtime and silently dropped prompts on a busy runtime is gone
- **Background threads drain.** Queue dispatch moved from a render effect on the visible composer into the store, so a background thread's queued items send when its turn finishes
- **Enforced plan mode for Claude (Sprint 103, #132).** The Plan control now runs Claude in the SDK's native plan mode: the planning phase is technically read-only, the plan review card appears reliably on the first attempt (previously it depended on the model accidentally recovering from a harness error), and approval continues execution in the same conversation under the chosen autonomy mode
- **Two-axis mode control (Sprint 103, #132).** The three-button `Auto / Ask / Plan` strip is replaced by an autonomy select (**Manual** / **Auto**) plus a **Plan** chip that stays on until a plan is approved. The chip renders only for runtimes with an enforceable plan contract (Claude, Codex) — OpenCode shows no Plan control by design
- **Plan review card v2 (Sprint 103).** Provenance line ("Requested by you · Plan" / "Claude chose to plan first"), rendered-markdown plan body, verified "No files changed yet." claim, and **Approve & continue / Keep planning** (with feedback) actions for both Claude and Codex
- **Truthful activity status (Sprint 103, #161).** One status line per conversation derives running / waiting-for-you (plan review, question, approval) / done / failed / stopped from a single source shared with the thread rail; "Done" can no longer appear while a card is pending
- **Per-runtime capability registry.** `src/runtime/capabilities.ts` is the single source for which mode controls each runtime may render

### Changed
- **Claude sessions no longer use `bypassPermissions`** (Sprint 103). Auto maps to `acceptEdits` + auto-allow, Manual to `default`; the dangerous skip-permissions flag is gone from every Ritemark session (its mere availability disabled native plan enforcement)
- **Mode switches keep conversation memory.** Autonomy changes use the SDK's live `setPermissionMode` instead of rebuilding the session; a genuine rebuild (model change) is announced in the transcript instead of happening silently
- **Codex plan turns run in a read-only sandbox**, so "No files changed yet" is enforced rather than narrated; approval flips the thread back to the configured write sandbox
- **Prompt text no longer flips modes.** The hidden "plan mode" phrase detection is removed for both Claude and Codex — only the visible Plan chip selects plan-first, and model-initiated planning is surfaced with an attribution chip instead of happening silently
- **Turn metrics tell the truth.** Headline duration is agent working time (waiting-for-you time reported separately); "Modified N files" counts only workspace files, excluding runtime-internal writes such as `~/.claude/plans/*`

### Technical (Sprint 103)
- New `runtime/capabilities.ts`, `ai-sidebar/activityState.ts` (+ tests), `ActivityStatusLine.tsx`; `PendingRuntimeSelection` gains `planFirst` with lossless migration of stored `mode: 'plan'` threads
- Plan-truth evidence base (audit, traces, screenshots, SDK spike) under `docs/development/releases/v1.8.6/sprint-103-agent-truth/research/`; regression harness at `scripts/qa/plan-truth-matrix.sh`
- **First-interaction AI disclosure (Sprint 102, #163).** The AI composer now states that the user is interacting with AI before the first turn, names the active runtime/provider/model, remains non-blocking, and uses an explicit **Don’t show again** action for its one-time acknowledgement
- **Persistent AI information view.** An always-available composer button and a link at the end of Ritemark Settings explain which context categories may leave the device, distinguish provider processing from Ritemark analytics, link provider/policy information, and require human review of AI output
- **Runtime/provider mapping tests.** Automated coverage locks Claude Code → Anthropic, Codex → OpenAI, and OpenCode → the selected BYOK service/model, plus first-use persistence and context-state mapping

### Changed
- **Truthful context controls across runtimes.** Active-file removal now reaches Codex and OpenCode as well as Claude; browser context is no longer shown for OpenCode because the host injects it only for Claude/Codex
- **Runtime switches keep the disclosure identity coherent.** Pending model state is accepted only when it belongs to the selected runtime, preventing a freshly selected Codex session from briefly showing a stale Claude model in the information view
- **OpenCode attachments cross the composer boundary.** Attachment payloads are now forwarded to the ACP runtime and retained in turn metadata instead of being silently dropped
- **AI/privacy documentation.** User docs no longer make the absolute claim that AI content always remains local and now document default-on anonymous PostHog analytics separately from AI-provider processing

### Technical
- New `ai-sidebar/aiDisclosure.ts`, `AIInformation.tsx`, and `aiDisclosure.test.ts`; runtime-switching regression coverage extended for OpenCode attachment and active-file behavior
- Product evidence matrix and counsel decision memo live under `docs/development/releases/v1.8.6/sprint-102-ai-transparency/`
- Public EN/ET AI-information pages are live after `ritemark-web` PR #77; counsel-approved Productory Terms/Privacy corrections are live after `productory-2026` PR #20

---

## [Unreleased] — v1.8.3

> **Draft entry for v1.8.3.** Sprint 94 — Comment Callouts (#81). Bugfix sprint (#142/#103/#135) to follow.

### Added
- **Comments in the editor (Sprint 94, #81).** Leave editor-only notes on your document — never shown in exports. Select text and click **Comment** to anchor a soft-yellow highlight with a note in the right margin, or type `/// your note` on a line and press Enter for a standalone margin note. Multi-line notes are supported. Hover a margin marker to read, **edit** (pencil), or delete it
- **Assign a comment to an AI agent (Sprint 94, #81).** Write `@claude`, `@codex`, or `@opencode` anywhere in a comment — it shows an inline mention chip and a **Send to AI** button that hands the note (plus the anchored text) straight to the AI sidebar, routed to that agent
- Comments store as portable `<!-- -->` / `<mark data-comment>` in the `.md` file, round-trip losslessly through load/edit/save/copy, and are stripped from PDF and Word exports. Behind the `comment-callouts` flag (on by default)

### Fixed
- **Rebuilt webview bundles now actually load (Sprint 94).** The editor's `webview.js` had no cache-buster, so a window reload could serve a stale cached bundle. Now versioned with `?v=<mtime>`, matching image resources

### Technical
- New `webview/src/extensions/comment/` (marked tokenizer, Turndown rules, TipTap `CommentMark` + atom `CommentNode`, model helpers + `commentRoundTrip.test.ts` wired into `npm test`), `components/MarginCommentRail.tsx`; export strip in `export/v2/htmlPipeline.ts`; Send-to-AI relay across `ritemarkEditor.ts` ↔ `UnifiedViewProvider` ↔ sidebar store (`comment:send-to-ai` / `comment:submit`); `comment-callouts` experimental flag
- Two independent adversarial code audits; all high/medium findings fixed and verified. Soft-yellow is a documented functional exception to the indigo-only palette (`ritemark-design/references/components.md`)
- VS Code base: 1.117 (unchanged)
- Sprint 94 (comment callouts) — closes #81

---

## [Unreleased] — v1.7.3

> **Draft entry for v1.7.3.** Sprint 74 — AI Sidebar & Composer Polish + Sprint 76 — OpenCode BYOK runtime. Ships after v1.7.2.

### Added
- **OpenCode — a third AI runtime that uses your own provider keys (Sprint 76, #52).** Open-source ACP agent bundled with Ritemark; pick it in the model dropdown and run Gemini, GPT, Claude, or OpenRouter models with the API keys you already have in Settings. The picker groups providers (only those with a configured key); file edits are approval-gated with a single "File Change Approval" card per edit (workspace-bounded — writes outside the project are blocked); optional "Auto-approve edits & tool calls" toggle in Settings. Behind the `opencode-integration` flag (on by default). OpenAI/Google/Anthropic "Used for:" lines now mention OpenCode; new optional OpenRouter API-key card
- **Composer stays unlocked while the agent runs — queue your next prompt (Sprint 74, #82).** Type a follow-up during an agent run and press Enter: it parks in a "Queued" notch above the input (same visual pattern as "Working on selected text") and auto-sends the moment the run completes. Discard it with ×. One queued prompt at a time
- **Edit Link dialog has an optional "Display text" field (Sprint 74, #93).** Pre-populates from the selected text; when re-opening an existing link it pre-fills with the current link text, and Update replaces the whole link. Leave it as-is/empty to keep current behaviour. Hidden during `@file` search

### Fixed
- **Plan approval card now actually approves (Sprint 74, #86).** The Approve/Reject buttons used to render after the approval window had already closed — clicking them silently did nothing. Approval UI now renders only while Claude is genuinely blocked waiting on plan approval. The card is also redesigned: full plan text (no more last-section-only truncation), flat single-level layout, indigo primary Approve CTA
- **Spurious horizontal scrollbar on short code blocks (Sprint 74, #84).** The copy-button tooltip overflowed the code block container and triggered a scrollbar even when the code fit. The container no longer scrolls; the code element inside carries the scroll for genuinely long lines

### Technical
- New webview modules: `ai-sidebar/composerQueue.ts` (+ tests), `ai-sidebar/planText.test.ts` — regression coverage for #82 and #86 wired into `npm test`
- Sprint 76 ACP/OpenCode: new `src/acp/` client (`@agentclientprotocol/sdk` 0.22.1), `acpKeyEnv` (keys → spawn env only, never to the webview), OpenCode model registry in `modelConfig.ts`, bundled darwin/win binaries via `fetch-agent-runtimes.sh`; fixed a `new Function('return require')` antipattern that disabled all runtime tracing
- VS Code base: 1.117 (unchanged from v1.7.2)
- Sprint 74 (AI sidebar & composer polish) — closes issues #82, #84, #86, #93; defers richer queue remove/edit/promote to #95
- Sprint 76 (OpenCode BYOK runtime) — closes #52; cross-agent shared conversation history tracked in #97

---

## [Unreleased] — v1.7.2

> **Draft entry for v1.7.2.** Sprint 72 + Sprint 73 — Markdown navigation polish + bundled runtime/model selector clarity.

### Removed
- **Retired the deprecated "Legacy Agent" chat runtime and the unused document-search (RAG) subsystem (Sprint 74).** The AI sidebar now offers only Claude Code and Codex. The semantic-search/vector-index feature, its citation chips, and the index footer are gone, along with the legacy OpenAI chat client. Existing saved "Legacy Agent" conversations still open read-only. Flows (LLM/Image nodes), API-key configuration, Claude Code, and Codex are unaffected. Internally this deletes `src/rag/`, `src/ai/openAIClient.ts`, and the `@orama/orama` dependency.

### Added
- **AI model selector now warmups Claude model metadata on panel open.** The dropdown upgrades from fallback labels to SDK-reported model names/versions (for example Sonnet/Opus/Haiku version lines) without requiring a first user message.

### Changed
- **AI model selector readability and interaction polish.** Model rows now use a two-line layout (primary model/version + muted tagline), long lists are constrained with a thin vertical scrollbar, and option rows use a pointer cursor.
- **Settings runtime diagnostics now show real bundled runtime details.** Claude card combines CLI + SDK version when available, and Codex app-server version detection now prefers runtime `--version` output (with fallback for older binaries).

### Added
- **Type `@` to link any local file.** A keyboard-first file-search picker opens at the cursor; type to filter, Arrow keys to navigate, Enter to insert. The selected file lands as a Markdown link with the basename as visible text and a relative path as the target. Escape dismisses without inserting
- **All workspace files are searchable via `@`-picker.** Removed the hard-coded extension allowlist after dev verification showed `@test-utils.js` returned "No matching files." Markdown still ranks highest; docs/data/images rank next; code and configs are reachable. Heavy/generated folders (`node_modules`, `.git`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `*.app`, `VSCode-*`) stay excluded
- **Add Link dialog speaks the same `@`-syntax.** Open the dialog with Cmd+K, type `@query` in the URL field, pick a result — the relative path fills the URL. External-open icon stays hidden for internal targets
- **Cmd-click follows internal links.** Markdown targets open in Ritemark; everything else (PDF, images, CSV, source files, configs) opens via VS Code's default opener. External URLs (http/https) keep their existing system-browser behaviour
- **Heading-level changes from the persistent Table of Contents.** Right-click a TOC row to pick H1–H6 from a context menu; current level is disabled. `⌥⌘1-6` on macOS / `Ctrl+Alt+1-6` elsewhere works globally inside the editor — at cursor inside a heading, at heading boundary (the TOC click landing position), or on a focused TOC row. One undo step reverts. Scroll position is preserved across the level change
- **Edit Link dialog has an `↗` Open icon next to the URL** that follows the link target (external → browser, internal → extension host). Works for both link types — internal targets used to have no way to be opened from the dialog

### Changed
- **`KNOWN_FILE_EXTENSIONS` in `linkTargets.ts`** expanded to cover common code and config extensions (`.js`, `.ts`, `.tsx`, `.py`, `.rs`, `.go`, `.yaml`, `.toml`, `.env`, `.lock`, …) so picking a `.js`/`.ts` file from `@`-search no longer reintroduces the "external-open icon shown for relative path" defect

### Fixed
- **External-open icon was wrongly shown for `*.md` (and other file-extension) relative paths** in the Add Link dialog. The `looksLikeExternalHost` heuristic matched both `example.com` and `spec.md`; now it short-circuits on a known-file-extension set. Ambiguous TLDs (`.io`, `.dev`, `.app`, `.ai`, `.co`) are intentionally left untouched
- **macOS missing-file under symlinked `/tmp` wrongly reported as "outside workspace"** instead of "File not found" by the new internal-link resolver. `fs.realpath` ENOENTs for non-existent files; the lexical path could not be compared against a `realpath`'d workspace root. The resolver now walks the parent chain to the deepest existing ancestor before realpath'ing
- **`vscode.openWith` called with `ritemark.markdownEditor`** (a descriptive name) silently fell back to VS Code's text editor. The registered viewType in `package.json` is `ritemark.editor`; the dispatched id now matches

### Removed
- **Dead `webview/src/components/header/TableOfContents.tsx`** — exported from `header/index.ts` but never imported anywhere. Cleaned up along with the wasted right-click context-menu wiring that was briefly added to it earlier in the sprint

### Technical
- VS Code base: 1.117 (unchanged from v1.7.1)
- New extension-host modules: `src/workspaceFileLinks.ts`, `src/internalLinkResolver.ts` (+ tests)
- New webview modules: `extensions/FileLinkSuggestions.tsx`, `extensions/FileLinkSuggestionList.tsx`, `extensions/HeadingLevelShortcuts.ts`, `components/ui/context-menu.tsx`, `lib/linkTargets.ts`, `lib/workspaceFileSearch.ts`
- New TipTap extension `HeadingLevelShortcuts` re-binds `Mod-Alt-1..6` so it works at heading boundaries (the StarterKit default silently failed there)
- Sprint rolled up: 72 (Markdown navigation and annotation polish)
- Closes issues #79, #80; defers #81 with audit findings

---

## [1.7.1] - 2026-05-25

> **macOS note:** the macOS DMGs in this release are signed with Developer ID + hardened runtime but **not notarized by Apple** (team-eligibility hold, Apple case 102892219755). On first launch macOS Gatekeeper will refuse the app — one-time Open Anyway via System Settings → Privacy & Security clears it. Full disclaimer and exact steps are on the [GitHub Release page](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.7.1). Windows is unaffected.

### Added
- **GitHub Copilot Chat is first-class.** Marketplace-installed `GitHub.copilot-chat` can authenticate, the real Chat panel lives in the Secondary Sidebar (Auxiliary Bar) next to Ritemark AI, and a dedicated Activity Bar launcher icon opens it
- **Install/uninstall symmetry for Copilot Chat.** Install the Marketplace extension → launcher icon and Chat panel appear; uninstall → both disappear cleanly; reinstall → they come back. Stale hidden layout state from earlier Ritemark builds is repaired on first launch
- **AI Agent Browser Control (macOS, on by default).** Five tools — `navigate`, `click`, `fill`, `type`, `scroll` — wired into both Claude Code SDK and Codex App Server. The `browser-agent-control` flag ships as `stable`, `darwin`-only; non-darwin platforms receive no browser tools
- **"Allow AI to control this browser tab?" consent dialog.** Per-tab consent gate distinct from the v1.7.0 read-share prompt; revoking read consent cascades to control consent

### Changed
- **Copilot compatibility metadata** in `branding/product.json` now includes the GitHub trusted auth access, default chat agent, and proposed API allow-list required by the Marketplace Copilot Chat extension
- **Marketplace extension defaults** no longer disable Copilot inline completions, auto-completions, code actions, or chat-agent enablement
- **Auxiliary Bar order** is **Ritemark AI → GitHub Chat → Terminal** for new and existing profiles, so Copilot Chat coexists beside Ritemark AI rather than replacing it
- **`.html` files open in the integrated browser at the workbench level** — `.html`/`.htm` resolver registered at `default` priority; right-click "Open as Text" is preserved
- **Codex `thread/start` timeout** bumped from 60s to 120s to accommodate the dynamic-tools attach for browser control
- **Settings cleanup:** the misleading "Open HTML files in…" dropdown and the Features section (flag toggles) were removed. Stable feature flags are now baked into platform defaults; a leaner Features panel returns in a later release for experimental flags only

### Fixed
- **Chat History shows every saved conversation** instead of just the most recent — the list now reloads as soon as the workspace context is established
- **Clipboard works inside the sandboxed webview** — Copy on code blocks, Export → Copy as Markdown, and Cmd+C/Cmd+V in table cells now route through the extension host
- **HTML cold-start race is gone** — the `.html` flicker / blank-text-tab on app cold start is resolved by the workbench editor resolver
- **Copilot sign-in path:** Copilot's contained Sign In button has the narrow setup commands it needs without restoring the full upstream VS Code Chat setup UI
- **Copilot Chat disabled state:** VS Code's builtin chat enablement migration no longer disables Marketplace-installed Copilot Chat when Ritemark suppresses the upstream setup contribution

### Technical
- VS Code base: 1.117 (compat patches required for Marketplace Copilot Chat)
- New patch: `patches/vscode/010-ritemark-browser-action-bridge.patch`
- Sprints rolled up: 68 (v1.7.1 patch fixes), 69 (AI Agent Browser Control), 71 (GitHub Copilot Support)
- Closes issues #63, #65, #66, #67, #68

---

## [1.6.0] - 2026-04-28

### Added
- **Agent Library:** new activity-bar entry that auto-discovers `.claude/agents/`, `.claude/skills/`, and `.claude/commands/` from the workspace and the user-scope `~/.claude/` directory; click any entry to open the source `.md` file
- **Properties side panel:** frontmatter editing (status, tags, dates, custom fields) now opens as a dedicated right-side panel instead of a modal dialog
- **Inline Table of Contents:** sticky 220px outline rail in the editor on screens ≥960px wide, with active-heading tracking and click-to-jump
- **Dark mode:** Ritemark Dark theme as a first-class option, auto-switching with the system color scheme
- **Phosphor icon set:** primary navigation, document header, AI sidebar, and dialogs migrated from Codicons to Phosphor Icons
- **CSV → Excel conversion:** "Open in Excel" on a CSV file now converts to a temporary `.xlsx` first (fixes Mac Excel UTF-8 mojibake and EU semicolon-delimiter issues)

### Changed
- **Activity bar redesign:** 28×28 icons, rounded active-state indicator, dedicated Agent Library and Flows entries
- **Auxiliary bar tabs:** compact icon-only tabs when multiple panels are docked on the right side
- **AI panel default placement:** reliably docks on the right on first launch, ignoring cached VS Code view positions
- **Diagnostic noise suppressed:** markdown files no longer show red squiggles for missing link references; file tree no longer propagates editor decorations

### Fixed
- Activity bar 6px vertical spacing between icons (regression from Sprint 53)
- Frontmatter parser handles CRLF line endings (agents written on Windows)
- Frontmatter parser handles YAML block scalar indicators (`>`, `>-`, `|`, `|-`)
- Phosphor font loading hardened in production builds (no brief icon-box flash at startup)
- AI panel focus restoration timeout tightened so the chat input reliably focuses on open

### Technical
- VS Code base: 1.109.5 (no change from v1.5.3)
- No new extension-host runtime dependencies
- Sprints rolled up: 51 (inline ToC + CSV-to-xlsx), 52 (design foundations + Phosphor), 53 (chrome activity bar + titlebar polish, PR #29), 54 (Agent Library + Properties panel, PR #30)
- Internal v1.5.4 build (Sprint 51 only) was never tagged; its content ships here

---

## [1.3.0] - 2026-02-06

### Added
- **PDF Viewer:** Read-only preview for PDF files with page navigation, zoom (50%-200%), text selection, and continuous scroll
- **DOCX Viewer:** Read-only preview for Word documents with faithful visual rendering (fonts, colors, alignment preserved)
- **CSV Sort:** Click column headers to sort data ascending/descending/unsorted
- **CSV Add Row:** Toolbar button to append new rows to spreadsheets
- **Claude Code Node:** New Flows node type for executing Claude Code tasks via Agent SDK
- **Intel Mac Support:** Added darwin-x64 builds for older Intel-based Macs
- **GitHub Actions CI:** Automated Windows and macOS x64 builds on release

### Changed
- Webview bundle increased to ~5MB (includes react-pdf + docx-preview + PDF.js worker)

### Fixed
- Flows sidebar white background on VS Code light themes
- CSV editing preserves correct row indices during sort operations
- Package dependency conflicts with zod 4.x (upgraded openai to v6)

### Technical
- react-pdf@10.3.0 for PDF rendering with worker support
- docx-preview for faithful DOCX visual rendering
- PDF.js worker loaded separately (~1MB) via webview CSP
- Feature flags: All features enabled by default

---

## [1.2.0] - 2026-02-02

### Added
- **Ritemark Flows:** Visual workflow automation for AI content generation (Sprint 27)
  - New Activity Bar tab with Flows icon
  - Drag-and-drop node editor using React Flow
  - Trigger, LLM, Image, and Save File node types
  - Auto-layout with ELKjs
  - Undo/redo support
  - Flow storage in `.ritemark/flows/`
- New branded Ritemark Settings page

### Fixed
- Windows: Dictate button now hidden (macOS-only feature)
- Windows: PDF export images now properly embedded
- Windows: PDF export unicode checkboxes render correctly
- Windows: Word export line-ending compatibility

### Technical
- Bundle size increased by ~2.3MB (React Flow + ELKjs)
- Feature flagged as `ritemark-flows` (enabled by default)

---

## [1.1.1] - 2026-01-30

### Added
- Insert images from files with `/image` command
- Image resize handles with actual file resizing
- Stale file indicator with Refresh button
- Blockquote button in bubble menu

### Changed
- Removed table button from bubble menu (still available via `/table`)

### Fixed
- Image filenames with special characters
- Empty paragraphs around images

---

## [1.1.0] - 2026-01-26

### Added
- Document Search with RAG (Retrieval-Augmented Generation)
- Natural language queries about your documents
- Source citations in AI responses
- Local vector database using Orama

---

## [1.0.3] - 2026-01-15

### Added
- Estonian voice dictation with local Whisper model
- Voice Dictation button in editor toolbar
- Dictation Settings dialog for language/model selection

---

## [1.0.2] - 2026-01-13

### Added
- Excel file preview with multi-sheet support
- Spreadsheet toolbar with "Open in Excel/Numbers" integration
- Extension-only lightweight updates system

---

## [1.0.1] - 2026-01-11

### Added
- Document header with Properties and Export buttons
- PDF export functionality
- Word (.docx) export functionality
- CSV file viewing and inline editing
- Auto-update notification system
- Virtual scrolling for large CSV files (up to 10,000 rows)

### Changed
- Properties modal now properly shows dropdown menus

### Fixed
- Better handling of documents without YAML front-matter

---

## [1.0.0] - 2026-01-10

Initial release of Ritemark Native.

### Added
- TipTap-based WYSIWYG markdown editor
- Full markdown syntax support
- Auto-save with 1 second delay
- AI chat sidebar (Cmd+Shift+A)
- Text rephrasing and improvement tools
- OpenAI API integration
- YAML front-matter editing
- Visual property editor (text, date, tags, status)
- GFM-compatible task lists with checkboxes
- Slash command `/task` for quick task creation
- Drag handle for reordering blocks
- Delete button on hover for blocks
- Smart paste from web pages and Word/Google Docs
- Clean HTML-to-markdown conversion
- Custom Lucide-based file icon theme
- macOS DMG installer with drag-to-Applications

### Technical
- Base: VS Code OSS 1.94.0
- Platform: macOS (Apple Silicon)
- Sprints completed: 01-15

---

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 1.7.1 | 2026-05-25 | Minor | GitHub Copilot Chat first-class, AI Agent Browser Control (experimental), HTML resolver, clipboard + chat history fixes — macOS DMGs unnotarized this one time |
| 1.6.0 | 2026-04-28 | Minor | Agent Library, design refresh (Phosphor), inline ToC, dark mode, CSV→xlsx |
| 1.3.0 | 2026-02-06 | Major | PDF/DOCX preview, CSV enhancements, Claude Code node |
| 1.2.0 | 2026-02-02 | Major | Ritemark Flows - visual AI workflows |
| 1.1.1 | 2026-01-30 | Minor | Image handling improvements |
| 1.1.0 | 2026-01-26 | Minor | Document Search (RAG) |
| 1.0.3 | 2026-01-15 | Minor | Voice dictation |
| 1.0.2 | 2026-01-13 | Minor | Excel preview, lightweight updates |
| 1.0.1 | 2026-01-11 | Minor | Export, CSV preview, auto-update |
| 1.0.0 | 2026-01-10 | Major | Initial release |

---

## Links

- [Releases on GitHub](https://github.com/jarmo-productory/ritemark-public/releases)
- [Detailed release notes](./releases/)
