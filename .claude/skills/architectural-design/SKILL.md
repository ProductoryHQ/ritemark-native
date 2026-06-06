---
name: architectural-design
description: >
  Architectural decision-making for Ritemark Native — when a change is
  architectural, how to evaluate proposals against locked decisions, how
  to choose between approaches, and where to get authoritative context.
  Use when designing new subsystems, evaluating sprint scope, or deciding
  whether a change triggers the Sprint Architecture Gate.
allowed-tools: Read, Grep, Glob
metadata:
  version: 1.0.0
---

# Architectural Design

This skill is about making good architectural decisions for Ritemark Native — not cataloging project state. For current subsystem detail, open debt, and issue links, read `docs/development/architecture.md`. This skill teaches you how to use that document and how to think.

## When to Pull This Skill

- Sprint plan touches a new subsystem, a new cross-boundary message type, or a new interface
- A proposed approach conflicts with a locked decision (see below)
- A change feels "big" but you're not sure if it's architectural
- Choosing between two implementation approaches that have different structural implications
- Evaluating whether a new dependency is acceptable

---

## Step 1 — Is This Change Architectural?

A change is architectural if it does any of the following. If yes, `docs/development/architecture.md` must be updated before the sprint closes.

| Trigger | Example |
|---|---|
| Adds, removes, or renames a module at `src/<subsystem>/` level | Adding `src/runtime/`, removing `src/rag/` |
| Adds a new webview↔host message type crossing a subsystem boundary | New `agent-execute` replacing `ai-execute-agent` |
| Changes an interface that other subsystems depend on | Changing `AgentRuntime` interface signature |
| Changes the binary bundling manifest or `AgentRuntimeKind` enum | Adding a fourth runtime |
| Adds or removes a feature flag gating a named architectural feature | New flag for `browser-agent-control` |

If none of these apply, the change is implementation detail — no architecture doc update needed.

---

## Step 2 — Check Locked Decisions First

These are non-negotiable. Any proposal that violates one needs Jarmo's explicit approval before proceeding.

**VS Code as submodule, not fork.** All VS Code customizations go through patch files in `patches/vscode/`. Never edit the `vscode/` submodule tree directly. The cost of patches (brittleness on upstream bumps) is the accepted price of cheap upstream sync.

**Extension symlinked, not copied.** Edit only in `extensions/ritemark/src/`. The symlink into `vscode/extensions/ritemark` is applied at build time. Never edit the submodule copy.

**Webview is sandboxed.** The webview has no filesystem or Node access. Everything crosses `bridge.ts` via postMessage. Never give the webview direct FS access to "simplify" things. Hardening the boundary (typed protocol) is acceptable; dissolving it is not.

**Model IDs in one file.** All model identifiers live in `src/ai/modelConfig.ts`. Never hardcode model names elsewhere. Post-Sprint 79: this is literally true; pre-Sprint 79: it was aspirationally true.

**Flows are JSON + pluggable executors.** New automation capability = new node executor, not a new engine. `FlowExecutor` is not a runtime for agents; it runs single-shot node calls. Keep these shapes distinct.

**Features ON by default, gated by flags.** Never delete or stub code to disable a feature. Disable only via `src/features/flags.ts`. This rule exists because stubbing broke Settings in v1.3.0 and made all AI features unusable.

**Layout invariants owned by patch 002.** Sidebar, terminal, titlebar placement is contractual and enforced by the pre-commit hook. Do not regress these in unrelated work.

**darwin-arm64 is the primary target.** Apple Silicon first. x64/Windows are supported but secondary.

**Three distinct execution shapes.** Autonomous agent runtimes (Claude Code, Codex, ACP) and single-shot flow nodes are genuinely different. Unify their plumbing (shared interfaces, model config) but not their behavior. A flow node is not an agent session.

---

## Step 3 — Evaluating a Proposal

Ask these questions in order:

**1. Does it violate a locked decision?** If yes, stop. Bring to Jarmo.

**2. Does it add a new dependency?** Check: (a) is there already something in the codebase that does this? (b) will this dependency ship in the production app or stay dev-only? (c) does it add to the 180-package tree that's already too large (see [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105))? Prefer using what's already installed.

**3. Does it cross a layer boundary?** Changes that cross the webview↔host boundary, the extension↔VS Code boundary, or the host↔binary boundary need explicit protocol consideration (message type, error contract, cancellation).

**4. Does it grow `UnifiedViewProvider`?** Post-Sprint 79 target is ≤ 1100 LOC. Any change that adds runtime-specific logic directly to `UnifiedViewProvider` instead of to a runtime adapter is moving in the wrong direction.

**5. Is there an existing pattern to follow?** Before introducing a new structural pattern, check what already exists: approval gates, browser tool injection, file attachments. Prefer extending the existing pattern over inventing a parallel one. Two patterns for the same capability is how `codexBrowserTools.ts` happened.

**6. Is it reversible?** Prefer approaches where the sprint can be rolled back cleanly. If the change is irreversible (deletes code, changes a stored data format, renames a public API), note that explicitly in the sprint spec.

---

## Step 4 — Choosing Between Approaches

When two approaches are roughly equivalent in correctness, prefer:

- **Adapt, don't rewrite.** Wrap existing managers/classes rather than replacing their internals. Existing behavior stays intact; the adapter surface is what changes. This is how `ClaudeCodeRuntime`, `CodexRuntime`, and `AcpRuntime` wrap their existing managers in Sprint 79.

- **Incremental over big-bang.** Each workstream should be independently committable and not leave the codebase broken at intermediate states. If a workstream requires two other workstreams to be complete before anything works, that's a risk signal.

- **Audit before implementing.** For any requirement that touches an external binary or protocol (Codex JSON-RPC, ACP `initialize`, esbuild bundling), do the audit first and gate the implementation decision on audit results. Sprint 79 Phase 0 is the template.

- **Make it loud when broken.** Prefer approaches where errors surface immediately (build failure, type error, test failure) over approaches where errors are silent (wrong message type at runtime, 0-byte file that passes a size check).

---

## Where to Get More Context

| Question | Where to look |
|---|---|
| Current subsystem map and layer boundaries | `docs/development/architecture.md` — Subsystem Map, System Architecture Overview |
| Agent runtime detail (AS IS + TO BE) | `docs/development/architecture.md` — Agent Runtime Architecture |
| Open architectural debt and sequencing | `docs/development/architecture.md` — Open Architectural Debt (issue links) |
| Build commands, Node versions, patch gotchas | `.claude/skills/vscode-development/SKILL.md` |
| Patch rules (creating, updating, unused-imports trap) | `.claude/skills/vscode-development/PATCH-RULES.md` |
| Feature flag implementation | `.claude/skills/feature-flags/SKILL.md` |
| Layout invariants (patch 002 contract) | `.claude/skills/vscode-development/references/layout-invariants.md` |
| Post-sprint-79 architectural issues | GH #105 (esbuild), #106 (typed protocol), #107 (bundle size), #108 (build gate), #109 (model gateway), #97 (cross-runtime context) |
| Sprint architecture gate rule (enforcement) | `docs/development/architecture.md` — Sprint Architecture Gate |
