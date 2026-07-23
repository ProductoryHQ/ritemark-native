# Sprint 94 Technical Plan

> **Revision 2 (2026-07-14).** Reworked after (a) the UI shifted from an inline-callout to a **margin-anchored comment model** (see [`ui-mock.html`](ui-mock.html) — the authoritative UI contract, "UI as requirements" per Jarmo), and (b) a Codex review. The Codex-response table is at the end; the fixes are folded into the workstreams below.

## UI Requirement (authoritative: `ui-mock.html`)

The interactive mock is the UI spec. Two ways to create a note, two visual results:

1. **Anchored comment** — select text → the real formatting toolbar (reproduced from `FormattingBubbleMenu.tsx`) shows an **icon + "Comment"** action → a simple bubble opens in the **right margin** → type the note, Enter saves. The anchored span gets a **soft-yellow highlight**; a **marker** sits in the right margin, vertically aligned to the line. Hover/click the marker → the note bubble (read, **Send to AI** if assigned, **delete**).
2. **`///` quick note** — type `/// note text` at line start → Enter lifts the line out of the body into a **standalone margin note** (no text highlight). Bare `///` → Enter opens an empty margin bubble.

Assignment is inline: an `@claude` / `@codex` / `@opencode` token anywhere in the note body marks it assigned (agent badge + Send to AI). Colour: the comment yellow (`#FEF3C7` highlight / `#F59E0B` marker) is a **functional exception** to the indigo-only rule — Jarmo-approved; record it in `ritemark-design/references/components.md` "Exceptions" before build.

This replaces the earlier inline-`<ritemark-comment>`-callout rendering. The **storage/round-trip pipeline below is largely unchanged** for standalone notes; anchored notes add a mark.

## Architecture Overview

Webview layer (Layer 4) is the bulk, plus: one feature-flag entry (Layer 3) **and** new webview↔host relay messages for Send-to-AI (see Workstream 5 — the earlier plan's "no new message type" claim was wrong). No VS Code patches, no submodule, no shell-tier path.

Two note kinds → two TipTap primitives → two storage forms:

| Kind | Editor primitive | On disk | Rendered by |
|---|---|---|---|
| Anchored (select → Comment) | a **Mark** on the text range | `<mark data-comment="…" [data-agent="…"]>span</mark>` (note carried in the attribute, attribute-escaped) | yellow highlight in text + a margin-rail marker |
| Standalone (`///`) | a **block Node** | `<!-- body -->` / `<!-- @alias: body -->` (standard HTML comment) | a margin-rail marker only (no body highlight) |

Both are anchored visually by a **margin rail** React layer positioned alongside the editor (not an inline NodeView). The rail reads mark/node positions (`getBoundingClientRect`) and lays out markers/bubbles, matching the mock.

**Encoding decision (Phase-0 gate, the crux).** The anchored note lives in the `<mark>`'s `data-comment` attribute (single token — no orphan-comment sync, no id-matching). The mock's storage panel illustrates an id-matched `<mark>` + trailing `<!-- comment cN … -->` variant; that is the alternative if a *fully invisible* note in other Markdown tools is required. **Prove one of these round-trips losslessly (incl. XSS/`-->`/code-fence fixtures) before writing feature code** — this is exactly the gap that deferred Sprint 72.

Components touched:

- `extensions/ritemark/webview/src/extensions/` — new anchored-comment **Mark** + standalone-comment **Node** + input rule (`///`) + `Cmd+/` toggle.
- `extensions/ritemark/webview/src/components/` — new **margin-rail** React layer (markers, compose bubble, read/delete bubble) mounted in the editor view; uses `ui/button` shadcn, never hand-rolled.
- `extensions/ritemark/webview/src/utils/turndownService.ts` — serializer rules for both the mark and the node (existing shared chokepoint).
- `marked` load path (`Editor.tsx` ~346, ~772) — a shared configured `marked` instance + a comment tokenizer extension (introduce the shared instance if absent, so both call sites get it).
- Export chokepoint — confirmed: `extensions/ritemark/src/export/v2/htmlPipeline.ts:73` is the shared PDF/Word HTML step (Codex confirmed). Strip comment marks/nodes there, once.
- `extensions/ritemark/src/features/flags.ts` — new `comment-callouts` flag (see Workstream 7 — `experimental`, not `stable`).
- Editor host + sidebar host + sidebar store — the Send-to-AI relay (Workstream 5).
- `extensions/ritemark/webview/src/extensions/FileLinkSuggestions.tsx` — guard so `@` inside a comment note doesn't open file-search.
- `docs/development/architecture.md` — updated before close (flag + new markdown-pipeline pattern + new relay messages trip the Architecture Gate).

## The Round-Trip + Security Problem (the crux)

Per the Sprint 72 audit, two gaps must both close, plus Codex's security additions:

1. **Load gap:** ProseMirror can't select raw DOM `Comment` nodes, so a `parseHTML` rule can't recover `<!-- -->` from `marked()` output.
2. **Save gap:** Turndown drops HTML comments by default.

**Standalone notes** — a custom **`marked` tokenizer** (not a regex pre-pass) recognizes `<!--([\s\S]*?)-->` as its own token via `marked.use({ extensions:[…] })`. Because it runs inside `marked`'s tokenizer, fenced-code contents are consumed by the code-block tokenizer first and never reach it (keeps `<!-- not a comment -->` inside a fence intact). It renders a stable `<ritemark-comment>` element (selectable by a TipTap `parseHTML` tag rule). Turndown rule re-emits `<!-- body -->` / `<!-- @alias: body -->`.

**Anchored notes** — `<mark data-comment>` is already a real element: `marked` passes it through, a TipTap **Mark** `parseHTML` reads `data-comment`/`data-agent`, and a Turndown rule re-emits the `<mark>`. No tokenizer needed for these.

**Security (Codex #4 — accepted):**
- The comment body written into `<ritemark-comment>` text or the `data-comment` attribute **must be escaped** (element-text escape / attribute escape respectively) so a body containing `<`, `>`, `"`, or `-->` cannot break out of its container or inject markup.
- **The original body text is the single source of truth.** `@alias`/assigned state is *derived* from the body at parse time, not reconstructed from a separate `data-agent` attribute — the attribute is a cache for rendering, never the authority.
- A literal `-->` in a note body is **rejected visibly to the user** (input-rule / paste rejection with a hint), never silently stripped — silent stripping is data loss.

## Workstream 1 — Anchored comment Mark + margin rail (R1, R3, R6)

- **`CommentMark`** (`Mark.create`): attrs `{ id, note, agentAlias }`; `parseHTML` matches `mark[data-comment]`; `renderHTML` → `<mark data-comment="<escaped note>" data-agent?>`; adds the yellow-highlight class in the editor.
- **Margin rail** React component: subscribes to editor transactions, finds all `CommentMark` ranges + standalone nodes, positions a marker per note (collision-resolved, as in the mock), renders compose/read bubbles. All buttons `ui/button`.
- Gated on `isEnabled('comment-callouts')` from the `load.features` payload (R11) — if off, the Mark/Node extensions and the rail are not registered at all (highest-level gate).

## Workstream 2 — Standalone `///` Node + `Cmd+/` toggle (R2, R4, R5)

- **`CommentNode`** wrapper node. **Content model: `block+`** (Codex #2 — accepted): `content: 'text*'` cannot hold or wrap a multi-paragraph selection, which R (spec.md multi-line requirement) and `Cmd+/` toggling of a multi-block selection both need. Plain-text-only (Open Question 1) becomes a *paste/input sanitizer* on this node, decoupled from the content model.
- `///` input rule: anchored `^\/\/\/\s`, line-start only; lifts the line into a standalone note (matches the mock). Verify it doesn't let the single-`/` `SlashCommands` popup swallow the third `/` (audit item).
- `Cmd+/`: `addKeyboardShortcuts` toggling the selection into/out of a comment; verify no OS/VS Code-webview capture in a real dev session.

## Workstream 3 — Export filtering (R7)

Confirmed single chokepoint `export/v2/htmlPipeline.ts:73` feeds both PDF and Word. Strip `CommentMark` (unwrap — keep the anchored text) and remove `CommentNode` standalone notes there, once, before either exporter runs. Fixture-test the output file for zero trace.

## Workstream 4 — Mention syntax + assigned state (R8)

- Parse `@alias` from the **body** (source of truth) at the single point where a mark/node is created or edited; `agentAlias` attr is a derived render cache.
- Alias→AgentId map colocated with the extension: `{ claude:'claude-code', codex:'codex', opencode:'opencode' }`; unknown alias → plain (unassigned) note.
- `FileLinkSuggestions.tsx` guard: skip the `@` file-search popup when the cursor's node/mark context is a comment.

## Workstream 5 — Send to AI, via a real relay (R9) — Codex #1, accepted

The editor webview and the AI sidebar are **separate webviews** (`main.tsx:103`); a raw `agent-execute` posted from the editor never reaches `UnifiedViewProvider`, and the sidebar store must run its own state update before dispatch (`store.ts:419`). So Send-to-AI needs a relay, not a direct message:

```
editor webview  --comment:send-to-ai-->  RitemarkEditorProvider (host)
                --forward-->              UnifiedViewProvider (host)  [reveals the sidebar view]
                --comment:submit-->       AI-sidebar webview
                                          store.sendAgentMessage / sendCodexMessage  (existing action)
                                          --> agent-execute  (existing runtime message, unchanged)
```

- New **webview messages**: `comment:send-to-ai` (editor→host) and `comment:submit` (host→sidebar). No new **runtime** plumbing — the terminal dispatch is still the existing `sendAgentMessage`-family action → `agent-execute`, routed to the mentioned agent via the existing `agentId` field even if it differs from the sidebar's active runtime.
- Context: reuse the existing "selected text" context mechanism, scoped to the comment's anchored span (anchored) or containing block (standalone).

## Workstream 6 — Delete / resolve (R10)

- Anchored: remove the `CommentMark` from its range (text stays); Standalone: delete the `CommentNode`. Both are editor transactions, undoable via TipTap history. No host message.

## Workstream 7 — Feature flag as a real kill-switch (R11) — Codex #3, accepted

- Add `'comment-callouts'` as **`status: 'experimental'`** (not `stable` — a `stable` flag is hardcoded `true` in `featureGate.ts:51` and can only be turned off by a rebuild, so it is not a runtime kill-switch).
- Default **on**, via a native Settings key defaulting `true`, so it can be flipped without a release if the round-trip regresses in the wild.
- Delivered to the editor through the **existing `load.features` payload** (Codex correction — there is no `features:state` broadcast; the editor reads flags from `load.features`).
- Webview gates the entire extension + rail registration on the flag.

## Sequencing — one sprint, two strict gates (Codex recommendation, accepted)

**Gate A — lossless comment core.** Marks + nodes + `marked` tokenizer + Turndown rules + export strip + the margin-rail create/read/delete UI, with **full automated round-trip + XSS + `-->` + code-fence + export fixtures green**. No AI assignment yet. This is where Sprint 72's risk lives; it must be proven before anything is built on top.

**Gate B — AI assignment.** `@alias` parsing, agent badge, the Send-to-AI relay, view reveal. Built only after Gate A is green.

## Tests

Automated: `marked` tokenizer (single/multi-line, inside-fence-must-not-convert, adjacent comments, body with `-->`); Turndown round-trip for both mark and node (stability, alias preservation, escaping, `-->` rejection); anchored-mark load/save; alias mapping (known + unknown); `///` input-rule boundaries; **XSS fixtures** (body with `<script>`, `"`, `</mark>`, `-->`).

Manual QA (mirrors `scenarios.md`): full load/edit/save/copy cycle (anchored + standalone, single + multi-line); PDF + Word export inspected for zero trace; `Cmd+/` in dev mode; every alias + unknown alias; Send-to-AI end-to-end sidebar-closed→open→prompt-received; flag-off fallback.

## Codex review — response

| # | Codex point | Verdict | Action |
|---|---|---|---|
| 1 | Send-to-AI can't reach the sidebar (separate webviews); needs a relay, so new webview messages ARE required — plan line 5 wrong | **Accept** | Workstream 5 rewritten with the relay; Architecture Overview + Gate self-check corrected |
| 2 | `content: 'text*'` can't hold/wrap multi-paragraph | **Accept** | Workstream 2 → wrapper node `block+`; plain-text via sanitizer |
| 3 | `stable` flag isn't a runtime kill-switch; no `features:state`, editor uses `load.features` | **Accept** | Workstream 7 → `experimental` + Settings key + `load.features` |
| 4 | Round-trip lacks HTML-escaping; body should be source of truth; `-->` must be rejected visibly | **Accept** | Security section added; folded into Workstreams 1/2/4 |
| 5 | Move sprint to `docs/development/releases/v1.8.3/sprint-94-…/` | **Reject** | Contradicts Jarmo's explicit in-session instruction to keep sprints in `docs/development/sprints/` (he moved it there himself; recorded in memory `feedback-sprint-doc-location`). Jarmo's direction overrides the review. Milestone creation is a valid minor follow-up. |
| — | Keep one sprint, two strict gates (core → assignment) | **Accept** | "Sequencing" section above |

## Architecture Gate Self-Check

| Trigger | Applies? |
|---|---|
| New module at `src/<subsystem>/` level | No — new files within existing `webview/src/extensions/` + `components/`. |
| New webview↔host message type crossing a subsystem boundary | **Yes (revised)** — `comment:send-to-ai` + `comment:submit` relay (Workstream 5). Does not change the `AgentRuntime` interface. |
| Changes an interface other subsystems depend on | No — `AgentRuntime` untouched. |
| Changes bundling manifest / `AgentRuntimeKind` | No. |
| Feature flag gating a named architectural feature | **Yes** — `comment-callouts`. |

**Conclusion:** trips the Gate on two rows. `docs/development/architecture.md` gets: a Version-History entry, a note on the new relay messages, and (if the shared `marked`-instance becomes a reusable pattern) a Markdown-Pipeline note. Tracked in `tasks.md`.

## Routing

- **`ux-expert`** — the margin-rail marker/bubble visuals are now built and captured in `ui-mock.html`; consult only if deviating from it.
- **`webview-expert`** — if the `marked` shared-instance refactor, the Mark/Node, or the rail positioning hit Vite/TipTap issues.
- **`qa-validator`** — Gate A green, and again at Phase 4→5 / prod gate.
