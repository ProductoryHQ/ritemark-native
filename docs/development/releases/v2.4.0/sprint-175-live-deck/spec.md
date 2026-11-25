# Sprint 175 spec: the live deck

The behaviour contract is Experience 52 (`product/design/experience/experiences/live/README.md`, frames 1 to 6) and Experience 51 (`.../timing/README.md`, frames 8 and 9, "Jarmo's focus: one job"). This file numbers them for tests. If they differ, the drawings win and this file is corrected. The engineering decisions are the Development manager's of 24 November, in [research/2026-11-24-cloudflare-live-measurements.md](research/2026-11-24-cloudflare-live-measurements.md).

**Amends Sprint 149's R1 principle** ("Nothing leaves the computer until the person presses Publish or Update the page"). New wording: nothing leaves until the person presses Publish or Update the page, **or has turned on that one page's switch, Update on every save**. Jarmo's reading of "Publishing is explicit: nothing local is uploaded on its own" (24 November): the switch is the person's word for this one page. Every other line of Sprint 149's principle stands: no AI tool, Flow, schedule or start-up path publishes, updates or unpublishes.

"A deck's page" is the handout page Ritemark writes beside the deck (`page/pageFile.ts`) and publishes through 2.2's Publish. "The digest" is `publicDeck`'s: what the page shows.

## The switch

- **R1. One switch per page.** The first row of the Published chip's menu on the deck's bar, "Update on every save", with the line "Open pages catch up within about 15 seconds." It exists only while the deck is published. It is **off until the person turns it on** and off again with one press.
- **R2. Kept per page, on this computer.** The switch and a pause (R10) live in the page's publish record (`publish/v1/`, Sprint 149 R8), never in the project or the deck file. Unpublish clears both. A moved or renamed deck loses its record and so its switch.
- **R3. Only the person turns it on.** The switch, Go on and turning it off are handled from the deck view's messages only. No AI tool, command, Flow, schedule or start-up path reaches them. `src/runtime/ritemarkTools.ts` gains nothing.
- **R4. Turning it on sends once.** The same checks as a save (R6 to R12) run on the deck as it is now, and a page that differs goes up. A page that doesn't differ sends nothing.
- **R5. Opening the window sends nothing.** A deck whose switch is on, opened or restored, publishes nothing until a save in this window. A change made while the window was closed goes with the next save.

## What a save does

- **R6. A save sends.** With the switch on, a save of the deck's file whose digest differs from the page's sends the page. The save may be the editor's or another program's or an AI's, seen by the open window. Typing without saving sends nothing.
- **R7. The timetable and the session never send.** A change to only a slide's minutes or the session (and notes, skipped slides, comments: what `publicDeck` already leaves out) changes no digest, sends nothing, shows no "changed" and refreshes no open page.
- **R8. One in flight, the latest wins.** At most one deploy runs per page. Saves during it leave one waiting update that is built from the latest saved state when the first ends; earlier waiting states are dropped. The chip reads Updating… for the whole of it (about one update per 6 s at most).
- **R9. The first-publish and manual paths are unchanged.** Publish, Update the page (shown while the switch is off) and the sheet work as in 2.3. A save with the switch off sends nothing and the chip reads "Published · changed" as in 2.3.

## Pauses

- **R10. A pause.** The update does not go, and the page keeps what it had, when: (a) the key scan finds a hit in any text that would go; (b) the page uses a file outside the deck's folder, or a file over the limits (25 MiB a file, 20,000 files), or one the gather couldn't check (Git failing closed, a picture type that can't be cleaned, R16); (c) Cloudflare needs the person to connect again. The switch stays on. The chip is amber "Paused" and **nothing else moves**: no sheet, no toast, no dialog.
- **R11. The pause menu.** One press on the chip shows why: "Paused at 10:42. Slide 6's text has what looks like a key, sk-ant-…7f3a. Open pages keep what they had." (a file: "Slide 9 shows a picture from outside the deck's folder."; sign-in: "Cloudflare needs you to connect again."), **Show it** (opens the slide, with the key marked where it was found; a file's slide), and **Go on**. The key's value is shown only as its first and last characters, as the scan does today.
- **R12. Go on is the person's press.** It checks the deck as it is. While a key remains it is disabled with "Take the key out first". When the check is clean (or the person has accepted what a file pause names, outside the folder or over the limits, by pressing it), it sends the latest saved state and the pause ends. **A pause never ends on its own**: not when the key is taken out, not by an AI's save, not at a later save. Turning the switch off and on again is also the person's press and starts clean (R4).
- **R13. Saves during a pause.** They send nothing. Go on sends the state at the moment of the press.

## The chip

- **R14. States.** "Published · changed" (switch off, as 2.3), **Live** (green dot), **Updating…**, **Paused** (amber), **Offline** (grey). Green only for Live, amber only for Paused. Each state has a tooltip that says what it means; Live's and the switch's help promise "about 15 seconds", never "seconds".
- **R15. Offline.** When Cloudflare can't be reached, the chip is grey Offline and asks nothing. Saves stay on the computer. The latest saved state is tried again when the connection is back (at most every 30 s while the window is open) and goes through the same checks. Other failures are Offline too, with the redacted reason in the tooltip.
- **R16. The menu.** The switch; then Copy link, See online (the address), Save slides as PDF, Unpublish. Update the page is there only while the switch is off. Copy link leaves the deck's bar for the menu; the publish page's own bar (patch 010) keeps its Copy link.

## Pictures

- **R17. Metadata is stripped.** Every picture Publish sends has its metadata removed (place, camera, author, comments, thumbnails; EXIF, XMP, IPTC, PNG text chunks) for JPEG, PNG, WebP and GIF. Today Publish sends picture bytes unchanged (checked 24 November: nothing in `src/publish/` or `src/decks/page/` touches picture metadata), so this lands before the switch can be turned on. JPEG keeps only its orientation. The file on the person's computer is never changed; the records hash what was sent.
- **R18. A picture the deck's folder holds goes without a pause.** A picture that a slide shows, whose real path is inside the deck's folder or below it, within the limits and of a type R17 cleans, goes on the next update, with its name once in the chip's tooltip. A picture of a type R17 can't clean pauses (R10 b).
- **R19. Outside the folder pauses.** A file that resolves outside the deck's folder (by `..`, an absolute path, or a link out; case-insensitive on Windows) pauses with the slide named. Sprint 149's other gather rules (no dot folders, `node_modules`, Git-ignored files, inside the project) are unchanged and show as before.
- **R20. A key in any text always pauses.** Slides, handout, the page's CSS and scripts: the scan Sprint 149 R4 describes, on every update.

## The open page

- **R21. The page checks for a newer version.** Every published deck page carries a version file (`version.json`: a version number that rises with each deploy, and the new version's slides in order, each as its key and title) served with `no-store`. An open page asks for it about every 10 s while visible and when its reader returns to the tab. Failed checks are silent.
- **R22. Forward only.** The page takes a version only when its number is higher than the one it holds. An edge that serves an older file once is ignored.
- **R23. Only when the reader stops moving.** The page waits until there has been no scroll, key, touch or pointer movement for about a second and no selected text. A reader mid-copy is never interrupted.
- **R24. The reader stays on their slide.** The page keeps them by the slide's key (its title and which slide of that title: the key the ticks use), not its number. Their ticks stay. A link `#6` shared before keeps meaning position six on first load; after an update the address follows the slide.
- **R25. A changed slide.** What changed on the reader's slide glows in the theme's accent for 2 s, and "Updated just now" shows in the foot (computer) or under the slide (phone) for that time. The glow is on blocks whose text differs from before the reload. If the page can't tell which, it leaves out the glow and keeps "Updated just now".
- **R26. A slide added before theirs** changes only the count (6 / 17 becomes 7 / 18) on the same slide. Changes on other slides show nothing but the count.
- **R27. A removed slide stays.** If the reader's slide isn't in the new version's list, the page keeps it, a little dimmed, with "This slide was taken out of the deck. You can finish reading it." and **Go on to <title>**, the slide that took its place (the first slide after it in the old order that the new version has; the last one when none follows). The count reads "– / 16". The reader is never moved off a slide they are reading. Go on to loads the new version at that slide.
- **R28. The page's policy.** `PAGE_CSP` gains `connect-src 'self'` and a hash for its own script and nothing else; no `unsafe-inline`, no remote origin.
- **R29. Pages published before 2.4** have no version file and don't follow; they do from their next Update the page.

## An AI's edit

- **R30. A trace.** After a turn that saved a live deck and whose update went, the chat's steps end with Ritemark's "Updated the page" (green globe). After a turn whose change hit a pause: "The page waits: slide 6 has what looks like a key" (amber pause). Ritemark writes these steps; the model's words are not in them. A turn that changed only minutes writes neither.
- **R31. The AI has no hand on the switch.** No tool of any runtime publishes, updates, unpublishes, turns the switch on or off, or presses Go on. An AI's save publishes only through R6, while the person's switch is on.

## The timetable

- **R32. The minutes are in the slide's own line.** `time: 25` beside `skip:`; the session in the deck's front matter (the one value the presenter view's session length already keeps; the PR names its field). Minutes are whole numbers. A section slide takes none and shows its slides' sum. A slide whose exercise label already says "25 min" has that as its minutes and nothing is typed twice. A slide without minutes counts as none.
- **R33. While making.** The deck's bar shows "Slide 6 of 17 · 25 min"; a click, a number and Return set it without leaving the slide. Each thumbnail shows its minutes in its corner.
- **R34. The whole length.** The status bar shows "17 slides · 3 h 10 min · 10 min over 3 h" where a document shows its word count; amber only when over the session; "2 slides have no time yet" when some have none.
- **R35. After making.** The strip can turn into a list: every slide with its start and minutes, a section's sum, entry as in a spreadsheet (number, Return, next slide), the stage following the row, and the foot "17 slides, 3 h 10 min, Session 09:00 to 12:00, 10 min over". The session is set here once.
- **R36. A slide from the Slide library brings its minutes.** (It is a line on the slide.)
- **R37. The minutes are the trainer's plan.** They are in the file and never on the page, never in `version.json`.

## Engineering

- **E1.** Each guard has a test that fails without it: the key pause, the outside-folder pause, the picture strip (bytes compared), one-in-flight, forward-only, the digest ignoring minutes, the page's keep-by-key.
- **E2.** No new npm dependency; the picture cleaner is our own byte-level code. `media/webview.js` size recorded before and after.
- **E3.** No flag. Everything is on by default (HARD RULE #2); the switch is a per-page choice of the person, off until they press it (Jarmo, 24 November).
- **E4.** Patch 010 is **not** touched: the Published chip and its menu on the deck's bar are webview code (`webview/src/components/decks/DeckPublish.tsx`). Patch 010's chip belongs to a plain `.html` page's browser bar and keeps 2.2's behaviour. Had a patch been needed, 2.4 is already a shell release (#953, #954).
- **E5.** `docs/user/` gains "A page that follows its deck" and "A deck's timetable"; `docs/development/architecture.md` gains the live-update path.
