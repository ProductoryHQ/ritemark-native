# Sprint 97 — Comment polish (ships as `1.8.3-ext.1`)

Two fast-follow fixes on the Sprint 94 comment feature, deferred from v1.8.3. Extension-tier (webview only) → ships as the first `X.Y.Z-ext.N` update, which also validates the #142 seamless-update fix in production.

## #150 — multi-block comment created N comments instead of 1 — DONE
Root cause: a ProseMirror mark can't span block boundaries, so a 3-bullet selection became 3 separate `<mark>` ranges; the rail rendered one marker per range, and there was no shared identity.
- [x] `CommentMark.ts`: added an `id` attribute (`data-comment-id`) + `newCommentId()` helper.
- [x] Every create path stamps a fresh id across the whole selection so all block-level ranges share it: `FormattingBubbleMenu.tsx` (Comment button) and `CommentNode.ts` (`Cmd+/`).
- [x] Round-trip: `commentTurndownRules.ts` emits `data-comment-id`; `commentMarkedExtension` passes marks through untouched and `CommentMark.parseHTML` reads the id back — so a multi-block comment reloads as ONE comment. (+3 round-trip asserts in `commentRoundTrip.test.ts`.)
- [x] `MarginCommentRail.tsx`: `scan()` groups fragments by `data-comment-id` (one marker per id, topmost fragment wins position); `remove`/`applyNote`/`sendToAI` resolve ALL ranges sharing the id via `rangesByCommentId`, so edit/delete/relay act on the whole comment. Legacy id-less comments keep positional identity (back-compat).
- [x] **Live-verified** in the webview dev server: selecting 3 bullets → 3 `<mark>` with ONE shared id → ONE compose bubble; typing a note applied it to all 3 fragments; `@claude` derived the agent on all; one rail marker.

## #151 — Comment toolbar button label low-contrast on dark hover — DONE
Root cause: the bubble-menu toolbar is an always-white pill (`bg-white`), but its hover/active state used the theme-aware `--r-surface-soft`, which turns dark (`#1E293B`) in dark mode → dark-on-white text became dark-on-dark (invisible). Affected every button; the Comment label just made it obvious.
- [x] `FormattingBubbleMenu.tsx`: pin `--r-surface-soft` to the light token (`var(--ritemark-surface-soft)`) on the toolbar container, so all hover/active surfaces stay light to match the white pill — one line, fixes every button, zero light-mode change.
- [x] **Live-verified** in dark mode: global `--r-surface-soft` = `#1E293B` but the toolbar's resolves to `#f1f5f9`; Comment label stays `rgb(30,27,75)` (dark) → readable on the light hover.

## Release
- [x] Webview typecheck clean; bundle rebuilt; comment + conversationReset tests green.
- [ ] Bump `extensions/ritemark/package.json` → `1.8.3-ext.1`, run `./scripts/release-extension.sh 1.8.3-ext.1`.
- [ ] **Light gate:** Jarmo tests via the in-app "Relaunch to update" flow (this is also #142's first real-world validation — confirm the ext update actually loads over the bundled `1.8.3-0`).
- [ ] Publish the per-file manifest + update feed; on success, close #150, #151; comment #142 with the validation result.
