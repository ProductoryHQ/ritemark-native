# Sprint 175: The live deck

Track: SDD (auto-detected: more than three user-facing requirements, a public-page and key-scan security boundary, and a flow across the deck view, the host, Cloudflare and a reader's browser). Override with: "use plain full track".
Branch: sprint-175-live-deck
Release tier: **extension** (no shell-tier path: the chip is webview code, so patch 010 is not touched; 2.4 is a shell release anyway because of #953 and #954)
Status: **Approved 24 November 2026** through the 2.4 roadmap. Jarmo: "roadmap kinnitatud, lõikejoon ja AI-avaldamine soovituse järgi" (ritemark-dev `decisions/log.md`, 24 November). Sprint-level questions are the Development manager's; they are settled below. Phase 1 (research) is done: [research/2026-11-24-cloudflare-live-measurements.md](research/2026-11-24-cloudflare-live-measurements.md). Phase 2 (this plan). Implementation starts on the branch above.

Parent release: v2.4.0 (`../release-plan.md`, row "175 · The live deck"). Issue: to file (milestone v2.4.0). Drawings: Experience 52 (`product/design/experience/experiences/live/README.md`, frames 1 to 6) and Experience 51 (`.../timing/README.md`, frames 8 and 9).

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract (R1 to R37, E1 to E5); amends Sprint 149's R1 principle
- [scenarios.md](scenarios.md): S1 to S21, the test and manual matrix
- [technical-plan.md](technical-plan.md): what is reused, the pieces, the risks
- [tasks.md](tasks.md): nine PRs with tier and proof
- [sprint-plan.md](sprint-plan.md): this file

## Goal
A published deck follows its deck while the person works and trains, on the person's word for that page, and each slide has its minutes with the whole length in sight.

## Decisions already made (not reopened)
Jarmo, 24 November: live publishing is in 2.4; layer 1 behind a switch per page (his reading of "Publishing is explicit: nothing local is uploaded on its own"); an AI's edit publishes while the switch is on; the AI has no publish tool, cannot turn the switch on and cannot end a pause; no AI tool, Flow, schedule or start-up path publishes, updates or unpublishes. The Development manager, same day, from the measurements: readers follow by checking (about 8 to 16 s), one deploy at a time with the latest save winning, forward only, readers kept by slide key, a new picture in the deck's folder goes without a pause.

## Decided by the Development manager (24 November)
1. **Where the switch lives and what keeps it.** In the page's publish record on this computer, off by default, cleared by Unpublish. Why: nothing in the project or the deck file may carry an account or a standing consent, and a copied folder must never arrive with a page switched on.
2. **Opening a window sends nothing.** A change made while the window was closed goes with the next save. Why: Jarmo's "no start-up path publishes" is the plainest reading; the cost is a page that waits for the next save, which the chip's "Live" does not hide because the first save fixes it.
3. **Turning the switch on sends once** (through the same checks). Why: a switch that turned on and left the page stale would be a quiet surprise.
4. **A pause is stored and never ends on its own;** Go on is the person's press, and turning the switch off and on is too. Why: Jarmo's rule that the AI can't end a pause means no event, not even a clean rescan, may end it.
5. **A pause is also made by a picture type the cleaner can't clean, and by signing out.** Why: "no metadata" is a condition of the no-pause rule; a signed-out update can't go and the chip alone says so.
6. **Metadata stripping applies to every publish, manual too,** with our own byte-level cleaner and no dependency; JPEG keeps its orientation. Why: it is today's gap (nothing strips pictures), one code path is safer than two, and a rotated photograph would be a worse surprise than a kept orientation tag.
7. **"The deck's folder" means the deck file's folder and everything below it,** by real path (a link out counts as outside; case-insensitive on Windows). Why: Kristiina's pictures sit beside or under the deck; a project-wide rule would send a person's other folders' files without a pause.
8. **The page follows by reloading** (carrying the reader's slide key and the changed blocks in `sessionStorage`), not by swapping the page in place. Why: the simplest thing that keeps ticks, theme and scripts honest; an in-place swap is a later refinement.
9. **`version.json` carries the slide keys and titles, not the text,** and `v` is a build time in ms that never goes backwards in the engine. Why: the page needs only the list to wait on a removed slide, and the glow comes from the page comparing its own old text with the new page.
10. **Pages published before 2.4 do not follow** until their next Update the page. Why: they have no checker; the release note says so in one line.
11. **The timetable's session is the presenter view's existing session length,** read and written through one field. Why: Experience 51 says it is one value; the PR names the field rather than adding a second.
12. **A change in the timetable is a plain save** (no new write path), invisible to the page by the digest. Why: minutes are the trainer's plan (Experience 51).
13. **Windows:** the checks before merge are only path case, links out of the folder, OneDrive-held pictures and 150 % scaling of the chip; the rest at Gate 2.

## For Jarmo
Nothing. No decision here changes a public promise or the strategy: the switch is his own reading of "Publishing is explicit". One change worth knowing, not asking: from 2.4 every published picture is sent without its place, camera and author data (a gap in 2.2 and 2.3, closed before the switch ships).

## Pull requests
See [tasks.md](tasks.md). Summary: 1 picture cleaner (**High**), 2 timetable reader (Standard), 3 minutes while making (Standard, the lead's look), 4 list view (Standard, the lead's look), 5 version file and the page's follower (**High by content**), 6 live engine (**High**), 7 the chip (Standard, the lead's look), 8 the AI's step (Standard), 9 docs and closing proof (Light).

## Success Criteria
- [ ] With the switch on, a save reaches an open page in about 15 seconds, on the reader's slide, with the changes glowing 2 s and "Updated just now".
- [ ] A key, a file outside the deck's folder, a file over the limits and a signed-out account each pause quietly, and only the person's Go on ends the pause.
- [ ] A new picture inside the deck's folder goes without a pause with its metadata stripped, shown by bytes.
- [ ] Two quick saves give one deploy in flight and the latest state; a stale edge never takes a page back.
- [ ] A removed slide stays for its reader until they press Go on to; an added slide changes only the count.
- [ ] No AI tool, Flow, schedule or start-up path can publish, switch or end a pause, shown by tests that fail on a planted tool.
- [ ] Minutes and the session change no digest, send nothing and refresh no page; the deck shows its whole length while making and in the list.
- [ ] Every chip state, the paused menu, the AI step and the page on a computer and a phone are accepted by the Experience lead.
- [ ] Full chain once on each final head; `qa-validator` signed off.

## Release notes
One plain line per thing with the `release-notes` skill, for example: "A published deck can follow your changes: turn on Update on every save and the page your readers have open catches up, on the slide they are reading." and "Give each slide its minutes and see how long the whole deck is."

## Out of scope
- A room that pushes (about 0.3 s): a later upgrade after the token permission is proven.
- Showing times on the agenda (Experience 51 G), the real-run times (E), planning with Claude (D), the presenter view's pacing (F).
- An in-place page swap; per-reader push; a view count.
- Publishing a document or a page other than a deck's.

## Risks
- **A public page that now fetches.** Mitigated in technical-plan.md and reviewed at High.
- **Cloudflare timing.** Measured on one account; Gate 2 repeats the 20-update run on the release's own build.
- **The `DeckPublish.tsx` and `SlideStrip.tsx` hot files**: PRs merge one at a time.
- **Live build equal to the manual Update** (fit steps): one comparison test.
- **Picture formats beyond four** pause rather than go; the list can grow later.

## Approval
- [x] Jarmo approved this sprint plan, through the 2.4 roadmap, 24 November 2026: "roadmap kinnitatud, lõikejoon ja AI-avaldamine soovituse järgi"
