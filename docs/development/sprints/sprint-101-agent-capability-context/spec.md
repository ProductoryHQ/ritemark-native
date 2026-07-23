# Sprint 101 — Spec: Agent Capability Context

Status: DRAFT (awaiting Jarmo approval)
Track: SDD
Linked issue: #154 (primary)
Release: v1.8.5 (extension-tier code; ships in the shell-tier bundle sequenced LAST, 98→99→100→101)

## Problem

Ritemark's three agent runtimes (Claude Code, Codex, OpenCode) behave like generic
chat assistants rather than Ritemark-native collaborators. The concrete failure that
opened #154: asked to add a note/comment, the agent reached for a Markdown footnote
(`[^1]`) because it had no awareness of Ritemark's own comment carrier. The same class
of gap exists across every Ritemark-native affordance.

Underneath the behaviour gap is a plumbing gap. The capability description that would
fix this has no single home and no consistent delivery:

- **Claude Code** — receives capability text via `systemPrompt.append` (APPEND). Today
  its only standing prose is lifecycle rules; it lacks even the "you are a markdown
  editor, apply edits directly" framing that Codex has.
- **Codex** — has that framing in `CODEX_BASE_INSTRUCTIONS`, but `extraSystemPrompt`
  currently **REPLACES** it (`CodexRuntime.ts:206`). Because the only thing ever put in
  `extraSystemPrompt` today is the browser hint (Claude-only), Codex quietly loses its
  Ritemark-awareness the moment any capability text is added the naive way.
- **OpenCode/ACP** — has **no system-prompt mechanism at all**. `extraSystemPrompt` is
  never read (`AcpRuntime.ts`). Only a per-turn `[Currently editing: …]` preamble reaches it.

The documented asymmetry (`UnifiedViewProvider.ts:299-301`) is the direct cause: capability
context reaches only Claude today. Adding more prose on top of the append/replace mismatch
would make Codex **worse**, not better.

## Ground truth (verified — Phase 1 capability inventory + seam re-verification)

**The single most important fact:** an agent has exactly ONE way to change a document —
its file-editing tools writing the **markdown file on disk**. There is no MCP tool,
command, or protocol exposing comments, diagrams, slash commands, links, or export to an
agent. Every Ritemark-native feature is therefore either (a) something the agent achieves
by writing the right markdown/HTML bytes, or (b) a USER-ONLY editor-UI affordance the
agent cannot trigger. Getting that line right is the core of #154.

| Capability | Agent-facing? | On-disk / invoke form the agent must know |
|---|---|---|
| File edit | ✅ | Claude `Write`/`Edit`; Codex `apply_patch`; ACP `fs/write_text_file`. Edits the file on disk, not the live editor buffer. |
| Standalone / margin comment | ✅ (content) | `<!-- body -->` (HTML comment). **NOT** `///` (that is a live-editor input rule; on disk it is literal text). **NOT** a Markdown footnote. |
| Anchored comment | ✅ (content) | `<mark data-comment="note" data-comment-id="…" data-agent="…">anchored text</mark>` |
| Comment assignment | ✅ | body containing `@claude` / `@codex` / `@opencode` |
| Internal link | ✅ | plain relative-path Markdown link `[label](./file.md)`, `#anchor` same-doc. Must stay inside the workspace; no absolute paths, no `javascript:`/`data:`/`file:`. |
| Structural blocks (headings, lists, tables, code fences, dividers, mermaid) | ✅ | write the equivalent Markdown directly — no slash command needed. |
| Slash-command menu (`/`) | ❌ USER-ONLY | runs inside the editor; no agent channel. |
| Image insertion (`/image`) | ❌ USER-ONLY | opens a native file picker. |
| Diagrams (draw.io, `/diagram`) | ❌ effectively USER-ONLY | creates/edits `.drawio.svg` in a webview editor. Agent may *reference* an existing `./images/*.drawio.svg`, must not author/rewrite its content. |
| Export (PDF / DOCX) | ❌ USER-ONLY | header menu action; no agent surface. |
| Voice dictation | ❌ USER-ONLY | mic UI. |
| Integrated browser | ✅ (asymmetric today) | prefer the integrated-browser tools over shelling out to `open`/`xdg-open`. Claude: `mcp__ritemark_browser__*`; Codex: dynamic `ritemark_browser_*`; ACP: none. |
| File ops (create/rename/delete) | ✅ (bounded) | workspace-bounded, approval-gated. Never touch `.git`, `node_modules`, `.env*`, `*.pem`, `*.key`, `credentials*`, `secrets*`. |

**Selection semantics (two channels).** The rich webview selection block wraps the
selection in its surrounding window with sentinels
(`…contextBefore<<<SELECTION>>>selected<<</SELECTION>>>contextAfter…`) and is prepended
to the prompt. The agent must locate the edit target by matching the **full surrounding
window**, not the bare selected token (which may recur in frontmatter/headings). This is
already delivered via the webview block; the capability context reinforces it as standing guidance.

## Requirements

Each requirement has an ID, a statement, and acceptance criteria. IDs are stable; a
mid-sprint scope change adds a new ID rather than widening an existing one.

### R1 — Edit-mode applies changes directly
When acting in an editing context, the agent applies changes to the active file using its
file-editing tools rather than describing them in chat prose.
- **AC1.1** Every runtime's standing capability context states the markdown-editor role and
  "apply edits directly; do not paraphrase a wanted change in chat; briefly confirm what changed."
- **AC1.2** In a representative live run per runtime, a "change X to Y in this file" request
  results in a file edit, not a chat-only description.

### R2 — Selection-aware, context-safe editing
The agent uses the active selection and surrounding context correctly when relevant, without
leaking irrelevant/stale context into unrelated requests.
- **AC2.1** The capability context states the selection-window rule (match `contextBefore +
  selection + contextAfter`, not the bare token).
- **AC2.2** In a representative live run, a targeted change on a selected span edits only that
  span, not other occurrences of the same word.

### R3 — Document content vs. editor metadata distinction
The agent distinguishes Markdown document content from Ritemark-native editor metadata
(comments) and does not confuse the two.
- **AC3.1** The capability context names the on-disk comment carriers (`<!-- … -->` standalone,
  `<mark data-comment="…" …>…</mark>` anchored) and explicitly rules out footnotes and `///`.
- **AC3.2** It states the preservation rule: when rewriting surrounding prose, preserve existing
  `<!-- … -->` blocks and `<mark data-comment …>` wrappers verbatim, including
  `data-comment-id` and `data-agent`.
- **AC3.3** In a representative live run, "add a comment/note about X" produces a Ritemark comment
  carrier, not a footnote; and rewriting a paragraph that contains a comment preserves the comment.

### R4 — Native capability awareness
The agent knows about and reaches for Ritemark-native features when appropriate: comments,
internal links, structural blocks, diagrams, file operations, the integrated browser.
- **AC4.1** The capability context covers each agent-facing capability with its correct invoke
  form (per the Ground-truth table), and each USER-ONLY affordance labelled as such.
- **AC4.2** Internal-link guidance states relative-path Markdown links + the workspace-containment
  rule.
- **AC4.3** Browser guidance (prefer integrated-browser tools over `open`/`xdg-open`) reaches all
  runtimes that expose browser tools — no longer Claude-only.

### R5 — Honest fallback
When a requested capability genuinely isn't available to the agent, it says so plainly rather
than inventing support.
- **AC5.1** The capability context instructs the agent to state, for USER-ONLY affordances
  (export, `/diagram`, `/image`, voice), that the user performs them via the editor UI, and not
  to claim a fake mechanism.
- **AC5.2** In at least one deliberately-unsupported request per runtime (e.g. "export this to
  PDF"), the agent gives an honest fallback rather than fabricating a capability.

### R6 — Unified injection across runtimes
The append/replace asymmetry is resolved; all three runtimes receive materially the same
capability context, each through its own native mechanism.
- **AC6.1** Codex no longer silently drops its Ritemark-aware base when capability context is
  present (the fragile `?? REPLACE` at `CodexRuntime.ts:206` is removed via an equivalent
  structural fix — see technical-plan.md).
- **AC6.2** OpenCode/ACP receives the capability context via a per-turn injection path (it has no
  system prompt), injected once per session to avoid per-turn bloat.
- **AC6.3** The `UnifiedViewProvider.ts:299-301` asymmetry comment is updated to describe the
  fixed behaviour (no stale note describing an asymmetry that no longer exists).
- **AC6.4** Claude continues to receive the capability context via its existing append path, and
  now additionally carries the markdown-editor framing it previously lacked (no regression to its
  reliance on the per-selection block).

### R7 — Single-source maintainability
Capability-context text lives in exactly ONE shared module; adding a capability to Ritemark
requires editing that one module, not three runtime-specific files.
- **AC7.1** A single module (`src/ai/capabilityContext.ts`) is the sole source of the capability
  prose. Runtime files import a rendered string; they do not carry their own capability copy.
- **AC7.2** A maintainability dry-run (add a placeholder capability to the module only) is shown to
  surface in all three runtimes without touching runtime-specific files; the placeholder is
  reverted before ship.

## Non-requirements (explicit)

- Full resolution of #97 (shared conversation *state* across different runtimes). This sprint
  unifies the capability *description*, not conversation state.
- Redesigning the underlying capabilities (comment model, draw.io integration, etc.). This sprint
  describes existing capabilities accurately; it adds none.
- A user-facing settings UI for capability context. This is prompt-engineering + plumbing.
- Authoring draw.io SVG content programmatically (out of scope; agent references existing diagrams,
  does not create them).

## Resolved questions

- **Feature flag?** NO. This is prompt content + prompt plumbing, reversible by a straight revert
  of the shared module and the two adapter fixes. No persisted state, no schema change, no
  broken-on-rollback risk (unlike Sprint 99's store reshape). Revisit only if the Codex
  base-instructions fix is found to change tool-use behaviour non-trivially (it is not expected to —
  the new base is a superset of the old).
- **Module location?** `src/ai/` (shared AI knowledge, parallel to `modelConfig.ts`), already
  imported across `src/agent`, `src/codex`, `src/views`. Not a new subsystem → not a Sprint
  Architecture Gate change. `docs/development/architecture.md`'s agent-runtime section gets a light
  update to describe the unified capability context (recommended, not gate-blocking).
- **Per-runtime tool naming?** The shared module is parameterised by a small runtime descriptor
  (edit-tool name: `Write`/`Edit` vs `apply_patch` vs `fs/write_text_file`; whether browser tools
  are present). This is a binding detail, not capability content — adding a capability still edits
  only the module, so R7 holds.

## Success criteria (from sprint-plan, mapped to R-IDs)

- [ ] Agents pick the correct native capability for representative requests, all three runtimes — R4
- [ ] Edit-mode requests apply to the file, not chat — R1
- [ ] Selection + surrounding context used correctly and safely — R2
- [ ] Content vs. editor-metadata (comments) distinguished — R3
- [ ] Honest fallback on a genuinely-unsupported request, ≥1 case per runtime — R5
- [ ] Codex `extraSystemPrompt` no longer REPLACES its base; browser hint reaches Codex — R6
- [ ] OpenCode/ACP receives equivalent capability-context injection — R6
- [ ] Capability text in exactly one module; dry-run proves single-source — R7
- [ ] architecture.md updated if determined a gate change (determination: NOT a gate change; light
      doc update recommended) — R7
