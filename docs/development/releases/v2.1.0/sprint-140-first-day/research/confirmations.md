# Confirmations (technical plan, *The audits*, 3)

26 October 2026, on the Mac. Each line says how it was confirmed: by reading the code, by a run, or not.

| What | Result | How |
|---|---|---|
| Every empty place's sentence is true: chats are kept on this computer, never in the project's folder | True for all three AIs. Ritemark's records are under global storage (`conversations/v1/`); each runtime keeps its own session files in its own home (`~/.claude`, `~/.codex`, OpenCode's data folder), none in the project | Code; the QA projects' folders held no chat file after their chats |
| A person's save counts as a saved day | The Markdown editor's save is a `TextDocument` save, so `onDidSaveTextDocument` fires. Office previews and PDFs are read-only and never save. The CSV table editor's save was not checked | Code; a run: a Markdown save on a third day brought the feedback card (S61) |
| `m4d7r2` in every copy of the sample | In `sample-project/Leadership programme/.ritemark/tasks/` since the welcome (Sprint 133, `eae1dedd`); the welcome copies the folder whole | Git history; the QA copy |
| Give when `m4d7r2` is not in To do | Give's own answer (for example, the card is no longer on the board) shows as the card's problem line; nothing else happens | Code (`BoardController.give` → `tryStart`); not run |
| "A chat was started in this project" from the index | The chat index's `scopeId` for the project, without opening records; the ready request's chat and task chats are left out | Code; a run: a chat of one's own took the card away (S26) |
| Counting names hydrates nothing | `fs.readdir` with types only, no `stat` and no read, so File Provider and Cloud Files placeholders are listed by name and never fetched. 10,400 local names: 34 ms the first time, 6 ms after; "More than 10,000 files." | Code; a timing run on a local folder. **Not run** on OneDrive, SharePoint or Google Drive (Mac or Windows) |
| Where a new document is "made" | Ritemark's New (Home's Text and Table tiles, `createDraftAndOpen`) on its first save; Save as Markdown (Make an editable copy); a PDF or Word export that succeeded; a Google Docs publish that created or synced; a file created in the project during an AI turn in this window. A sync client's download is none of these | Code; runs: a new document's first save (S67, once only) and the sample's Module 4 written by ChatGPT (`made_something {new_document, after_ready_request: true}`) |
