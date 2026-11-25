# Sprint 177 · Quick Look for decks

**Approved 25 November 2026** · SDD · Phase 3, building · Branch `sprint-177-quick-look`, worktree `codex-177-plan`, based on local `origin/main` at `22bc481c`.

Parent release v2.4.0. Issue #953 asks to show a deck’s first slide in Finder. This sprint also brings the slides to the space-bar preview on Mac. The native extensions ship in the full app build.

## SDD artifacts

- [Spec](spec.md) gives the behaviour for R1–R6.
- [Scenarios](scenarios.md) gives the proof for S1–S11.
- [Technical plan](technical-plan.md) records the audit, cache contract and build.
- [Tasks](tasks.md) gives the PR order, tiers and proof.

## Decisions on 25 November 2026

1. **Put #953 into 2.4.** Jarmo said “teeme ära selle quicklooki!”
2. **Use file access A.** Jarmo chose read-only access to the home folder for both extensions, with no network (“2. a”).
3. **Draw in Ritemark.** The Experience lead proposed option c and Jarmo said “1 jah.” Ritemark draws on save, on background disk changes in an open project and when a project opens with missing or outdated pictures. Finder shows the first shown slide, and Space shows all shown slides. Until a current drawing exists, Finder shows the deck icon and Space shows the deck text, as in 2.3. No older slide or “open in Ritemark to see” card. Pictures stay in the local app cache and go when the project is removed.

The runner evidence behind decision 3 is round 3, run 45683909718, on macOS 15 and 26. WebKit failed under A even for a static page. With a network entitlement, WebContent crashed on 15 or never launched on 26. The native extensions draw no HTML.

## Success criteria

- [ ] Finder shows the first shown slide with the deck’s look (R1).
- [ ] Space shows the full set of shown slides at slide size (R2).
- [ ] Missing or stale pictures give the deck icon and current text, including in Finder with a warmed thumbnail cache (R3).
- [ ] Save, disk changes and project open draw in the background (R4).
- [ ] Pictures stay on this Mac, are bounded and go with the project (R5).
- [ ] Both extensions ship in the signed Mac app, with discovery and any Settings steps verified per platform (R6).

## The Development manager's technical answers (25 November 2026)

1. **Project removal and windows.** "Removed with the project" means removed from Ritemark's project list. On that event, any window purges the entries whose real source path lies under that project's root, unless another project still in the list contains it (overlapping roots). Jobs in flight for that root are cancelled. Deleting or renaming a deck removes its entry on the next watcher event or sweep. Any window may draw; writes and pruning are serialized across windows by an exclusive lock file in the cache folder (the `wx` pattern Sprint 176 PR 1 uses). A job publishes only if the deck's bytes on disk still hash to what it drew.
2. **Themes and pictures.** Each entry records an input fingerprint: the deck's bytes, the bytes of its theme file and its local logo, and the size and modification time of each local picture it uses, plus the app version. The sweep and the watcher (which also watches the project's theme and picture files) redraw when the fingerprint changes. The extensions check only the deck's own bytes, which is the promise: a slide shown is the deck's current text. A newer picture or theme catches up on the next draw.
3. **Budgets.** At most 500 MB of cache in total. Entries for missing sources are pruned first, then the oldest drawn. A deck whose PDF would exceed 50 MB keeps the plain case. One drawing job at a time per app, at idle priority, coalesced per deck with a 2-second debounce. The project-open sweep is queued, never blocking the window.
4. **Runner evidence.** macOS 15 and macOS 26 on arm64, and macOS 26 Intel on the hosted `macos-26-intel` runner, which round 2 already used. macOS 12–14 rely on the deployment target only; this is recorded as not runtime-tested, and older-Mac evidence is sought from Gate 2's x64 testing.
5. **A stale Finder thumbnail.** Finder caches thumbnails by the file's identity and modification date. A changed deck gets a new request, and the extension then answers by the current bytes. A deck that Ritemark draws later without the file changing (the plain case shown first, while Ritemark was closed) may keep Finder's earlier icon until the file next changes or Finder's cache expires. Ritemark never touches people's files and never resets Finder's cache on their Mac. The proof measures this in a warmed Finder; if Finder ever shows an older slide (not the icon), that blocks the merge.

## Risks and open decisions

- **Experience lead.** Answered on 25 November: the slide edge to edge, no badge or shadow, the deck icon below 64 px; the system's type icon first, else a bundled icon from the decks file-icon design; the comparison list in S1; the Settings note, Help line and release-notes line in R6 and S11.
- **Development manager.** Answered above. Still open until the proof: what a warmed Finder shows after a later draw, and macOS 26 Intel's election (`pluginkit -e use` was needed in round 2).

## Release notes draft

On Mac, Finder can show a saved deck’s first slide, and pressing Space lets you look through the slides. Ritemark keeps the previews on this Mac.

## Approval

- [x] Approved by the Development manager on 25 November 2026, after the Experience lead's look answers (Jarmo, 24 November: sprint plans and their questions are the Development manager's). Implementation starts on `sprint-177-quick-look`.
