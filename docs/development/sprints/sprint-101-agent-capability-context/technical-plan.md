# Sprint 101 — Technical Plan

Status: DRAFT (awaiting Jarmo approval)

## Overview

One shared module renders Ritemark's capability context as prose. Three runtime adapters
each deliver it through their own native mechanism. The `UnifiedViewProvider` selects the
per-runtime descriptor at the single existing config-assembly point and feeds the rendered
string into `RuntimeSessionConfig.extraSystemPrompt` for all three runtimes (today it is set
for Claude only).

```
                          src/ai/capabilityContext.ts          ← single source (R7)
                          renderCapabilityContext(descriptor)
                                     │
         UnifiedViewProvider.ts (per-conversation config assembly, knows agentId)
                                     │  extraSystemPrompt = renderCapabilityContext(descriptorFor(agentId))
             ┌───────────────────────┼───────────────────────┐
             ▼                       ▼                       ▼
     ClaudeCodeRuntime         CodexRuntime             AcpRuntime
     → extraSystemPromptAppend → baseInstructions        → per-turn prompt prefix
       (APPEND after safety)     (base = context;          (once per session; ACP has
                                  no fragile ?? replace)    no system-prompt concept)
```

## Verified seams (current line numbers)

| Seam | File:line | Current behaviour |
|---|---|---|
| Capability config assembly (single point) | `views/UnifiedViewProvider.ts:290-305` | builds one `RuntimeSessionConfig` per `createSession`, already branches on `isClaudeCode`/`isCodex`; sets `extraSystemPrompt` for Claude+browser only |
| Asymmetry comment | `views/UnifiedViewProvider.ts:299-301` | "APPENDED by Claude Code but REPLACES Codex's" |
| Browser hint const | `views/UnifiedViewProvider.ts:76` | `BROWSER_ROUTING_HINT` |
| Claude map | `agent/ClaudeCodeRuntime.ts:80` | `extraSystemPromptAppend: config.extraSystemPrompt` |
| Claude compose | `agent/AgentRunner.ts:824-827` | `fullAppend = safety + (\n\n + extraSystemPromptAppend)` |
| Claude standing prose | `agent/AgentRunner.ts:130-142` | `CLAUDE_LIFECYCLE_APPEND`, `CLAUDE_TURN_REMINDER` — no markdown-editor framing today |
| Codex base const | `codex/CodexRuntime.ts:41-47` | `CODEX_BASE_INSTRUCTIONS` (markdown-editor framing lives here) |
| Codex replace | `codex/CodexRuntime.ts:206` | `baseInstructions: config.extraSystemPrompt ?? CODEX_BASE_INSTRUCTIONS` ← the fragile REPLACE |
| ACP config store | `acp/AcpRuntime.ts:96-98` | `applyConfig` stores config; `extraSystemPrompt` never read |
| ACP per-turn injection | `acp/AcpRuntime.ts:109-113` | `[Currently editing: …]` prefix |
| Shared config field | `runtime/AgentRuntime.ts:66` | `extraSystemPrompt?: string` |

## 1. The shared module — `src/ai/capabilityContext.ts`

A structured capability list plus a pure renderer. No I/O, no VS Code imports → trivially
unit-testable.

```ts
export const CAPABILITY_CONTEXT_VERSION = 1;

/** Per-runtime binding details — NOT capability content (R7 stays intact). */
export interface CapabilityDescriptor {
  /** Human file-edit tool phrasing for this runtime. */
  editTool: string;              // 'the Write/Edit tools' | 'apply_patch' | 'the fs/write_text_file tool'
  /** Whether this runtime exposes integrated-browser tools (include browser guidance). */
  hasBrowserTools: boolean;
}

export const CLAUDE_DESCRIPTOR: CapabilityDescriptor = { editTool: 'the Write/Edit tools', hasBrowserTools: true };
export const CODEX_DESCRIPTOR:  CapabilityDescriptor = { editTool: 'apply_patch',            hasBrowserTools: true };
export const ACP_DESCRIPTOR:    CapabilityDescriptor = { editTool: 'the fs/write_text_file tool', hasBrowserTools: false };

interface CapabilitySection {
  id: string;
  render: (d: CapabilityDescriptor) => string | null;   // null → omitted for this descriptor
}

const SECTIONS: CapabilitySection[] = [ /* role, comments, links, blocks, user-only, browser, files, selection, fallback */ ];

export function renderCapabilityContext(d: CapabilityDescriptor): string {
  return SECTIONS.map(s => s.render(d)).filter(Boolean).join('\n\n');
}
```

**Content** (grounded in spec.md Ground-truth; verbatim carrier strings so unit tests can
assert them):

1. **Role** — "You are running inside Ritemark, a markdown editor (not a code IDE). Your one
   way to change a document is `${editTool}` writing the markdown file on disk. When the user
   wants a change to the active file, apply it directly with `${editTool}` — do not paraphrase
   the change in chat. After an edit, briefly confirm what changed rather than restating the new
   text." (subsumes the old `CODEX_BASE_INSTRUCTIONS` — now shared, so Claude gets it too, closing
   the regression gap the inventory flagged).
2. **Comments** — carriers `<!-- body -->` and `<mark data-comment="note" data-comment-id="…"
   data-agent="…">anchored text</mark>`; `@claude`/`@codex`/`@opencode` assigns; a Markdown
   footnote `[^1]` is NOT a comment; `///` is a live-editor input rule (literal text on disk);
   preserve existing carriers verbatim (incl. `data-comment-id`, `data-agent`) when rewriting prose.
3. **Internal links** — relative-path Markdown links `[label](./file.md)`, `#anchor` same-doc;
   must stay inside the workspace; no absolute paths, no `javascript:`/`data:`/`file:`.
4. **Structural blocks** — headings/lists/tables/code fences/dividers/mermaid: write the Markdown
   directly; no slash command needed.
5. **User-only** — the `/` menu, `/image`, `/diagram` (draw.io), PDF/DOCX export, and voice
   dictation are performed by the USER via the editor UI; you cannot trigger them. Existing
   `./images/*.drawio.svg` diagram references are user-authored assets — reference, do not rewrite.
6. **Browser** (only if `hasBrowserTools`) — prefer the integrated-browser tools over shelling out
   to `open`/`xdg-open`. (Subsumes `BROWSER_ROUTING_HINT`.)
7. **File ops** — create/rename/delete within the workspace, approval-gated; never touch
   `.git`, `node_modules`, `.env*`, `*.pem`, `*.key`, `credentials*`, `secrets*`.
8. **Selection** — when a selection block with `<<<SELECTION>>>` sentinels is present, edit that
   exact span located by its full surrounding window, not the bare token (it may recur elsewhere).
9. **Honest fallback** — if a requested capability genuinely isn't available to you, say so
   plainly; never invent or claim a feature Ritemark does not expose to agents.

## 2. Claude adapter — no behaviour change, richer content

`UnifiedViewProvider` sets `extraSystemPrompt = renderCapabilityContext(CLAUDE_DESCRIPTOR)`
(replacing the browser-hint-only value). Existing plumbing carries it:
`ClaudeCodeRuntime.ts:80` → `extraSystemPromptAppend` → `AgentRunner.ts:824-827`
`fullAppend = safety + '\n\n' + capabilityContext`. Claude's `CLAUDE_LIFECYCLE_APPEND` and
`CLAUDE_TURN_REMINDER` are untouched. Net: Claude now also carries the markdown-editor framing +
full capability awareness (AC6.4).

**No edit to AgentRunner.ts is required** beyond confirming compose order. Safety prefix stays first.

## 3. Codex adapter — remove the fragile REPLACE

`CodexRuntime.ts:206` today: `baseInstructions: config.extraSystemPrompt ?? CODEX_BASE_INSTRUCTIONS`.

**Fix (equivalent structural fix per AC6.1).** The shared capability context is a *superset* of
`CODEX_BASE_INSTRUCTIONS` (it contains the markdown-editor role that used to live only there).
So:
- `UnifiedViewProvider` sets `extraSystemPrompt = renderCapabilityContext(CODEX_DESCRIPTOR)` for
  Codex (today it is `undefined` for Codex).
- Extract a pure helper `buildCodexBaseInstructions(config)`:
  ```ts
  export function buildCodexBaseInstructions(extra: string | undefined): string {
    // capability context (when present) IS the base; it subsumes the legacy fallback.
    return extra && extra.trim() ? extra : CODEX_BASE_INSTRUCTIONS;
  }
  ```
  `CODEX_BASE_INSTRUCTIONS` is retained **only** as a defensive fallback for the (now unreachable
  in normal flow) case where `extraSystemPrompt` is absent. The fragility the plan flags — a
  browser-hint-only string silently wiping Ritemark-awareness — is gone, because the only thing now
  placed in `extraSystemPrompt` is the full capability context, and that context contains the
  role framing. Documented at the call site.
- Codex plan-mode `developerInstructions` (`CODEX_PLAN_DEVELOPER_INSTRUCTIONS`) is **unchanged** —
  orthogonal to base instructions.

This is a unit-testable pure function (S6.1).

> Alternative considered — literal string concatenation `CODEX_BASE_INSTRUCTIONS + '\n\n' + extra`.
> Rejected: it would duplicate the markdown-editor role (present in both), and it keeps
> `CODEX_BASE_INSTRUCTIONS` as live content that would drift from the shared module — violating R7.
> Making the shared context the single base keeps one source of truth.

## 4. ACP adapter — new per-turn injection, once per session

ACP has no system prompt. `AcpRuntime.ts` `AcpSession.prompt()` builds `promptText` (`:109-113`).
Add a once-per-session capability-context prefix:

- Add a private `_capabilityContextInjected = false` on `AcpSession`.
- In `prompt()`, before the `[Currently editing: …]` prefix, if `!_capabilityContextInjected` and
  `config.extraSystemPrompt` is set: prepend `config.extraSystemPrompt + '\n\n'` and set the flag.
- Extract a pure helper `buildAcpPromptText(turn, { capabilityContext })` returning the composed
  string, so S6.2 is unit-testable without a live process.

**Once-per-session, not per-turn:** the context is long; OpenCode retains earlier turn text in the
session, so first-turn injection persists. Tradeoff documented: in a very long session where
OpenCode compacts early context, capability awareness could fade — acceptable vs. per-turn token
bloat; revisit only if observed. `UnifiedViewProvider` sets
`extraSystemPrompt = renderCapabilityContext(ACP_DESCRIPTOR)` for OpenCode (browser section omitted,
since ACP exposes no browser tools).

## 5. UnifiedViewProvider — the single selection point

Replace the Claude-only browser-hint assignment (`:299-301`) with a per-runtime descriptor:

```ts
const capabilityDescriptor =
  isClaudeCode ? CLAUDE_DESCRIPTOR :
  isCodex      ? CODEX_DESCRIPTOR  :
                 ACP_DESCRIPTOR;
// Unified capability context: one source (src/ai/capabilityContext.ts), delivered through each
// runtime's own mechanism — Claude appends it, Codex uses it as base instructions, ACP injects it
// once per session. The old append/replace asymmetry (browser hint reached Claude only) is gone.
extraSystemPrompt: renderCapabilityContext(capabilityDescriptor),
```

`BROWSER_ROUTING_HINT` and the browser-tool `allowedTools` wiring (`:303-305`) stay — the browser
*tools* are still Claude-only via `allowedTools`, but the browser *guidance prose* now reaches every
browser-capable runtime through the descriptor's `hasBrowserTools`. `BROWSER_ROUTING_HINT` the const
can be removed once its text is fully absorbed into the module (confirm no other referent).

## 6. Architecture Gate determination

New file within the existing `src/ai/` subsystem, not a new subsystem → **NOT** a Sprint
Architecture Gate change. Recommended (non-blocking): add a short "Unified agent capability context"
note to `docs/development/architecture.md`'s agent-runtime section, mirroring the CLAUDE.md
locked-decision style (one source, three delivery mechanisms).

## 7. Test plan

### Unit (deterministic, gate the merge)
- `renderCapabilityContext` for each descriptor contains the invariant strings: `<!--`,
  `<mark data-comment`, footnote-ruled-out, `///`-ruled-out, apply-directly, relative-link +
  workspace-containment, user-only export/diagram, honest-fallback. Browser guidance present for
  Claude/Codex descriptors, absent for ACP. (S1.1, S2.1, S3.1, S3.2, S4.1, S4.3, S5.1)
- `buildCodexBaseInstructions(context)` returns the context (not the bare legacy fallback) when
  context present; returns `CODEX_BASE_INSTRUCTIONS` when absent. (S6.1)
- `buildAcpPromptText`: first call includes context, second call (flag set) does not. (S6.2)
- Claude map: `ClaudeCodeRuntime` maps `extraSystemPrompt → extraSystemPromptAppend`; compose helper
  keeps safety first. (S6.3)
- Single-source grep guard: capability strings appear only in `capabilityContext.ts`. (S7.1)
- Dry-run: appending a placeholder capability surfaces it in all three renderings. (S7.2)

### Live (dev-mode / CDP spot checks, honestly non-exhaustive)
- Per runtime: change-request edits file (S1.2); "add a note" → `<!-- -->` not footnote (S3.3);
  rewrite preserves embedded `<mark data-comment>` (S3.4); "link X to Y" → relative link (S4.2);
  "export to PDF" → honest fallback (S5.2).
- Record which runtimes/models were exercised; do not overclaim.

## 8. Risk register

- **Codex regression** — sessions that never set `extraSystemPrompt` still fall back to
  `CODEX_BASE_INSTRUCTIONS`; sessions that do now get a superset. Verify a normal Codex edit turn
  still applies edits (S1.2 Codex) — the base content is a superset, so behaviour should improve,
  not regress.
- **ACP context length** — first-turn prefix is long; verify it does not trip the 15-min turn
  timeout or a provider input limit on a small-context BYOK model. If it does, trim the ACP
  rendering (descriptor could carry a `terse` flag) rather than dropping sections.
- **Prompt dilution for Claude** — Claude's append grows. Keep the module tight; prefer imperative
  one-liners over prose paragraphs.
- **Sequencing** — lands after Sprint 99/100 (already merged). Seams re-verified against current
  `main`; line numbers above are post-99/100.
