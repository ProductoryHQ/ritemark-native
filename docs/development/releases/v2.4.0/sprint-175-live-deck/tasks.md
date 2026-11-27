# Sprint 175 tasks

Small PRs, in order. One builder at a time. Each PR names its review tier (`REVIEW.md`) and its proof. Shots for the Experience lead are each chip state in light and dark, the paused menu, the AI step, and the page on a computer and a phone. No time estimates.

Branch: `sprint-175-live-deck`, made from `main` before the first code edit; PRs may use their own branches off it as 2.4's other sprints do.

| PR | Content | Tier | Proof |
|---|---|---|---|
| 1 | **Picture cleaner** (R17): `pictureClean.ts`, called from the upload; the record hashes sent bytes. Lands first: nothing live can ship without it. | **High** (`src/publish/`; `/security-review`) | The fault first: a fixture JPEG with GPS/camera/author and a PNG with text chunks go up unchanged on `main` (bytes compared); then fixed: no EXIF, XMP, IPTC or text chunks, orientation kept, the pictures still decode and look identical. A live check on the test account through `scripts/qa/with-test-keys.sh`. |
| 2 | **Timetable reader** (R32, R36, R37): `timetable.ts`, `time:` and the session field, sums, label minutes; `publicDeck` ignores them. No UI. | Standard | Tests: sums, label minutes, no-time count, a minutes-only change keeps the digest (fails without the change). |
| 3 | **Minutes while making** (R33, R34, frame 8): deck bar "Slide 6 of 17 · 25 min", status-bar length, thumbnail corners. | Standard, the lead's look | Shots: light and dark, over and not over the session. |
| 4 | **The list view** (R35, frame 9): strip to list, spreadsheet entry, foot, the session set once. | Standard, the lead's look | Shots: light and dark; a driven entry down 17 rows. |
| 5 | **Version file and the page's follower** (R21 to R29): `version.json` in every deploy, the checker, idle gate, keep by key, glow, "Updated just now", removed slide with Go on to, count only for an added slide, `PAGE_CSP` additions. | **High by content** (the public page's policy and what it fetches; `/security-review`) | Page tests (S9 to S12, S19); the CSP diff is exactly two additions; on the test account: a page on a computer and a phone (emulated) while the deck changes, the stale-edge case replayed against a fake, 20 updates in a row. Shots: changed, taken out, added before the reader's, computer and phone. |
| 6 | **The live engine** (R2 to R13, R15, R18 to R20, scenarios S1 to S7, S13 to S17): `deckLive.ts`, `updateLive`, record fields, one in flight, pauses, Go on, Offline, no start-up send, the messages. | **High** (`src/publish/`, what goes public; `/security-review`) | The fault first for each guard, then fixed: key, outside folder, over limits, two quick saves, minutes only, window open; a live run on the test account of S3, S6, S7. Measurements kept in `research/`. |
| 7 | **The chip** (R14, R16, frames 1, 2, 4): the switch row, states and tooltips, paused menu with Show it and Go on, Copy link into the menu, Update the page only while off. Needs PR 6. | Standard, the lead's look | Shots: each chip state in light and dark (Published · changed, Live, Updating…, Paused, Offline; since #1142 the changed state is the **Publish changes** button and the menu row is named the same), the menu with the switch, the paused menu. |
| 8 | **The AI's step** (R30, R31, frame 3, S4, S8, S20): "Updated the page" and "The page waits: …", the no-tool tests. | Standard (the tool registry and runtime approvals are untouched; if a change there is needed it is re-rated High before it starts) | Shot: frame 3's step; the tool-list tests fail on a planted publish tool. |
| 9 | **Docs and the closing proof**: `docs/user/`, `architecture.md`, release-note lines (`release-notes` skill), the full run of scenarios S1 to S21 beside the Experience shots. | Light | The scenarios table with pass/not-run stated plainly. |

PR 5 and PR 6 may be built side by side; PR 7 waits for both. PR 2 to PR 4 are independent of 1, 5 to 8 and can go first or between.

## Per-PR checklist

The per-PR boxes are recorded in each PR's **Review record** comment on GitHub, which is authoritative; they are not ticked here.

- [ ] Branch checked: not `main`.
- [ ] Tests that fail first, then pass; targeted while working; the full chain once on the final head, output to a file.
- [ ] Review at the tier, every finding answered, **Review record** comment naming the head.
- [ ] No feature removed or stubbed; nothing gated by a new flag.
- [ ] `docs/development/vscode-patches.md` untouched (no patch changes).

## Closing

- [x] `qa-validator` (25 Nov, on 7eefb46c: signed off with open items)
- [ ] Windows checks (path case and links out of the deck's folder, OneDrive-held pictures, 150 % scaling of the chip) as short separate tasks; the rest at Gate 2.
