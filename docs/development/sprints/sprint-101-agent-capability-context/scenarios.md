# Sprint 101 — Scenarios

Status: DRAFT (awaiting Jarmo approval)

Each scenario names the requirement it exercises and whether it is **unit-testable**
(deterministic, no live agent) or **live** (requires a running runtime; spot-checked in
dev-mode / CDP, honestly labelled as non-exhaustive).

Legend: `[U]` unit-testable plumbing · `[L]` live-behaviour spot check.

---

## R1 — Edit-mode applies changes directly

### S1.1 `[U]` Capability context carries the apply-directly framing
- **Given** the shared capability module rendered for any runtime descriptor
- **Then** the text contains the markdown-editor role and an "apply edits directly / do not
  paraphrase a wanted change / briefly confirm what changed" instruction.

### S1.2 `[L]` A change request edits the file
- **Given** an open `.md` file and a runtime session
- **When** the user says "change the title to 'Quarterly Review'"
- **Then** the file on disk changes and the reply confirms the change briefly — the agent does
  not merely print the new title in chat.
- Run once per runtime (Claude, Codex, OpenCode).

---

## R2 — Selection-aware, context-safe editing

### S2.1 `[U]` Capability context states the selection-window rule
- **Given** the rendered capability context
- **Then** it instructs matching `contextBefore + selection + contextAfter`, not the bare token.

### S2.2 `[L]` Targeted edit touches only the selected span
- **Given** a document where the word "draft" appears in the frontmatter and in a body paragraph,
  and the body occurrence is selected
- **When** the user says "make this bold"
- **Then** only the selected body occurrence changes; the frontmatter occurrence is untouched.

---

## R3 — Document content vs. editor metadata (the #154 core)

### S3.1 `[U]` Comment carriers named, footnote/`///` ruled out
- **Given** the rendered capability context
- **Then** it names `<!-- … -->` (standalone) and `<mark data-comment="…" …>…</mark>` (anchored)
  as the comment carriers, **and** explicitly says a Markdown footnote (`[^1]`) is NOT a Ritemark
  comment **and** `///` is a live-editor input rule that becomes literal text on disk.

### S3.2 `[U]` Preservation rule present
- **Given** the rendered capability context
- **Then** it states that existing `<!-- … -->` and `<mark data-comment …>` must be preserved
  verbatim (including `data-comment-id` and `data-agent`) when rewriting surrounding prose.

### S3.3 `[L]` "Add a comment" produces a Ritemark carrier
- **When** the user says "add a note next to this paragraph: needs a source"
- **Then** the agent writes `<!-- needs a source -->` (or an anchored `<mark data-comment>`), not a
  `[^1]` footnote and not `///`.

### S3.4 `[L]` Rewriting prose preserves an embedded comment
- **Given** a paragraph containing `<mark data-comment="check this" data-comment-id="c1">the claim</mark>`
- **When** the user says "tighten this paragraph"
- **Then** the rewritten paragraph still contains the `<mark data-comment … data-comment-id="c1">`
  wrapper.

---

## R4 — Native capability awareness

### S4.1 `[U]` Every capability covered with correct label
- **Given** the rendered capability context
- **Then** it contains: comment carriers; relative-path internal links + workspace-containment;
  structural blocks as direct Markdown; USER-ONLY labels for slash menu / `/image` / `/diagram` /
  export / voice; integrated-browser preference; file-op bounds.

### S4.2 `[L]` Internal link uses relative Markdown
- **When** the user says "link the word 'roadmap' to roadmap.md"
- **Then** the agent writes `[roadmap](./roadmap.md)` (relative, in-workspace), not an absolute path
  or an invented wiki syntax.

### S4.3 `[U]` Browser preference reaches Codex + Claude
- **Given** the capability context rendered for the Claude descriptor and the Codex descriptor with
  browser tools present
- **Then** both contain the "prefer integrated-browser tools over open/xdg-open" guidance
  (regression guard against the old Claude-only asymmetry).

---

## R5 — Honest fallback

### S5.1 `[U]` Fallback instruction present
- **Given** the rendered capability context
- **Then** it instructs the agent to state that USER-ONLY affordances (export, `/diagram`, `/image`,
  voice) are performed by the user via the editor UI, and not to claim a fake mechanism.

### S5.2 `[L]` "Export to PDF" gets an honest answer
- **When** the user says "export this document to PDF"
- **Then** the agent explains that export is a user action via the editor's export menu and does not
  claim to have exported it or invent a tool.
- Run once per runtime.

---

## R6 — Unified injection

### S6.1 `[U]` Codex base is no longer replaced away
- **Given** a Codex session config with `extraSystemPrompt` = the capability context
- **Then** the composed `baseInstructions` contain the capability context (markdown-editor role +
  capabilities) — the old failure (browser-hint-only string replacing the Ritemark-aware base) can
  no longer occur.

### S6.2 `[U]` ACP injects capability context once per session
- **Given** a fresh ACP session with `extraSystemPrompt` set
- **When** the first turn's prompt text is built
- **Then** it is prefixed with the capability context; **and** the second turn's prompt text is not
  (once-per-session, not per-turn).

### S6.3 `[U]` Claude append still composes correctly
- **Given** a Claude session config with `extraSystemPrompt` set
- **Then** the mapped `extraSystemPromptAppend` carries the capability context and the composed
  append = safety + lifecycle/capability (no loss of safety prefix).

### S6.4 `[U]` Asymmetry comment updated
- **Given** `UnifiedViewProvider.ts` around the former `:299-301`
- **Then** the comment describes the unified behaviour, not the old append/replace asymmetry.

---

## R7 — Single-source maintainability

### S7.1 `[U]` One module owns the prose
- **Given** a grep for the capability strings (comment carrier, apply-directly, browser preference)
- **Then** they originate only in `src/ai/capabilityContext.ts`; runtime files import a rendered
  string and carry no capability copy of their own.

### S7.2 `[U]` Dry-run: placeholder capability surfaces everywhere
- **Given** a placeholder capability appended to the module's capability list
- **When** the context is rendered for all three runtime descriptors
- **Then** every rendering includes the placeholder — proving a new capability needs edits to the
  module only. (Placeholder is a test fixture / reverted before ship.)

---

## Coverage honesty note

`[U]` scenarios are the enforceable contract — they run in CI-style unit tests and gate the merge.
`[L]` scenarios are spot-checked in dev-mode across the three runtimes during Sprint Exit
self-validation; they demonstrate the behaviour on representative prompts but do **not** prove the
agent behaves correctly on every phrasing. Phase 3 will state exactly which `[L]` runs were
performed and on which models, and will not overclaim automated coverage of live agent behaviour.
