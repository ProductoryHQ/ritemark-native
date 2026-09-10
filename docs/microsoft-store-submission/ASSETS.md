# Microsoft Store visual assets

Last inventory: **2026-09-10**

## Microsoft requirements used here

- Screenshots: 1 required, 4 or more recommended, maximum 10.
- Store logo: 1:1 box art required.
- 2:3 poster art: recommended.
- Use high-quality screenshots that accurately represent the supported desktop app.

See [`OFFICIAL-REFERENCES.md`](./OFFICIAL-REFERENCES.md) for the current Microsoft source.

## 1:1 Store logo

Upload candidate: [`assets/store-logo-1x1.png`](./assets/store-logo-1x1.png)

| Property | Value |
|---|---|
| Source | `branding/icons/Icon-1024.png` |
| Dimensions | 1024×1024 |
| Format | PNG, RGBA |
| State | Ready for Partner Center crop/preview validation |

Do not edit the copied file independently of the canonical branding source. If Microsoft requests another resolution, export it from the canonical source and document the new file here.

## Reference screenshots

Seven 2880×1800 PNGs from the v1.10.0 release material are stored in [`assets/reference-screenshots/v1.10.0/`](./assets/reference-screenshots/v1.10.0/).

They are **reference material, not approved Store uploads**. At least the inspected set shows `[Extension Development Host]` and project/test content. Final Store screenshots must be captured from the installed signed Windows build and reviewed for private data and Windows fidelity.

| File | Reference subject | Draft caption |
|---|---|---|
| `1-10-0-conversation-rail-full-screen.png` | Agent conversation beside project files | Keep project work and agent conversations visible in one desktop workspace. |
| `1-10-0-all-conversations-pinned.png` | Pinned conversation list | Pin and return to useful project conversations. |
| `1-10-0-conversation-reopened.png` | Reopened conversation | Reopen a project conversation and continue with its saved context. |
| `1-10-0-transcript-context-restored.png` | Restored bounded transcript | Continue supported agent work with clear transcript-context restoration. |
| `1-10-0-thinking-effort.png` | Per-turn thinking effort | Choose the thinking effort for supported models before sending a turn. |
| `1-10-0-agent-switch-boundary.png` | Agent switch boundary | Switch supported agents with a visible conversation boundary. |
| `1-10-0-rename-conversation.png` | Conversation naming | Rename conversations so important work stays findable. |

Captions are under Microsoft's 200-character limit but must be reviewed against the final image.

## Final Windows capture plan

Capture 5–7 images from the exact installed candidate on Windows 11. Prefer a coherent demo workspace with synthetic content.

1. Visual Markdown editing with a real document open.
2. Project files and a useful formatted document.
3. Tables or diagrams in the editor.
4. Transcription choice/result with privacy/cost boundary visible.
5. Integrated agent assistance beside the document.
6. Reopened/pinned conversation workflow.
7. Export or another primary end-user result.

## Final Windows screenshots — v1.10.1 candidate 3

Captured on 2026-09-10 at 1920×1080 from the installed signed candidate (`93f9adce…`), using a synthetic "Harbour Lane Bakery" project and a disposable profile. Files are in [`assets/store-screenshots/1.10.1/`](./assets/store-screenshots/1.10.1/); order and captions are recorded in [`release-candidates/v1.10.1-candidate-3.md`](./release-candidates/v1.10.1-candidate-3.md).

| File | Subject from the capture plan |
|---|---|
| `01-visual-markdown-editing.png` | 1, 2 and 3 — visual editing, project files, a table |
| `02-agent-edits-open-document.png` | 5 — agent assistance beside the document |
| `03-export-pdf-word.png` | 7 — export |
| `04-recipe-document.png` | 2 — project files and a formatted document |

Plan item 4 (transcription) is left out, because the Windows on-device engine is not available yet. Item 6 (reopened/pinned conversation) is left out, because the conversation list is too narrow to read at this size.

## Final screenshot acceptance checklist

- [ ] Captured from the installed signed Windows candidate, not Extension Development Host.
- [ ] Windows chrome and shortcuts are accurate.
- [ ] No developer banners, test flags, mock-only labels, or debug tooling.
- [ ] No real customer data, private filenames, credentials, API keys, account identifiers, or personal notifications.
- [ ] Synthetic demo content is readable and professional.
- [ ] Every visible feature ships in the submitted candidate.
- [ ] At least four images are selected; no more than ten.
- [ ] Ordering tells a clear product story.
- [ ] English captions describe only what is visible.
- [ ] Partner Center preview does not crop important UI.

## Optional artwork

A dedicated 2:3 poster-art asset has not been prepared. It is recommended rather than required for this EXE listing. Create it only from approved Ritemark branding and review it separately; do not stretch the square icon.

## Asset replacement rule

Reference images can remain for historical context. Put final Store screenshots in `assets/store-screenshots/{version}/`, update this inventory, and record the chosen order in the relevant release-candidate record.
