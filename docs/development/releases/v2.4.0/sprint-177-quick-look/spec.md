# Sprint 177 spec

## Purpose

See which deck is which in Finder and read its slides with the space bar. When this Mac has yet to draw the latest version, the file still has its deck icon and readable text.

## Principles

Use Ritemark’s own slide drawing. Keep the derived files private to this Mac. Show slides only when they match the deck on disk.

## Requirements

### R1 · The first slide in Finder

For a current local picture, the Finder thumbnail shows PDF page 1, the first slide that is shown in Present. It fits Finder’s requested size without stretching and keeps the deck’s own look. Check themed and Borderless decks at small and large icon sizes.

### R2 · All slides with the space bar

Quick Look shows one page per slide shown in Present, in order and at the slide’s own proportions. The Slides-as-PDF rules apply to reveals and tabs. The preview has no handout, speaker notes or comments.

**The look** (the Experience lead, 25 November): the slide edge to edge at 16:9, with no badge and no shadow of our own; whatever frame Finder adds is fine. Below 64 px a slide can't be read: at those sizes the thumbnail is the deck icon (list view and small icons keep the icon). In Finder's dark mode the slide keeps its own colours, never inverted.

### R3 · The plain case

With no usable matching picture, Finder shows the deck document icon (the page with its badge) and the space bar shows the current file’s text, as in 2.3. Check a deck edited while Ritemark was closed, a never-opened deck, a broken cache and a deck with no visible slides. Removed words from an older drawing must never come back through Finder, including an already requested thumbnail. An unreadable file can report the system’s read error. Ordinary text and legacy `.deck.md` keep their usual Finder behaviour.

### R4 · Draw when the deck changes

After a successful Ritemark save, make the picture from the saved bytes. While the project is open, redraw after disk changes such as an AI edit, sync or file replacement. Opening a project queues missing and out-of-date pictures. Drawing runs in the background, coalesces rapid changes and leaves the editor and save usable if it fails. An earlier job must never publish over the latest one.

### R5 · Keep pictures on this Mac

Only Ritemark writes the cache, outside the project. No picture, text or cache path goes to an upload or usage event. The Quick Look extensions have read-only access to the home folder and no network. Removing a project clears its pictures. The cache has a size limit and prunes entries for missing sources.

### R6 · Delivered by the Mac app

The 2.4 Mac app carries both sandboxed extensions for arm64 and x86_64 with macOS 12 as the deployment target. Check discovery after first launch from Applications and after an update. If macOS requires a person to enable Quick Look, Ritemark gives the verified System Settings steps. The feature is on by default on Mac. Windows gets no Quick Look cache jobs.

**If a person must turn it on** (the Experience lead): where Ritemark can tell the extension is off (a read-only `pluginkit -m` query), a one-time note in Home's guidance slot, only after the first deck is saved: "Finder can show your decks' first slides. Turn on Ritemark under General → Login Items & Extensions → Quick Look." with **Open System Settings** (a deep link to that pane) and **Not now**. The same line is in Help as "Show decks' first slides in Finder…". The release notes say it once: "On some Macs, turn on Ritemark under Login Items & Extensions → Quick Look to see decks' first slides in Finder." Where Ritemark can't tell, Help and the release notes only. The pane's labels and the deep link are used only after the proof confirms them on that OS.

## Out of scope

Windows Explorer previews, portable pictures and any HTML renderer inside Quick Look.

## Resolved and open questions

The dated decisions and review questions are in the [sprint plan](sprint-plan.md). The [technical plan](technical-plan.md) identifies what still needs proof.
