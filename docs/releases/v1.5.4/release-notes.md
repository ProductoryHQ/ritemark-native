# Ritemark v1.5.4

**Status:** Draft
**Type:** Patch release
**Focus:** Table of Contents ergonomics + CSV to Excel fixes

---

## Downloads

| Platform | Download |
|----------|----------|
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.5.4-win32-x64-setup.exe) |

---

## Summary

Ritemark v1.5.4 turns the Table of Contents into a proper side rail on wide screens and fixes two long-standing annoyances with "Open in Excel" for CSV files on Mac.

---

## What's New

### Inline Table of Contents

The **Contents** button in the document header now opens an inline Table of Contents as a sticky left column, giving you a persistent outline of the current document while you write.

- **Sticky left rail:** 220px column that stays put as you scroll the document
- **Wide-screen only:** The inline panel only appears when the editor container is at least 960px wide; on narrow windows the Contents button still opens the classic dropdown so nothing breaks on small screens
- **Active heading highlight:** The section you're currently reading is tracked by scroll-spy on the real editor scroll container and highlighted in indigo — so the ToC doubles as a position indicator
- **Preference is remembered:** Whether you had the inline ToC open or closed is stored in localStorage and restored on next launch
- **Minimal chrome:** The panel's scrollbar is hidden until you hover over it, so the rail stays visually quiet when you're focused on writing
- **Click to jump:** Clicking any heading scrolls the editor straight to that section, same as the dropdown

### CSV "Open in Excel" now converts to .xlsx

When you click **Open in Excel** on a CSV file, Ritemark now converts it to a temporary `.xlsx` file (via SheetJS) before handing it off to Excel, instead of opening the raw CSV.

This fixes two real-world problems Mac users hit regularly:

- **Encoding mojibake with Estonian / EU characters:** Mac Excel's CSV importer assumes MacRoman and mangles UTF-8 characters (ä, õ, ü, ž, etc.). Going through .xlsx preserves the encoding.
- **Semicolon-delimiter locale issues:** In EU locales, Excel expects `;` as the CSV separator and may break columns incorrectly when the source file uses `,`. The .xlsx conversion sidesteps the locale entirely.

The temporary .xlsx file is cleaned up automatically after 5 seconds.

---

## Improvements

### Shared heading utilities

Heading extraction and scroll-to-heading logic is now shared between the dropdown Table of Contents and the new inline Table of Contents via a new `lib/headingUtils.ts` module. One source of truth, fewer bugs.

---

## User Impact

- **Long-document writers** get a real outline rail that stays visible while editing, with live position tracking
- **Mac users opening CSV files in Excel** no longer have to fix Estonian or other non-ASCII characters by hand, and no longer have to wrestle with locale-driven delimiter surprises

Both features work out of the box. No new configuration and no new dependencies on the extension host side.

---

## Technical Notes

New files:

- `extensions/ritemark/webview/src/components/InlineTableOfContents.tsx` — inline sticky-column ToC with scroll-spy and indigo active-heading highlight
- `extensions/ritemark/webview/src/lib/headingUtils.ts` — shared heading extraction + scroll-to-heading helpers
- `extensions/ritemark/src/utils/openExternal.ts` — helper used when opening spreadsheets externally

Modified:

- `extensions/ritemark/webview/src/App.tsx` — inline ToC wiring, width detection, localStorage persistence
- `extensions/ritemark/webview/src/components/header/DocumentHeader.tsx` — Contents button toggles inline on wide screens, dropdown on narrow
- `extensions/ritemark/webview/src/components/header/TableOfContents.tsx` — refactored to use shared heading utils
- `extensions/ritemark/src/excelEditorProvider.ts` and `src/ritemarkEditor.ts` — CSV → .xlsx conversion path via SheetJS before external handoff

No new extension-host dependencies. SheetJS (`xlsx`) was already bundled for the existing spreadsheet viewer.

---

## Included Work

- `feat(sprint-51): inline ToC + CSV-to-Excel via xlsx conversion` (797694b)
