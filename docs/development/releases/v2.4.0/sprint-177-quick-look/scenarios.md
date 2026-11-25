# Sprint 177 scenarios

### S1 · Spot the deck in Finder (R1)

Given a saved deck with a skipped opening slide and a dark theme with a glow, when Finder requests a thumbnail from a current entry, then the result is a PNG of the first shown slide. Check it against PDF page 1 and the wall, at small and large icon sizes. Repeat with Borderless, a local picture, a logo and a missing asset.

### S2 · Read the deck with the space bar (R2)

Given a matching entry with several slides, when the person presses Space, then Quick Look shows the PDF in order, with native paging. Inspect page count and page size, the chosen tab and revealed content, and confirm there is no handout, skipped slide, note or comment.

### S3 · A deck changed while Ritemark was closed (R3)

Given Finder already displayed a slide whose words were then removed on disk with Ritemark closed, when the person returns to Finder and opens Quick Look, then the icon view shows the deck icon and Space shows the new text. Exercise an existing Finder window, reopen it, and repeat after a same-size edit with the original modification time restored. Record live Finder behaviour as well as direct provider replies.

### S4 · No usable picture (R3, R5)

Given a new deck, missing entry, bad JSON, corrupted or mismatched PDF, a redirected cache path or a deck with no shown slides, when Finder asks, then the thumbnail reply draws the deck icon and preview returns current text. Try a file with access denied and record the read error. Check text, Markdown and legacy deck files still use their usual handlers.

### S5 · Saving makes a picture (R4)

Given a new deck or an open deck with unsaved changes, when Ritemark saves it, then the save completes independently of drawing. The entry matches the exact disk bytes, and the next Quick Look request gets the current slides after drawing. A failed save or print creates no new usable entry.

### S6 · An AI or sync changes the file (R3, R4)

Given an open project, when the deck is changed, replaced or renamed on disk in a burst, then the app queues the latest version and Finder falls back while it waits. Reorder two jobs, interrupt a write and repeat in two windows. Check that readers get a matched pair or the plain case, and that ordinary editing stays responsive.

### S7 · Open the project again (R4)

Given a project with fresh, missing and out-of-date entries, when Ritemark opens it, then only the decks needing work queue for background drawing. Check a moved deck and a locally changed theme or picture against the agreed dependency rules.

### S8 · Remove a project and prune (R5)

Given two projects with pictures, when the person removes one project while a job is pending, then that project’s entries go and the late job cannot restore them. Delete a deck outside the app and fill the cache beyond its limit. Check that pruning removes missing sources first and leaves other projects alone during project removal. Confirm disk writes stay in app cache or temporary print storage, and check entitlements and offline drawing.

### S9 · Install or update on each Mac (R1–R3, R6)

Given a clean runner, when the real bundle is placed in Applications and launched, then record discovery and election for both extensions and run the match and mismatch proof. Repeat as an upgrade from 2.3 with a warmed text thumbnail. If election is needed, record the initial result and verify the Settings steps and the retest. Check macOS 15, macOS 26 arm64 and macOS 26 Intel.

### S10 · Verify the release build (R5, R6)

Given clean release candidates, when build output is checked, then both extensions have the right bundle IDs, type, slices, deployment target, signatures and entitlements. Check notarized distribution through the release gates and do a Windows smoke for absence of cache jobs.
