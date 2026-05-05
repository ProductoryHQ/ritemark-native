# v1.6.3 Pre-Release Audit (Draft)

**Run date:** 2026-05-05
**Runner:** local (macOS)
**Command:** `./scripts/release-preflight.sh`

## Preflight summary

- **Result:** PASSED WITH WARNINGS
- **Errors:** 0
- **Warnings:** 2

### Warnings reported

1. Architecture warning in environment report (host context warning only)
2. Uncommitted changes detected (working tree dirty)

## Git/release state snapshot

- Current branch during prep: `codex/release-1.6.3-materials` (created to avoid working on `main`)
- Latest published GitHub release: `v1.6.2` (2026-05-03)
- Remote tag `v1.6.3` already exists and points to commit `afb5ecb`

## Blocking decision needed before final publish

There are user-facing commits on `main` after tag `v1.6.3`. Before finalizing release notes/assets, choose one path:

1. Publish **v1.6.3** strictly from existing tag `afb5ecb`.
2. Move/recreate tag `v1.6.3` to include later commits (history rewrite).
3. Keep `v1.6.3` as-is and publish later commits as **v1.6.4**.

## Materials prepared in this pass

- `release-notes.md` (existing draft retained)
- `TEST-CHECKLIST.md` (scope/header updated)
- `GITHUB_RELEASE.md` (new draft)
- `MARKETING.md` (new draft)
- `update-feed-entry.json` (new draft template)

