# Sprint 175 scenarios

Each one becomes a test or a manual check. The deck is Experience 52's made-up Harbour Logistics training (17 slides, published). "Live" means the switch is on.

**S1. Turning it on.** Published deck, switch off, chip "Published · changed". The person presses the switch. The chip reads Updating…, then Live. The page matches the deck. (R1, R4)

**S2. Turning it off.** One press in the menu. The chip reads Published. A save then makes it "Published · changed" and sends nothing. (R1, R9)

**S3. A key typed while Live.** Slide 6's handout gets `sk-ant-…7f3a`, saved. Nothing is sent; the chip turns amber Paused; no sheet, toast or dialog. Open pages keep their version. The menu says "Paused at 10:42. Slide 6's text has what looks like a key…" with Show it (slide 6, key marked) and Go on disabled ("Take the key out first"). The key is taken out and saved: still Paused, nothing sent. The person presses Go on: the latest state goes, the chip reads Live. (R10 to R13)

**S4. An AI takes the key out.** In S3 Claude removes the key and saves. The pause stays; Go on stays the person's. The step reads "The page waits: slide 6 has what looks like a key" for the earlier turn and, for this one, nothing publishes. (R12, R30, R31)

**S5. A picture from outside the deck's folder.** Slide 9 shows `../../Pictures/depot.jpg`. Saved: Paused, "Slide 9 shows a picture from outside the deck's folder." Same for a link inside the deck's folder that points out. On Windows, `C:\Deck\Pics` vs `c:\deck\pics` count as the same folder. (R10, R19)

**S6. A picture inside it.** The person drops `shift-log.jpg` (with GPS and camera data) into the deck's folder and shows it on slide 7. Saved: it goes with no pause; the tooltip names it once; the bytes on Cloudflare carry no EXIF, XMP or IPTC and keep orientation; the file on the computer is untouched. A 30 MiB picture, or the 20,001st file, pauses. A HEIC picture pauses ("couldn't be cleaned"). (R17, R18, R10)

**S7. Two quick saves while a deploy runs.** Save A starts a deploy; saves B and C come within its 6 s. One deploy is ever in flight; when it ends one more runs, built from C; B never goes. The chip reads Updating… throughout, then Live. The page shows C. (R8)

**S8. An AI turn edits a live deck.** Claude adds slide 7 "When the shift log is missing" and gives it 3 minutes. The page updates; the turn ends with "Updated the page" (green globe); the chip says Live; the status bar says 3 h 20 min. A second turn that only gives slides minutes: no update, no step. A turn whose edit adds a key: step "The page waits: …". (R6, R7, R30)

**S9. A reader on a phone, a slide changed.** The reader is on slide 6 scrolling. The page waits until they stop for about a second; then step 2 changes to "Ask for the handover in five lines". They stay on slide 6; the changed block glows 2 s; "Updated just now" shows just under the slide. A selection in progress delays it. (R23 to R25)

**S10. A slide added before the reader's.** On slide 6 of 17, the trainer adds a slide at 2. The reader stays on their slide; the count reads 7 / 18; nothing glows. Ticks stay. (R24, R26)

**S11. A removed slide, on a phone.** The reader is on Late trucks; the trainer takes it out. The slide stays, dimmed, with the note and **Go on to Coffee**; the count reads "– / 16". Nothing moves while they copy a prompt. Pressing Go on to opens the new version on Coffee. If Late trucks was last, Go on to names the new last slide. (R27)

**S12. An edge that serves an older version.** The page holds version 105; a check returns 104 (a stale edge), then 106. The page ignores 104 and takes 106. A check that fails or returns garbage does nothing. (R21, R22)

**S13. Minutes only.** The person changes slide 6 from 25 to 30 minutes, and the session end. The chip stays Live, no deploy runs, no step is written, no open page reloads, and the status bar and list update. With the switch off, the chip does not say "changed". (R7, R37)

**S14. Offline.** The network drops; a save: the chip turns grey Offline and asks nothing; saves stay local. The connection returns: one update, from the latest save, goes through the same checks (a key then pauses). A reader whose version check fails shows nothing odd. (R15, R21)

**S15. Opening the window.** A deck with its switch on is opened after a change was made elsewhere: nothing is sent and the chip reads Live. The next save sends. (R5)

**S16. Signed out.** Cloudflare refuses the token: Paused, "Cloudflare needs you to connect again."; Go on opens Connect. (R10 c)

**S17. Unpublish.** The page goes, the switch and any pause are cleared; publishing again starts with the switch off. (R2)

**S18. A page from 2.3.** Published before 2.4, never updated: an open page of it never reloads. After one Update the page it does. (R29)

**S19. The page opened with `#6` and no update.** The address behaves as today. (R24)

**S20. No tool publishes.** The tool lists of all three runtimes contain no publish, switch or Go on tool; a Flow or schedule that names them fails; the handlers answer only the deck view. (R3, R31)

**S21. The timetable.** Slide 6 gets 25 by click, number, Return; the bar reads "Slide 6 of 17 · 25 min"; the status bar and thumbnails follow; a section shows its sum; a slide with "20 min" in its exercise label shows 20; two untimed slides give "2 slides have no time yet". The list view enters minutes down the rows with Return; the foot shows the session and "10 min over" in amber. A slide copied from the library brings its `time:`. (R32 to R36)
