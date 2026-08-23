# Sprint 109 rundev visual evidence

**Executed:** 2026-08-22–23 on macOS, clean Ritemark dev profile, Sprint 109 extension development path, CDP port 9224.

## Commands and environment

- Extension: `npm run compile`
- Webview: `npm run build`
- App: main VS Code OSS dev shell with `--extensionDevelopmentPath=<Sprint 109 worktree>/extensions/ritemark`, fresh `--user-data-dir`, isolated `/private/tmp` workspace, and remote debugging.
- Data: six synthetic canonical `ConversationStore` records in the isolated profile only (Needs you, Working, and four idle records).
- Automation: `agent-browser` over CDP plus macOS/Workbench screenshots.

## Verified

- Clean empty state renders the 56px rail with a 40×40 primary New target and borderless All conversations directly below the working set.
- After Developer: Reload Window, six host records reappear; the automatic rail shows Needs you, Working, and three recent idle entries without localStorage transcript ownership.
- Conversations overlays only the transcript/composer column; the native secondary-sidebar header and conversation rail remain visible.
- Panel rows show real title, lifecycle/timestamp, the shared 16px chat-bubble icon, Pinned and Active & recent sections, and no OPEN badge.
- Hovering a rail item shows one custom full-title/status tooltip and the separate 20×20 Pin action. Pinning moves the same canonical item to Pinned without opening or duplicating it.
- Follow-up review rejected generated multi-shape identity marks as unsuitable for Ritemark. Production uses one Phosphor duotone `chat-circle`; a restrained persisted color varies by conversation while indigo remains the selection surface.
- The final `ritemark-demo` pass showed four visible records in four distinct base hues. The same conversation kept its hue across rail, Conversations panel, selection changes, and Developer: Reload Window.
- Selecting `Export workflow notes` in live run-dev moved only the Current treatment. It remained below `Quarterly brief outline` at its real 5h activity position, proving selection did not promote or reorder Recents.
- Pinned shortcuts show a passive pin mark at rest. A 24px hairline separates the pinned group from automatically surfaced, non-pinned conversations.
- Hovering the pinned shortcut replaces the passive mark with the 20×20 Unpin action without shrinking the 40×40 conversation target.
- The right conversation rail now uses the same 16px primary glyph size as the left VS Code activity rail while retaining its larger safe click targets.
- After the 2026-08-23 title-policy scope change, row focus reveals Rename, Pin/Unpin, and Delete as three separate ghost actions without crowding or shifting the title row.
- Rename opens a compact indigo-editorial dialog while the 56px rail remains visible. A live typed-protocol roundtrip renamed `Older research summary` to `Manual title verification`; both the panel row and rail accessible label updated, then the fixture title was restored.
- The reloaded extension activated without a new Ritemark activation failure. Existing profile noise remains from unauthenticated GitHub Copilot, the known product-icon font-weight warning, and the pre-fix historic `pdfkit` activation entry.

## Evidence

- `/tmp/ritemark-s109-visual-shots/initial.png`
- `/tmp/ritemark-s109-visual-shots/ai-after-reload.png`
- `/tmp/ritemark-s109-visual-shots/final-panel.png`
- `/tmp/ritemark-s109-visual-shots/rail-hover.png`
- `/tmp/ritemark-s109-visual-shots/pinned.png`
- `/tmp/ritemark-s109-visual-shots/final-after-qa.png` — final post-QA panel and rail state after the approved symmetry correction.
- `/tmp/ritemark-s109-chat-bubbles-ai2.png` — production chat-bubble rail after the revised visual decision.
- `/tmp/ritemark-s109-chat-bubbles-stable-order2.png` — selection-neutral recent order with Export current in its existing position.
- `/tmp/ritemark-s109-balanced-rails-idle.png` — final idle state with visible pin, pinned/non-pinned divider, and matched 16px left/right rail glyphs.
- `/tmp/ritemark-s109-balanced-rails-hover.png` — pinned shortcut hover state with Unpin action and a single title/status tooltip.
- `/tmp/ritemark-s109-title-rename-panel.png` — host-backed Conversations panel after the title-policy build.
- `/tmp/ritemark-s109-title-row-actions.png` — keyboard focus reveals separate Rename, Pin, and Delete actions.
- `/tmp/ritemark-s109-title-rename-dialog.png` — live Rename dialog with the canonical title prefilled.
- `/tmp/ritemark-s109-final-shots/selection-neutral-order.png` — final colored-bubble rail after selecting an older Recent without reordering.
- `/tmp/ritemark-s109-final-shots/panel-row-actions.png` — final Conversations panel with Pinned/Active & recent, distinct hues, and direct row actions.
- `/tmp/ritemark-s109-final-shots/after-reload.png` — same selected conversation, order, transcript, and color identity after reload.

## Validation result

- Extension and webview TypeScript checks passed after the final visual correction.
- `npm run test:conversations` passed the host store, controller, cutover, migration, read-only legacy storage, and selection-neutral selector suites.
- `./scripts/validate-qa.sh` passed the repository pre-commit, Chrome, native TypeScript, agent runtime, lifecycle, reset, model, and runtime-switching gates.
- Final code review fixed and regression-tested flag-off-before-cutover store selection, delete-failure tombstone rollback, bounded Undo reservation, runtime capacity reduction, and provider session disposal.
- Final accessibility audit at approximately 200% workbench zoom found no webview horizontal overflow; All conversations and the 56px rail retained their actions and full accessible labels.
- Emulated reduced-motion and forced-colors passes verified no Working pulse or conversation transition, visible focus for every rail action, zero native `title` duplicates, and `Message` composer focus after selecting even the already-current row.

The curated release assets are in `docs/releases/v1.10.0/screenshots/`. Native Windows execution remains an explicit v1.10 Windows candidate gate. Corrupt-record and unassigned move paths are covered by focused store/controller/projection tests and remain release-candidate visual canaries rather than unverified Sprint 109 behavior claims.
