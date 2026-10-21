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

## 2.0 screenshot plan

Planned for Sprint 136 (R7) and not captured yet. Six scenes are planned. The Experience lead picks the final scenes and their order, and the Windows session takes them. Jarmo approves the images and captions before they go to Partner Center.

### What they replace

The four v1.10.1 candidate 3 screenshots in [`assets/store-screenshots/1.10.1/`](./assets/store-screenshots/1.10.1/) (`01-visual-markdown-editing.png`, `02-agent-edits-open-document.png`, `03-export-pdf-word.png`, `04-recipe-document.png`). They have been live since the first submission and were kept for v1.14.0. They show 1.x's window, with its title row, activity bar and Export, so none of them matches 2.0. All four are replaced. The files stay for history, as the asset replacement rule below says.

### How they are taken

- **The app.** The installed, signed Windows 2.0.0 candidate: the exact installer whose SHA-256 is in `release-candidates/v2.0.0-candidate-N.md`, on Windows 11. Never a development build or Extension Development Host.
- **The size.** 1920 × 1080 PNG, as v1.10.1's were.
- **A disposable profile.** Its own short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, as the `ritemark-automation` skill's "Launching an installed build" describes. With its own shared data folder, the welcome and Home's projects list show no real recent folders (#475).
- **Usage data marked as a test.** `RITEMARK_BUILD_CHANNEL=test` in the environment (R10, #480), or `"ritemark.features.analytics": false` in the fresh profile. For the welcome scene, prefer the marker, so the welcome's switch shows as a new person sees it.
- **Synthetic content.** The sample project, "Leadership programme": **Try the sample project** on the welcome copies it to `Documents\Ritemark\Leadership programme`. Harbour Logistics and everyone in it are fictional. Any other project in the projects list is synthetic too.
- **A real sign-in, nothing personal on screen.** Scenes 3 and 4 need a signed-in AI (Claude or ChatGPT). Use a test account, and check that no account name, email address or avatar shows in **You**, on the AI's sheet or in Settings.
- **Two additions to the sample.** It holds no Word or PDF file and no recording:
  - for scene 5, **Share** ▸ Word (or PDF) on `Brief.md`, saved into the project;
  - for scene 6, a short recording in a synthetic voice, for example text to speech reading `Meetings/Call with the HR lead.md`, saved as `.wav` or `.mp3`. On-device transcription on Windows can't read `.m4a` or `.aac`.
- **Only what Windows ships.** No AI browser control, which is macOS only, and no Copilot Chat, which production builds don't include.

### The scenes

Captions are drafts, each under 120 characters (the limit is 200). Each caption is checked against the final image, and rewritten if the image shows something else.

| # | Scene | What is on screen | Draft caption |
|---:|---|---|---|
| 1 | The welcome | First start on the fresh profile. The welcome asks its two questions one at a time, so the scene is one step: step 1, "Which AI do you use?", or step 2, "Where is your work?", with "Signed in to Claude" (or ChatGPT) above it. The Experience lead picks the step | Step 1: On the first start, the welcome asks which AI you use. Sign in with the account you already use, or skip for now. Step 2: Choose where your work is: a folder you already have, a new project, or the sample project to try. |
| 2 | A project's Home | "Leadership programme" on its Home: cover, mark, name and line; **Waiting for you** with at least one item (scene 4's task); **Start something**; **Last changed**; the projects list in the left column | Each project has its own Home: what waits for you, a place to start something new, and the documents changed last. |
| 3 | Writing with the AI beside | A module, such as `Modules/Module 1.md`, on the desk, and the AI's sheet with a short, finished exchange about the project | Write with the AI you chose beside your document. Ask about the project and read the answer next to your work. |
| 4 | Tasks with a task that waits | "Draft Module 4 from the brief" given to Claude or ChatGPT and back as **Ready to review**: under **Your calls**, marked **Waiting for you**, with the count on the Task board's tab | Give a task to Claude, ChatGPT or OpenCode, then review the result. Tasks that wait for you come first. |
| 5 | A Word or PDF preview | Scene 5's file open as pages, with the preview's toolbar | Word: Read a Word document as pages without leaving Ritemark. The preview is drawn on your computer. PDF: Read a PDF as pages without leaving Ritemark, or make an editable copy of it. |
| 6 | Transcribe | Scene 6's recording in the Transcript Workbench, after **On-device · Whisper**: the transcript, the waveform and a line playing. The first run downloads the 834 MB speech model | Turn a recording into a transcript you can edit, on your computer. Click any line to hear that moment. |

Before scene 4 is taken, read the Module 4 the agent wrote, so the screenshot shows nothing odd.

### Where they go

Put the files in `assets/store-screenshots/2.0.0/`, named by order (`01-welcome.png` and so on). Record the chosen order and captions in the v2.0.0 candidate record, then add the set to this inventory, as was done for v1.10.1. Every image passes the acceptance checklist below.

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
