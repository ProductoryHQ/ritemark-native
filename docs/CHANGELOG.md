# Changelog

All notable changes to Ritemark Native are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — v1.8.6

> **In progress.** Sprint 102 — AI Transparency (#163); Sprint 103 — Truthful Agent Plans (#132, #161); Sprint 104 — Reliable Multi-Prompt Queue (#162); Sprint 105 — Comments Command Center (#164, #165); Sprint 106 — Home Launcher (#74). Later v1.8.6 sprints will extend this entry.

### Added
- **Home launcher (Sprint 106, #74).** A persistent Home view in the Activity Bar: one dominant **New document — Markdown (.md)** action plus New AI task, Open document, New table, and Open folder quick actions (all existing commands), and the workspace's recently modified documents. Flag-gated (`home-launcher`, default on) as a rollout kill-switch; extension-contributed placement (no shell patch)
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
