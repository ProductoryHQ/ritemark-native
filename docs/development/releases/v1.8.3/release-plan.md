# Release Plan — v1.8.3 Comment Callouts + Text-Work Fixes

**Status:** Planning (Phase 2 — sprint plans awaiting Jarmo's approval)
**Target:** v1.8.3
**GitHub milestone:** `v1.8.3` — to be created
**Release type:** Full DMG (shell-tier gate) — **forced by the #142 fix being in-scope; see Ship-Mechanism Constraint below**
**Release owner:** Jarmo
**Created:** 2026-07-14
**Depends on:** v1.8.2 (shipped, fully cross-platform live 2026-07-13/14)

## Release Thesis

v1.8.3 is a "better work with text" release with two thrusts:

1. **Comments (issue #81) — the headline feature.** Render Markdown comments (`<!-- -->` and a `///` shorthand) as a styled, non-exported editor callout, and extend that callout so a comment can be directly assigned to an AI agent (`<!-- @claude: ... -->`) with a one-click "Send to AI" action. This closes out a requirement Sprint 72 explicitly audited and deferred (`docs/development/sprints/sprint-72-markdown-navigation-annotations/research/comment-callout-audit.md`) because the `marked` → TipTap → Turndown pipeline drops HTML comments on save. Sprint 94 does the parser/round-trip work Sprint 72 scoped out, then builds the AI-assign layer on top.
2. **Text-work fixes bundled alongside.** Fix the seamless-update mechanism ([#142](https://github.com/ProductoryHQ/ritemark-native/issues/142)) so future extension-tier releases actually load, and clear two everyday text-work annoyances: attachment feedback in the chat composer ([#103](https://github.com/ProductoryHQ/ritemark-native/issues/103)) and Chat History sessions collapsing into one ([#135](https://github.com/ProductoryHQ/ritemark-native/issues/135)).

## User-Facing Headlines

1. **Private comments survive save** — `<!-- note -->` and `/// note` now round-trip losslessly through load/edit/save/copy-as-Markdown instead of being silently dropped.
2. **Comments look like comments** — a dimmed callout with a colored left border and a comment icon, not raw `<!-- -->` syntax in the editor.
3. **Comments never leak into exports** — PDF, Word, and any rendered/exported output always strip comment nodes.
4. **Assign a comment to an AI agent** — `<!-- @claude: fix this paragraph -->` renders as an assigned callout with an agent badge and a "Send to AI" button that hands the note + surrounding context straight to the existing AI sidebar.
5. **Seamless updates actually load** — the extension fast-lane is fixed (#142), so future extension-tier updates install and take effect instead of silently staying on the bundled version.
6. **Attachment feedback in chat** — attaching a `.md`/`.txt`/text file now shows a visible chip in the composer (#103).
7. **Chat History keeps every session** — distinct conversations are persisted separately instead of collapsing into one entry (#135).

## Ship-Mechanism Constraint (read before release)

v1.8.2's issue [#142](https://github.com/ProductoryHQ/ritemark-native/issues/142) is a semver pre-release ranking bug: an `X.Y.Z-ext.N` extension-tier release ranks **below** the bundled `X.Y.Z` and never loads (see `docs/development/releases/v1.8.2/release-plan.md`). **The fix for #142 is in this release (Sprint 95).** That means v1.8.3 itself **cannot** ship via the broken fast lane — you can't ship the fix for the broken lane through the broken lane. **v1.8.3 must ship as a full DMG release** (shell-tier gate: Gate 1 + Gate 2, notarization, 60-min hardening, Windows CI). This is consistent with the standing decision that the next release after v1.8.2 must be full-DMG. Only *after* v1.8.3 lands and the #142 fix is proven in prod does the `-ext.N` fast-lane become usable again for subsequent releases.

## Scope Envelope

### In scope

- **sprint-94-comment-callouts** (#81) — comment-callout core (custom TipTap comment node, `marked` extension, Turndown serializer, styled callout render, `///` shorthand, `Cmd+/` toggle, multi-line comments, export filtering) + AI-assign extension (`@agent:` mention syntax, assigned-callout badge, "Send to AI" action reusing the existing `agent-execute` plumbing, Resolve action). New `comment-callouts` feature flag (kill-switch). **Ships first** — headline feature, architectural.
- **sprint-95-text-work-fixes** (#142, #103, #135) — the bundled bugfix sprint, ships after Sprint 94 merges:
  - **#142** — fix the seamless extension-update semver bug so `X.Y.Z-ext.N` no longer ranks below the bundled `X.Y.Z` (the fix that restores the fast-lane for future releases; scoped in the Sprint 93 delivery path).
  - **#103** — chat composer shows a visible attachment chip for text/markdown/PDF files, not just images (`ChatInput.tsx` ~1051–1085).
  - **#135** — Chat History persists every distinct session separately instead of collapsing multiple conversations into one entry (needs investigation into session-ID reuse / overwriting save logic).

### Out of scope / explicitly deferred

- Threaded comments, replies, or multi-user collaboration metadata (unchanged from Sprint 72's Non-Requirements).
- Rich nested formatting (bold/italic/links) *inside* a comment body — MVP scope is plain-text comment content; see `../../sprints/sprint-94-comment-callouts/spec.md` Open Questions for the tradeoff and confirm before Phase 3.
- Auto-resolving a comment when the assigned agent finishes its turn (Resolve stays a manual action in this sprint).
- Any change to the `AgentRuntime` interface, a new webview↔host message type, or a fourth runtime — Layer 2 is explicitly scoped to reuse `agent-execute`.

## Sprint Map

| # | Sprint | Purpose | Issues | Tier | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | sprint-94-comment-callouts | Comment-callout round-trip core + AI-assign layer | #81 | extension (file scope) | v1.8.2 | Planning — awaiting sprint plan approval |
| 2 | sprint-95-text-work-fixes | Seamless-update fix + composer attachment feedback + Chat History persistence | #142, #103, #135 | #142 is shell-tier (`scripts/`/delivery path); #103/#135 extension | sprint-94 merged | Not yet drafted |

Release ships as a full DMG regardless (see Ship-Mechanism Constraint) — #142's shell-tier fix and the full-DMG requirement mean the whole release goes through the shell-tier gate.

## Feature-Complete Definition

- [ ] `<!-- -->` and `/// ` comments round-trip losslessly through load → edit → save → copy-as-Markdown.
- [ ] Comments render as a styled callout (dimmed, colored left border, comment icon), never as raw `<!-- -->`.
- [ ] `Cmd+/` toggles a selection into/out of a comment.
- [ ] Multi-line comments are supported and round-trip.
- [ ] Comments never appear in PDF export, Word export, or any rendered/exported HTML.
- [ ] `<!-- @claude: ... -->` (and `@codex`, `@opencode`) renders an assigned callout with an agent badge.
- [ ] "Send to AI" sends comment text + surrounding document context to the AI sidebar via the existing `agent-execute` message — no new runtime plumbing.
- [ ] Resolve removes the comment from the document.
- [ ] `comment-callouts` flag ships as a working kill-switch.
- [ ] `docs/development/architecture.md` updated (new flag gates a named architectural feature — triggers the Sprint Architecture Gate).
- [ ] **#142** — an `X.Y.Z-ext.N` extension update installs and actually loads over the bundled `X.Y.Z` (verified in a real prod build, the exact repro from the issue).
- [ ] **#103** — attaching a `.md`/`.txt`/PDF file shows a visible chip in the composer.
- [ ] **#135** — two distinct chat sessions in one project appear as two separate Chat History entries.
- [ ] Release ships as a **full DMG** (shell-tier gate: Gate 1 + Gate 2, notarization, 60-min hardening, Windows CI).

## Sprint / Issue / PR Tracker

| Sprint | Branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| sprint-94-comment-callouts | `sprint-94-comment-callouts` (not yet created — created only after Jarmo approves the sprint plan) | TBD | #81 | not started | not run | not drafted |
| sprint-95-text-work-fixes | `sprint-95-text-work-fixes` (not yet created) | TBD | #142, #103, #135 | not started | not run | not drafted |

## Risk Register

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| `marked` → TipTap → Turndown round-trip fidelity (the exact problem Sprint 72 deferred) | High | Audit-first: prove the `marked` custom-extension + TipTap node + Turndown rule round-trips fixtures (single-line, multi-line, `///`, literal `-->` inside content, comment adjacent to code fence) before Phase 3 implementation. See `../../sprints/sprint-94-comment-callouts/research/`. | Open — carried from Sprint 72 |
| `///` shorthand collides with the existing single-`/` `SlashCommands` trigger | Medium | Verify triple-slash-at-line-start does not fire the existing slash-command popup; scope the input rule tightly (regex anchored to line start, requires a space after `///`). | Open |
| `Cmd+/` may already be bound elsewhere (OS/VS Code/browser) | Medium | Verify in a real dev-mode session before committing to the shortcut; document a fallback if it's swallowed. | Open |
| `@agent:` mention syntax collides with the existing `@`-triggered `FileLinkSuggestions` popup when typing inside a comment | Medium | Scope `FileLinkSuggestions`'s trigger to skip when the cursor is inside a comment-callout node. | Open |
| #142 blocks the extension fast lane; v1.8.3 may need a full DMG release despite extension-tier file scope | Medium | Re-check #142 status at Phase 6; default to the full-DMG path if unresolved. | Open, tracked in v1.8.2 plan |
| New TipTap node + new flag triggers the Sprint Architecture Gate | Low | Update `docs/development/architecture.md` before sprint close (Sprint Map, Subsystem Map if a new pattern, flag registry note). | Open |
| #135 root cause unknown — could be session-ID reuse, debounced/overwriting save, or history-merge logic; scope may be larger than a one-line fix | Medium | Sprint 95 opens with an investigation task before committing to a fix; if root cause proves deep, split #135 out and ship #142/#103 without it rather than block the release. | Open |
| #142 fix can only be validated in a real prod DMG build (the bug does not reproduce in dev mode) | Medium | Verify the exact issue repro (install prod → publish `-ext.N` → update → confirm it loads) during Gate 1/Gate 2, not just via unit checks. | Open |

## Housekeeping

This release plan and sprint were drafted from GitHub issue #81's text as summarized in the sprint-manager task brief (this planning session's environment did not have `gh` CLI access to fetch the issue directly). **Re-verify against the live issue `gh issue view 81 --repo ProductoryHQ/ritemark-native` before or during Phase 2 approval** — if the issue text differs materially from this plan (especially the "Extension — assign comments to an AI agent" section added 2026-07-14), update `spec.md` before Phase 3 starts.
