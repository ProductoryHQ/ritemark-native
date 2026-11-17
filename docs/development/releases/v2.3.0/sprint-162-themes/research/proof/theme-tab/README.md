# Sprint 162 PR 2: proof for the theme's own tab

Taken on 17 November 2026 in one isolated dev instance (`scripts/qa/dev-launch-isolated.sh`: a fresh profile and AI homes, `window.dialogStyle: custom` so the close question can be shot) at 1440 × 900, on a synthetic project "Trainings": `Slide library/Themes/Evening.theme.md` and `Harbour.theme.md`, two decks naming Harbour ("Harbour — AI assistants", "Harbour — Working with data") and one with no `theme:` line.

## The fault first
- With the Decks flag off (as on main before this PR), `Harbour.theme.md` opens as an ordinary document: an empty page reading "Start writing…", its colours hidden in front matter (shot 00). There is no Edit or New theme in the Theme menu.
- Found while proving: the first run of the tab saved the draft by itself a second after a change, so the decks changed without Save. Ritemark auto-saves after 1 s (`files.autoSave: afterDelay`). The fix: the `ritemark-theme` language for `**/Slide library/Themes/*.theme.md` with `files.autoSave: off`. After it, a draft stayed unsaved (the file `cmp` same as before) for as long as it was left.
- Also found: the Save notice never came, because the change event reaches the extension before the document is marked changed, so the draft was taken for the file's own text. The host now reads that state a moment later; then the notice came, with its Undo.

## In the app, on the final head
- **Opened and closed without a change:** Edit Harbour, then the tab's ×: `cmp Harbour.theme.md <copy>`: same, and its modified time unchanged (nothing written).
- **A colour, then Save:** the accent typed as `#FF7A45`. The tab got its dot, the bar Not saved, Discard and Save (shot 03); both decks still drew `--s-acc: #2EC4B6` and the file was unchanged. Save: `diff` shows one line, `accent: "#2EC4B6"` → `accent: "#FF7A45"`; both open decks drew `#FF7A45` at once; the bar said "Harbour is saved. 2 decks have the new look. A published page keeps its look until you update it." with Undo (shot 07).
- **The Save's Undo:** after a second Save (Round corners), Undo put the file back byte for byte (`cmp` with the file before that Save) and the tab kept Round, Not saved. Discard then cleared it, the file unchanged.
- **Closing with a draft** asks "Do you want to save the changes you made to Harbour?" with Don't Save, Cancel and Save (shot 04). It doesn't list the decks: see Not verified.
- **Save as a new theme…** with a pink accent, "Harbour 2", Use it in this deck unticked: `Harbour.theme.md` `cmp` same as before; `Harbour 2.theme.md` differs from it in `name:` and `accent:` only; both decks kept `theme: Slide library/Themes/Harbour.theme.md` and the old look; the tab moved to Harbour 2. With "Use it in Harbour — AI assistants" ticked (from Harbour Light's tab), that deck's `theme:` line named the new file and the old file was unchanged.
- **New theme…** (shot 05): from Paper, "Harbour Light", Use it in this deck ticked: `Harbour Light.theme.md` written in Paper's format, the deck's `theme:` line the only line changed, "This deck uses Harbour Light now." with Undo, and its tab opened (shot 08).
