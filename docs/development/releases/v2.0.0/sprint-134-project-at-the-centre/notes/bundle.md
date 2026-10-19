# The webview bundles (E4, #107)

| When | Commit | `media/webview.js` | `media/office-preview.js` |
|---|---|---|---|
| Before (the sprint's start) | `eae1dedd` (main, Sprint 133 merged) | 8,540,208 bytes | 2,550,577 bytes |
| After (the PR's head) | `3d7366ac` | 8,603,102 bytes | 2,575,212 bytes |
| Growth | | +62,894 bytes (+0.74%) | +24,635 bytes (+0.97%) |

The technical plan's figure (8,478,880) is from `d781a0e1`, Sprint 132's merge 1.

## What added it

`media/webview.js` grew with the sprint's new pages in the shared bundle:
- Home and the projects list (`webview/src/components/home/`, with its own stylesheet, `home.css`);
- the share question card on the AI's sheet (`ai-sidebar/ShareQuestionCard.tsx`);
- the Tasks list in the order work moves (`tasks/TasksList.tsx`, `taskList.ts`);
- the Advanced settings link (`settings/AdvancedSettingsLink.tsx`).

The bundle's stylesheet is 14,471 bytes of that growth (226,024 → 240,495 bytes), about half of it Home's `home.css`. The eight icons below are in this bundle too.

`media/office-preview.js` grew for three reasons:
- the shared icon list (`ui/Icon.tsx`), which both bundles carry, gained eight Phosphor icons: book-open-text, file-pdf, folder-simple, presentation, tray-arrow-down, user, caret-left and google-logo;
- Tailwind's stylesheet, which both bundles build from every source file, grew by 2,146 bytes (174,552 → 176,698) with the classes the new pages use;
- the Word bar gained Share and Make an editable copy (`viewers/viewerShare.ts`, `ViewerToolbar.tsx`).

## The default cover

Home's default cover is not inlined. It is the welcome's picture, `media/welcome/welcome-hero.jpg`, which `HomePanel.ts` passes to the page as a webview address (`data-cover`). A project's own cover is a file in its `.ritemark/` folder, served the same way.
