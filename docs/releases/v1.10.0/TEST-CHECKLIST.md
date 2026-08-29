# Ritemark 1.10.0 Test Checklist

This checklist accumulates release evidence across Sprints 109–115 and focused release-candidate bug fixes.

## Current candidate record — 2026-08-25

- Source under review: `codex/v1.10.0-rc-prep` / PR #223; the Gate 1 artifact must be rebuilt from its merged `main` commit.
- Repository QA, release preflight, exact arm64 runtime verification, production build, bundled-extension checks, and Developer ID preview-app signing pass.
- Signed/un-notarized Gate 1 DMG: **not yet produced**. Finder's decorative layout timed out; the recorded deterministic `ditto`/`hdiutil` path is approved if Finder remains unresponsive, subject to every mounted-image hard check.
- Production dependency security: **pass** — extension and webview `npm audit --omit=dev` each report zero findings; SheetJS is pinned to the official `0.20.3` tarball and targeted spreadsheet/Markdown/Mermaid checks pass.

## Trusted Windows installation (Sprint 114)

- [ ] Manual Windows workflow passes content-based payload inventory, Productory signing, Inno setup/uninstaller signing, standard-user install, installed-tree/app-registration verification, and uninstall.
- [ ] Installer, versioned Store URL, and GitHub Release direct asset have one recorded SHA-256 and publisher `Productory Services OÜ`.
- [ ] Partner Center preprocessing and certification pass against `downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`.
- [ ] Kristiina's clean Windows 11 machine has Smart App Control On and no Ritemark-attributable Code Integrity 3076/3077 blocks through install, launch, representative native paths, and uninstall.
- [ ] Store-origin clean install passes; direct download remains secondary and documents signature/hash without security-bypass instructions.
- [ ] Jarmo explicitly clears Windows Gate 2 for the exact shipping hash; any rebuild resets this section.

## Durable conversations (Sprint 109)

- [x] New, Pinned, automatic active/recent/current, and All conversations rail order is stable.
- [x] Selecting a conversation does not reorder Recents.
- [x] Pin/Unpin, Rename, Delete, confirmation, and Undo preserve canonical identity.
- [x] The Delete confirmation stays inside the narrow Conversations pane with wrapped copy and actions that stack at extra-narrow widths; deletion shows native VS Code notifications with no custom in-panel snackbar, the toast auto-hides, and each displayed Undo remains valid after the panel closes (RunDev + screenshots, 2026-08-29).
- [x] Host-backed history remains current-project-only and survives reload.

## Conversation continuation (Sprint 110)

- [x] Opening/selecting a saved conversation performs no runtime resume or send.
- [x] Claude compatible descriptor selects SDK native resume; rejected native resume retries once with transcript fallback only before provider evidence.
- [x] Codex compatible descriptor selects `thread/resume`; successful `turn/start` is the acceptance receipt.
- [x] OpenCode checks ACP `sessionCapabilities.resume`, uses `session/resume`, and never calls `session/load`.
- [x] Runtime/project/version/model/policy/auth mismatch rejects native binding and keeps the transcript readable.
- [x] Fallback stays within 32,000 UTF-8 bytes, truncates deterministically, and discloses omitted messages.
- [x] Fallback excludes the newly accepted prompt, tools, approvals, partial/failed assistant text, hidden prompts, and attachment binary/content.
- [x] A previous unanswered prompt crosses Codex → Claude (and equivalent handoffs) as labelled context; only the new instruction is dispatched.
- [x] `not-sent → ambiguous → accepted` receipts are ordered, idempotent, and absent from webview projections.
- [x] Coverage advances only with a saved completed assistant final; failed/no-final paths invalidate only that runtime descriptor.
- [x] Choosing another runtime applies without a dialog, preserves draft text, stops an active prior run, starts nothing before Send, and keeps one canonical conversation ID.
- [x] Late callbacks from the superseded runtime cannot append output, change lifecycle, or advance a watermark.
- [x] Transcript-restored, truncated, context-unavailable, and runtime-unavailable copy is truthful and accessible; native restore is quiet.
- [x] Fresh-profile canary: empty legacy inventory establishes host authority before the first durable prompt is accepted.
- [x] Legacy cutover drains every bounded import batch; 205 records preserve `100 / 100 / 5` order, while an all-invalid non-empty inventory retains legacy authority.
- [x] Live dev R9: immediate runtime selection preserved the draft, opened no dialog, started nothing before Send, and rendered exactly one compact durable boundary without the old banner in the Ritemark demo workspace (Claude Sonnet 5 → Codex GPT-5.5, 2026-08-23).
- [x] Live cross-runtime semantic recall: Codex GPT-5.5 recovered Claude's synthetic probe phrase and exact prior question from bounded transcript context.
- [x] Live restart: the same canonical Claude + Codex transcript and context-restored boundary reappeared after a full desktop restart.
- [ ] Live authenticated restart: verify native semantic recall through the production UI for each available runtime.
- [ ] Failure injection: auth loss/runtime unavailable and ambiguous crash after transport but before final checkpoint.

These two live rows are intentionally retained for the post-Sprint 111/final release matrix because Sprint 111 changes the exact runtime binaries. Sprint 110 covers their deterministic adapter/controller policy paths and does not claim unrun production-UI evidence.

## Runtime refresh (Sprint 111)

- [x] Exact Codex 0.149.0, Claude Code 2.1.239, Claude Agent SDK 0.3.239, OpenCode 1.18.21, and ACP SDK 1.4.0 pins are recorded with official sources and licenses.
- [x] All nine darwin-arm64, darwin-x64, and win32-x64 runtime archives pass URL, SHA-256, archive-layout, and architecture validation.
- [x] Claude binary/SDK drift and an incomplete platform matrix fail the hard manifest validator.
- [x] Native darwin-arm64 fetch, version discovery, OpenCode permission gates, cancellation, and shared-process survival pass on the shipping pins.
- [x] Codex, Claude, and OpenCode continuation/restart plus two-conversation isolation probes pass on the shipping pins.
- [x] Codex optional `isBlocking` input metadata routes through the existing input contract; ACP 1.4.0 preserves the contained adapter boundary.
- [x] Native darwin-x64 and win32-x64 exact SDK compile, runtime fetch/checksum/architecture, and three-binary version smoke pass on final commit `3ef9e0c` ([matrix run](https://github.com/ProductoryHQ/ritemark-native/actions/runs/32701706388)).

## Composer thinking effort (Sprint 112)

- [x] Auto is the default, sends no initial override, and restores the captured runtime default after a warm manual choice.
- [x] Claude, Codex execute/plan, and ACP `thought_level` adapters map only advertised explicit levels and record requested/applied evidence.
- [x] Unsupported/unknown values are rejected; model changes invalidate an unavailable preference to Auto with user-visible copy.
- [x] Preferences remain conversation/runtime-scoped; accepted and queued turns keep immutable effort snapshots across switching and reload.
- [x] OpenCode remains lazy and exposes effort only after the live ACP session advertises compatible thought levels.
- [x] Feature-flag OFF omits the control without deleting saved preferences.
- [x] Native RunDev smoke: range drag, click/arrow operation, Auto checkbox, Escape/focus return, 300px sidebar collision, normal width, and 200% zoom geometry pass in `ritemark-demo` (2026-08-24).
- [x] Native range/checkbox names, value text, keyboard semantics, live status copy, and reduced-motion CSS contract are present; no bespoke slider keyboard behavior is used.

## Claude model identity (RC bug fix)

- [x] Live Claude 2.1.239 discovery resolves `default` and `opus[1m]` to one `claude-opus-5[1m]` catalog row while Fable, Sonnet, and Haiku remain distinct.
- [x] Persisted request aliases and canonical resolved IDs reconcile to the representative explicit request ID.
- [x] Alias-equivalent init identity stays quiet; a genuinely different actual model still produces **Model mismatch**.
- [x] The default row contains one visual `*` plus explicit screen-reader and tooltip copy.
- [x] At a 299 px AI-sidebar viewport, the closed permission control shows only its mode icon and the selected model receives the freed width; reopening the control still shows every full mode label.
- [x] At a 299 px AI-sidebar viewport, thinking effort shows only its level-aware icon; tooltip and accessible name retain the exact effort value and the opened control retains its full labels.
- [x] New conversation, conversation, and history buttons in the thread rail have a measured vertical gap of 4 px, including when the rail has no visible conversations; a pinned divider has 4 px clearance before and after its 1 px line.
- [ ] Verify the one-row picker and absence of a false mismatch in the final packaged release candidate.

## Transcribe Insights and speaker names (Sprint 113)

- [x] Auto/known/custom language contract, catalog search, custom normalization, fallback, invalid-wire, data-only prompt language, quote-fidelity instruction, and legacy-English provenance tests pass.
- [x] Insights-only Markdown, `.md` normalization, Windows-invalid names, primary/existing/case-alias rejection, exclusive-create race, write-failure cleanup, and transcript bytes/mtime isolation tests pass.
- [x] Full-name normalization, Unicode, empty rejection, transcript export, Insights prompt attribution, and interactive-target playback guards pass.
- [x] Runtime-policy tests confirm low extraction effort, no built-in SDK tools, no coding-agent setting sources, and unchanged default session behavior elsewhere.
- [x] Post-fix authenticated timing runs against the same 48-minute transcript complete in 27.2s and 15.2s versus the 3m43.5s baseline; the final run persists German output correctly. Timestamp-seek regression remains covered separately below.
- [ ] Manual custom-language generation preserves verbatim source quotes and working timestamp seeks; authenticated known-language German generation already passed, and Jarmo deferred this remaining custom call to release QA.
- [x] Manual save-dialog success creates a separate Estonian Insights Markdown snapshot and leaves the workbench primary action as **Save to document**.
- [ ] Manual save-dialog cancel, collision, primary-path refusal, optional Open action, and broader transcript-link isolation matrix pass.
- [ ] Manual keyboard, screen-reader labels, narrow rail, 200% zoom, light/dark/high-contrast, speaker-chip/gutter ellipsis, and full-name tooltip pass.

First draft PR #217 smoke on 2026-08-24 failed two checks: **Regenerate** preceded the language selector in DOM/tab order, and approximately 207% zoom produced `innerWidth=354` with `scrollWidth=1080`, clipping the editor. Local DOM-order and responsive-containment fixes plus automated regressions were completed; manual PR retest was still pending at that checkpoint, so the rows remained unchecked.

The first responsive-fix rerun passed keyboard order, horizontal containment, wider zoom, and long-name checks, but the exact `354×300` case still collapsed Insights to `clientHeight=0`, clipped focused rail controls, and showed a native orange **Regenerate** outline. A second local fix then bounded the upper chrome and rail scrollers, reserved two equal narrow pane rows, and applied the approved 4 px translucent indigo ring. Another manual rerun was still required at that checkpoint; the rows remained unchecked.

The final Electron rerun passes at exact `354×300` / DPR `4.147200107574463`: document/body/root stay exactly viewport-sized with zero document overflow; chrome is 150 px; pane rows are `74.9904px`; transcript and Insights use bounded independent scrollers; language, **Regenerate**, and **Create insights document** focus rectangles are wholly visible; and **Regenerate** has the 4 px translucent indigo ring with no orange native outline. `654×300` high zoom, `1400×766` desktop, and long-name ellipsis/full accessible-name checks also pass. The later live R6 smoke successfully created `KUMi AI arutelu - Risto Raaperiga-insights.md` as a separate Estonian snapshot while the workbench still showed **Save to document**. Authenticated known-language generation later passed in German; custom-language generation and the broader negative save/spoken/theme matrix remain explicit release-QA rows by owner decision.

## Reliable editor–disk synchronization (Sprint 115)

- [x] A generic external write appears in a focused open Markdown editor without close/reopen; a normal loaded view acknowledges in 5–75 ms in the observed run.
- [x] A visible CSV table applies a clean external write and acknowledges only after parsing/render scheduling, without a false header action.
- [x] Local-only typing with autosave off stays visible and quiet beyond the former ten-second timer while disk bytes remain unchanged.
- [x] True divergence preserves immutable local and disk snapshots beyond ten seconds and exposes only **Review changes**.
- [x] **Compare changes** opens read-only in-memory text inputs without recursively activating the custom editor.
- [x] **Use disk version** is one model edit; Cmd-Z restores the exact prior local snapshot as dirty while disk remains unchanged.
- [x] **Keep my version** rechecks the exact disk validator, persists the final conflict-time local snapshot, refreshes clean/etag state, and retains Undo.
- [x] Two visible views of one URI receive distinct epochs and both acknowledge; disposing one does not dispose the shared watcher/poll; a hidden view catches up when shown.
- [x] Exact ACK, wrong receipt, bounded 750 ms / 2.5 s / 5 s retry, stale revision, cross-session validation, dirty-initial-open, EOL/BOM, conflict-time typing, and visible-view resolution invariants pass deterministically.
- [ ] Force a real visible-webview receipt loss through the final release build and verify the five-second **Retry document update** path end to end.
- [ ] Repeat light/dark/high-contrast, keyboard-only, spoken screen-reader, and 200% zoom checks on the final release build.
- [ ] Repeat rename/delete/save-as, formatter, multi-root, rapid/large-file, previous-epoch, and exact Claude/Codex/ACP-origin write rows on the final release build.
- [ ] Inject a non-cooperating write during Keep-local resolution and record/accept the explicit last-writer boundary; local filesystem APIs provide no atomic content-hash CAS beyond the implemented immediate validator check and post-write verification.

## Automated gates

- [x] Extension TypeScript compile and bundle.
- [x] Webview TypeScript typecheck and production bundle.
- [x] Focused continuation, context-pack, controller/store, three-adapter, projection, presentation, and runtime-switch tests.
- [x] Complete conversation regression suite.
- [x] `./scripts/validate-qa.sh` on the final Sprint 110 branch (2026-08-23).
- [x] Sprint 110 fresh-profile migration+resume canary.
- [x] Sprint 111 exact-manifest validator, validator mutation tests, extension compile, focused runtime suites, and deterministic extension suite.
- [x] Sprint 112 official QA, focused effort/runtime suites, conversation regressions, extension compile, and webview typecheck/build (2026-08-24).
- [x] Sprint 115 focused state/protocol/delivery/reducer suite (26/26), extension compile, webview typecheck, production bundle, final-bundle Compare→Keep-local→Undo smoke, and official repository QA (final post-review automation rerun 2026-08-25).
- [x] Release preflight passes on clean synchronized `main` after all v1.10.0 sprints and focused RC fixes merge (2026-08-29).
- [ ] Final packaged migration+resume canary passes on the exact arm64 Gate 1 candidate.

## Remaining release scope

- [ ] Sprint 113 residual custom-language plus manual negative save-dialog, spoken screen-reader, and theme/high-contrast matrix; authenticated known-language generation and sprint closure already passed.
- [ ] Sprint 115 forced live receipt-loss plus residual accessibility/theme/lifecycle/runtime-origin release matrix.
- [ ] Final macOS arm64/x64 and Windows candidate gates.
