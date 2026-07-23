# Sprint 94: Comment Callouts + AI Assign

Track: SDD (auto-detected: 10+ distinct user-facing requirements across two layers — styled callout render, `///` shorthand, `Cmd+/` toggle, multi-line support, export filtering, AI mention syntax, Send-to-AI, Resolve, feature flag; edge-case-heavy parser/round-trip domain already flagged risky by the Sprint 72 audit; multi-component flow spanning `marked` → TipTap → Turndown → export → AI sidebar)
Override with: "use plain full track" / this is already SDD per explicit issue scope
Release tier: extension
Branch: sprint-94-comment-callouts (not yet created — created only after Jarmo approves this plan, per the HARD sprint-branch gate)
Status: Phase 2 (PLAN) — awaiting Jarmo's approval

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth), R1–R11
- [scenarios.md](scenarios.md) — BDD examples, doubles as the manual QA matrix
- [technical-plan.md](technical-plan.md) — architecture, the round-trip approach, Architecture Gate self-check
- [tasks.md](tasks.md) — implementation tracker, Phase 0 (audit) through Phase 8 (closeout)
- [sprint-plan.md](sprint-plan.md) — this file (intent + status)
- [ui-mock.html](ui-mock.html) — UI/UX reference: how self-note and AI-assigned comment callouts render in the editor, on the real Indigo-Editorial tokens (open in a browser, or view the published Artifact)
- [research/carryover-audit-and-open-items.md](research/carryover-audit-and-open-items.md) — code-grounding review + new fixtures, carrying forward the Sprint 72 audit

## Goal

Ship GitHub issue #81: render Markdown comments as a styled, non-exported editor callout with lossless round-trip, then extend the callout so a comment can be directly assigned to an AI agent with a one-click "Send to AI" action.

## Linked Issues

- [#81] Comments: render Markdown comments as a styled callout (`///` shorthand + `<!-- -->` storage + toggle) — including the 2026-07-14 "Extension — assign comments to an AI agent" addition.

## MVP Scope

**Layer 1 — comment core:** custom TipTap comment node + matching `marked` extension + Turndown serializer rule so `<!-- -->` round-trips losslessly; styled callout rendering; `///` shorthand (canonicalized to `<!-- -->` on save); `Cmd+/` toggle; multi-line support; export filtering from PDF/Word/rendered output.

**Layer 2 — AI assign, built on Layer 1:** `<!-- @claude: ... -->` mention syntax renders an assigned callout with an agent badge; "Send to AI" reuses the existing `agent-execute` webview message path — no new runtime plumbing; Resolve removes the comment.

Full requirement detail lives in `spec.md` (R1–R11); this section is a summary only.

## Product Decisions

- **2026-07-14:** Use a `marked` custom tokenizer/renderer extension (not a raw-string regex pre-pass) for the load-side parser, because it inherits `marked`'s own fenced-code-block boundary tracking for free — protects against converting comment-like text inside code fences. Rationale: `research/carryover-audit-and-open-items.md`.
- **2026-07-14:** Comment body content is plain text only in this sprint's MVP (no nested bold/italic/links) — smaller TipTap schema, smaller Turndown surface. **Flagged as an open question for Jarmo** — the original Sprint 72 audit fixture included markdown-ish formatted text inside a comment; if Jarmo wants that preserved, this is a larger scope change. See `spec.md` Open Question 1.
- **2026-07-14:** `comment-callouts` feature flag proposed as `status: 'stable'` (default ON, kill-switch only) rather than `experimental`, because there is currently no Settings UI for users to opt into an experimental flag (per project memory) — an `experimental` flag here would ship permanently invisible. See `spec.md` Open Question 5.
- **2026-07-14:** Send-to-AI (R9) reuses the existing `agent-execute` message and `buildSelectionContextBlock`-style context assembly verbatim — explicitly chosen to avoid tripping the Sprint Architecture Gate on a new message type. Confirmed against `docs/development/architecture.md`'s Webview ↔ Extension Protocol section.

## Success Criteria

Mirrors `spec.md`'s acceptance criteria at high level — ticked only when observably met:

- [ ] `<!-- -->` and `///` comments round-trip losslessly through load/edit/save/copy-as-Markdown (R1, R2, R4).
- [ ] Comments render as a styled callout, never raw `<!-- -->` (R3).
- [ ] `Cmd+/` toggles a selection into/out of a comment (R5).
- [ ] Multi-line comments are supported (R6).
- [ ] Comments never appear in PDF/Word/rendered export output (R7).
- [ ] `<!-- @claude/@codex/@opencode: ... -->` renders an assigned callout with a badge (R8).
- [ ] "Send to AI" delivers the comment + context via the existing `agent-execute` path, no new message type (R9).
- [ ] Resolve removes a comment, undoable (R10).
- [ ] `comment-callouts` flag works as a kill-switch (R11).
- [ ] `docs/development/architecture.md` updated (Sprint Architecture Gate — new flag gates a named architectural feature).

## Pre-Implementation Gate

Before Phase 3 (branch + code) may start, ALL of the following must be true:

1. Jarmo has approved this sprint plan (explicit phrase: "approved" / "Jarmo approved" / "proceed").
2. Phase 0 audit items in `tasks.md` are complete — in particular, the `marked`-tokenizer spike must be empirically confirmed to solve the load-gap (or `technical-plan.md` Workstream 1 revised) and the `-->`-inside-content mitigation must be decided.
3. The Open Questions in `spec.md` (rich-content scope, mention aliases, Send-to-AI targeting conflict, Resolve confirmation UX, flag status, live-issue re-verification) are answered.
4. `git checkout -b sprint-94-comment-callouts` is run and verified with `git branch --show-current` — no code edits before this.

## Approval

- [ ] Jarmo approved this sprint plan
