# Sprint 43: Welcome Onboarding — Handover

## Status

Functional implementation is complete in dev. Cleanup is in progress. Full validation is intentionally deferred until `1.5.0` production testing.

## What is working now

| Area | Current result |
| --- | --- |
| Startup welcome | Empty windows open the Ritemark Welcome home instead of the default walkthrough detail |
| Hero | Branded hero with final background, logo lockup, `New document` split-button, and `Open folder` |
| Create actions | `New document`, `New table`, and `New flow` all exist and are wired |
| Draft location | `New document` and `New table` create real files under `~/Documents/Ritemark` instead of `untitled:` working copies |
| CSV starter | `New table` opens a prefilled 10-column, 20-row CSV in the table editor |
| Flow creation | `New flow` creates a starter workspace flow, or guides the user to open a folder first |
| Launch check | Welcome reads ChatGPT, Claude, Git, and Node status from the extension/settings layer |
| Hero links | Support/blog links are live and include Welcome-specific UTM tags |
| Settings | Codex integration defaults on for new profiles and no longer claims Flow-node support |

## Remaining cleanup

- remove obsolete leftovers from the earlier Quick Pick based create-menu path
- keep sprint docs aligned with the final visible screen and deferred validation plan

## Validation intentionally deferred

These are not blocked; they are simply moved to the release pass:

- dev vs prod parity check
- release-side patch application verification
- final prod smoke test during `1.5.0` testing

## Follow-up work outside this sprint

- Claude Code authentication still needs a more user-friendly flow and likely deserves a separate sprint.
- Codex Flow nodes do not exist yet, so Codex UI/copy must continue to avoid claiming that capability.
