# v1.8.6 Test Checklist

**Status:** Draft — Sprint 102 complete; unchecked items carry into packaged-candidate QA  
**Release:** Ritemark v1.8.6 — Clear Start, Trustworthy AI  
**Sprint:** 102 — AI Transparency and Policy Alignment (#163)

## Automated checks

- [x] Webview TypeScript check passes
- [x] `aiDisclosure.test.ts` passes first-use, provider/runtime/model, and context-state cases
- [x] `runtimeSwitching.test.ts` passes OpenCode attachment and active-file exclusion regression cases
- [x] Webview production build passes
- [x] Ritemark-web lint passes with pre-existing warnings only
- [x] Ritemark-web production build includes both localized AI-information routes
- [x] Targeted Ritemark-web Playwright suite passes for EN/ET content, canonical/hreflang, and footer links
- [x] Full native `./scripts/validate-qa.sh`
- [ ] Full extension `npm test` exits cleanly — Sprint 102 tests pass, then the existing flow integration suite cannot resolve the standalone `vscode` module
- [x] Full Ritemark-web Playwright suite exits cleanly — 86/86 passed in CI mode against the production build

## Fresh profile

- [x] Open the AI sidebar before any previous Sprint 102 acknowledgement
- [x] Compact notice is visible before the first AI interaction and says the user is interacting with AI
- [x] Notice is non-blocking: runtime/model controls and composer remain usable
- [x] Acknowledge the notice; it does not return after reopening the view or reloading the window
- [x] The **AI information** button remains available after acknowledgement
- [x] The compact notice shows **Don’t show again** instead of an ambiguous close action, and selecting it preserves the existing one-time behavior

## Runtime and model identity

- [x] Claude Code shows `Claude Code`, `Anthropic`, and the selected Claude model
- [x] Codex shows `Codex`, `OpenAI`, and the selected Codex model
- [x] OpenCode shows `OpenCode`, the selected Google/OpenAI/Anthropic/OpenRouter route, and the selected model
- [x] Switching a runtime or model updates the open information dialog without reopening the sidebar
- [x] No cross-runtime stale model identifier is shown when a catalogue label exists

## Context disclosure

- [ ] Prompt and agent/tool context categories are always described
- [ ] Active-file row changes to present when a document is open
- [ ] Selected-text row changes to present when editor text is selected
- [ ] Attachment count/state changes when a file is added or removed
- [ ] Browser context is shown for a shared tab with Claude Code and Codex
- [x] Browser context is not shown for OpenCode
- [x] Removing the active-file chip excludes it from Claude, Codex, and OpenCode turn metadata/prompt setup
- [x] An OpenCode attachment reaches the ACP turn

## Reliability, analytics, and links

- [x] Dialog says AI can be inaccurate or incomplete and calls for review of facts, sources, calculations, commands, and file changes
- [x] Dialog distinguishes direct runtime/provider processing from anonymous Ritemark PostHog analytics
- [x] Dialog does not claim prompts or file contents always remain local
- [x] Ritemark AI information, Privacy, Terms, and provider links open successfully
- [x] The **AI information** link at the end of Ritemark Settings opens the live Ritemark page
- [x] Offline state does not hide the persistent AI-information entry

## Website and policy gate

- [x] `/en/support/guides/ai-information` builds and renders
- [x] `/et/tugi/guides/ai-information` builds and renders
- [x] Localized footer links point to the corresponding AI-information page
- [x] Jarmo/counsel approves the Productory Terms and Privacy wording
- [x] Approved EN/ET Productory Terms and Privacy pages are live
- [ ] Live policy links are verified from a packaged Ritemark candidate — release-execution gate, not a Sprint 102 blocker

## Sprint 103 — Truthful plans and activity state (dev-validated 2026-08-04; re-test on packaged candidate)

- [x] Composer shows Manual/Auto select + Plan chip; no Auto/Ask/Plan strip *(dev)*
- [x] Claude + Plan: plan card appears on the FIRST attempt; no "not in plan mode" recovery; workspace untouched before approval *(dev, trace-asserted)*
- [x] Plan card shows provenance, rendered markdown, "No files changed yet.", Approve & continue / Keep planning *(dev)*
- [x] Keep planning feedback produces a revised plan that honors the feedback (README.md untouched in repro) *(dev)*
- [x] Approve & continue executes in the same conversation; Plan chip auto-resets *(dev)*
- [x] Codex + Plan: plan thread `read-only` sandbox, continuation `workspace-write`; blocked plan-phase edit attempt does not change files *(dev, trace-asserted)*
- [x] Status line: "Needs your answer" / "Waiting for your review" while blocked; "Done in Xs" uses agent working time; "Modified N files" workspace-only *(dev)*
- [x] Autonomy switch Auto↔Manual keeps conversation memory *(dev)*
- [x] Cancel at plan review: card cleared, chip stays on, status not stuck in review *(dev + unit)*
- [ ] OpenCode selected: no Plan chip (needs BYOK-keyed profile — Jarmo)
- [ ] Dark + light pass on packaged candidate (dev pass done with Ritemark Dark — the slate/indigo theme; earlier "black skin" observation was VS Code default Dark+ applied by a mislabeled setting in the automation profile, not a theme regression)
- [ ] Old thread saved with mode "plan" opens as Auto + Plan chip on

## Visual parity gate (added 2026-08-05 — default-drift lesson)

- [ ] Launch the candidate on a **FRESH profile** (`--user-data-dir` to an empty dir) — never judge chrome from a seasoned profile; several renderings (aux tabs, tree, preview tabs) differ on first run.
- [ ] Side-by-side against the previous release, compare: Activity Bar order/icons, secondary-sidebar top strip (ICONS, not text), File menu contents, explorer tree (indent/selection), editor surface (hr spacing, fonts).
- [ ] Any unexplained difference = upstream default drift → pin the setting in `branding/product.json` `configurationDefaults` (live on desktop since patch 013).
