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
