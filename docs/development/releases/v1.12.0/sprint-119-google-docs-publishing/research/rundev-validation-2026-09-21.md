# RunDev validation: 2026-09-21

**Build:** the sprint worktree's extension (`sprint-119-google-docs-publishing`) running in main's shell build (a copy-on-write clone of `vscode/` at gitlink `10c8e557`). Fresh profile. The disposable Phase 0 canary OAuth client was supplied through the runtime environment and was not compiled in.
**Driven by:** Claude over DevTools, with Jarmo at the machine for the Google consent screen and the two native confirmation dialogs.
**Test file:** a Markdown file with headings, inline styles, a link, a nested mixed list, a task list, a table, a quote, a code block and a local image (`img/red.png`).

| Step | Result |
| --- | --- |
| Export menu, not connected | Shows "Connect Google Docs…". It opens Settings scrolled to the Google Docs card, whether Settings was open or closed. The scroll was added in this run; before, Settings opened at the top. |
| Connect, then Cancel | The card shows "Google sign-in opened in your browser" with Cancel sign-in. Cancel returns it to Connect with no error message. If the consent is completed after Cancel, the browser shows "refused to connect", because the listener has closed. That is expected. |
| Connect | Consent completed by Jarmo; the browser page says "Ritemark is connected". The card shows Connected, jarmo@productory.eu, template None. |
| Export menu, connected | Shows "Create Google Doc". |
| Create | Progress notification, then "Google Doc created: …" with Open Google Doc. The title came from the frontmatter `title`. The link record holds ids and times only, no token. |
| The created Doc | Correct: headings, bold, italic, strike, inline code, link, numbered list, table, quote, code block, image. Known API limits, as recorded in Phase 0: the ticked task is unticked, and the bullets nested under a numbered item show `a./b.`. |
| Export menu, linked | Sync Google Doc / Open Google Doc / Remove Google Docs link… |
| First Sync after an edit | The native "Sync to Google Docs?" confirmation appeared; Jarmo confirmed. The Doc updated with the same file ID, and `overwriteAcknowledged` became true. |
| Sync with no change | "… is already up to date." No write. |
| Remote edit, then Sync | A sentence typed into the Doc in Google Docs was detected. The native remote-edit warning appeared; Jarmo chose Overwrite with Ritemark. The Doc matches Ritemark again, same file ID. |

### Second round: templates, remove link, disconnect

| Step | Result |
| --- | --- |
| Choose template | The card shows "The Google file picker opened in your browser" with Cancel. Jarmo picked "Digital Nation AI koolitus" in Google's picker, and the card showed it with Change template and Remove template. |
| Create from the template | The new Doc took the template's styles (Arvo headings, purple H1, magenta H2), and the link record stores the template id. **But the template had four document tabs**: the Ritemark text went into the first tab ("I osa"), and the other three tabs carried the whole training content into the new Doc. Fixed (commit `414ad69e`), see below. |
| Remove Google Docs link | After a window reload the dialogs were in-window, as `window.dialogStyle: custom` intends, so this one was clicked over DevTools. The link record was removed, and the menu went back to Create Google Doc. The Google Doc stayed. |
| Create from the template again | One tab, named after the Doc ("Ritemark template check (Sprint 119)"), with the template's icon cleared and its styles kept. |
| Remove template | The card went back to "None (Google Docs default styles)". |
| Disconnect | The card shows Connect Google account, and the editor menu shows Connect Google Docs…. Both link records are kept for a later reconnect. Revocation at Google is best-effort and was not checked separately. |

## Found and fixed in this run

- **Settings opened at the top**, far above the Google Docs card. `ritemark.aiSettings` now takes a section (commit `9f2151ec`).
- **Bare relative images did not display in the editor** (`![x](img/a.png)`). Jarmo reported it. While fixing it, a worse existing bug turned up: `../` images were saved back as their `vscode-resource` display URI. Both are fixed through one shared rule in `src/utils/imagePaths.ts`, with a round-trip test (commit `d08d3b46`). On RunDev, an edit and save kept `![A red square](img/red.png)` intact.
- **A multi-tab template leaked its other tabs into every new Doc.** Docs writes and Sync address only the first tab. After copying, Create now deletes the other tabs and the first tab's children, and renames the kept tab (commit `414ad69e`, uses `deleteTab` and `updateDocumentTabProperties`).
- **A stalled Google request could hang forever.** It wasn't observed failing, but the plan requires a bound. There is now a 60 s deadline including the body (commit `8a766399`).

## Found, not fixed here

- **Saving drops strikethrough** (`~~x~~` → `x`). The Markdown serializer has no strike rule. This predates Sprint 119 and is unrelated to Google Docs, so it was filed as a separate task.
- **`window.dialogStyle: custom` took effect only after a window reload,** not after an app restart, so the first confirmation dialogs were native. That is a dev-profile quirk, not a product issue.

## Not exercised in this run

Changing a template (the same Picker flow as choosing), reauthorization after a revoked grant, images that fail to upload, rename, Windows, and a packaged build.
