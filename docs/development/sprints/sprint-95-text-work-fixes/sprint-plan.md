# Sprint 95: Text-Work Fixes

Track: lightweight bugfix sprint (three independent bugs, part of the v1.8.3 release).
Branch: `sprint-95-text-work-fixes`
Release tier: mixed — #142 is shell-tier (bundled version scheme), #103/#135 are extension-tier. v1.8.3 ships as a full DMG regardless (see `releases/v1.8.3/release-plan.md`).
Approved by Jarmo 2026-07-15 (all three; #142 via the `X.Y.Z-0` bundled-version approach).

## Scope

| # | Bug | Approach | Verifiable |
|---|-----|----------|-----------|
| #103 | Chat composer shows no feedback when a text/markdown file is attached | Make the non-image attachment chip clearly visible (match the image thumbnail `w-14 h-14`), show the file extension as a label — `ChatInput.tsx` ~1051–1085 | webview dev server |
| #135 | Chat History collapses multiple sessions into one entry | Investigate the session→history lifecycle (session-ID reuse / overwriting save / list-refresh), fix so each distinct session is a separate persisted entry | webview dev server |
| #142 | Seamless `-ext.N` update never loads (semver pre-release ranks below bundled) | Ship the bundled extension at `X.Y.Z-0` so a `X.Y.Z-ext.N` update sorts higher; fix compounding bug A (infinite reload) + bug B (`cleanupOldVersions` deleting the staged version). Unit tests. | unit tests only — **end-to-end validation is post-release** (publish a `v1.8.3-ext.1` and confirm it loads) |

## Sequencing

1. **#103** — contained UI fix, verify live.
2. **#135** — investigate root cause, fix, verify live.
3. **#142** — version scheme + compounding bugs A/B + unit tests. Cannot be end-to-end validated in dev mode (needs a real prod build + a published `-ext.N` release); flag that clearly and cover with unit tests instead.

## Out of scope / notes

- #142's fix ships in the v1.8.3 DMG; the first real end-to-end test happens only AFTER v1.8.3 is out (publish `v1.8.3-ext.1`, confirm it loads and clears the restart banner without deleting the staged dir). Document this as an intentionally-post-release QA item.
- No new features; all changes are bug fixes.
