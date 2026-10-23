# Ritemark key features

The team's one list of what Ritemark is good at, in order. The site's Features menu and hub, the homepage, `llms.txt`, the Microsoft Store listing and the films are built from it. When one of them disagrees with this file, this file wins and the other one is fixed.

**Who keeps what**

- **Development manager:** what is true and shipped. A row changes in the same PR as the feature it describes, and a row may only claim what the linked user doc says.
- **Strategy Room:** the order, and the words we lead with.
- **Inbound Traffic manager:** the site, `llms.txt` and the homepage follow this list. Social and the Experience lead follow it for the Store and the films.
- Every place built from this list names the version of it that it follows (the commit of this file).

**Who it is for:** people who lead with ideas and turn notes, recordings and sources into documents for someone else (consultants, analysts, trainers, technical writers). Today they copy between ChatGPT or Claude and Word. Their two pains are getting work in and getting it out.

**The line:** Ritemark turns a folder on your computer into a workspace where ChatGPT or Claude work with you.

**Plans, on every page that names them:** any ChatGPT account, Free included, or a paid Claude plan. OpenCode runs open models with your own API key.

Version: Ritemark 2.0.0. First written 2026-10-23 (Inbound Traffic manager, order by the Strategy Room).

---

## The menu: seven

| # | Feature (EN / ET) | In plain words | Since | User doc | Site page | Picture |
|---|---|---|---|---|---|---|
| 1 | Your AI in your documents / Sinu AI sinu dokumentides | ChatGPT or Claude works directly in your files, on its own sheet beside the document. No more copying. Plan only shows what it intends before a file changes. | 1.0; 2.0 sheet | [ai-agents](user/features/ai-agents.md), [ai-assistant](user/features/ai-assistant.md) | /features/ai-agents/ | S4 |
| 2 | Projects with their own Home / Iga projekt oma avalehega | Each folder you work in is a project with its own Home: what waits for you, what changed last, and where to start. Switch projects in one window. | 2.0 | [getting-started](user/getting-started.md) | none yet (see below) | S3 |
| 3 | Share / Jagamine | Send a copy as Word or PDF, or publish to Google Docs. The original stays on your computer. | 2.0 (was Export) | [export](user/features/export.md), [google-docs](user/features/google-docs.md) | /features/text-editor/ (screen) | editor-export |
| 4 | Your files as they are / Sinu failid, nagu need on | Read the Word, PDF and PowerPoint files you already have, edit CSV and Excel as tables, and make an editable copy of a PDF or Word file when you need one. | 1.x; 2.0 editable copy | [previews](user/features/previews.md), [spreadsheets](user/features/spreadsheets.md) | /features/data-files/ | data-window, S6 |
| 5 | Task board / Ülesannete tahvel | Give a task to your AI, keep working, and review what comes back before you call it done. | 1.14 | [task-board](user/features/task-board.md) | none yet (see below) | S5, hero-3-board |
| 6 | Comments the AI works on / Kommentaarid AI-le | Leave a comment in the text. Your AI answers or makes the change, and you decide. | 1.x | [comments](user/features/comments.md) | /features/ai-agents/ (screen) | agents-comments, review-answer |
| 7 | Transcribe / Transkribeerimine | Turn a meeting or an interview into text you can edit, on your computer or with a provider you choose, then the decisions and the note. | 1.x | [transcribe](user/features/transcribe.md) | /features/transcribe/ | transcribe-window |

## The hub only

These are real and stay on the features hub, but they don't lead.

| Feature (EN / ET) | Why not in the menu | User doc | Site page |
|---|---|---|---|
| Text editor / Tekstiredaktor | The ground under 1, not a reason on its own. | [editor](user/features/editor.md) | /features/text-editor/ |
| Agents and flows / Agendid ja töövood | The inked direction, but most first users don't reach it yet. Promote it when the User lead's data shows they do. | [agent-library](user/features/agent-library.md), [flows](user/features/flows.md) | /features/flows/ |
| In-app browser / Sisseehitatud brauser | Useful, not a first reason. | [browser](user/features/browser.md) | /features/in-app-browser/ |

**Local and open source** is a promise, not a feature: your documents are files on your computer, no Ritemark account, MIT licence. It belongs in the trust line or the footer of every page, not in the menu.

## Claim guards

- Plans: "any ChatGPT account, Free included, or a paid Claude plan". Never imply a free Claude plan works.
- The AI's control of the in-app browser is **macOS only**. Never claim it on Windows.
- PowerPoint files are read-only previews. "Make an editable copy" is for PDF and Word only.
- Excel: `.xlsx` cells can be edited; `.xls` opens as a preview.
- Ritemark says ChatGPT where it names the AI. Codex is named only as what ChatGPT runs (OpenAI's Codex) or as `@codex` in comments.

## Gaps this list shows

- **Projects with their own Home** and **Task board** are in the top five but have no feature page on the site yet. Their story pages are the next site work.
- [user/features/README.md](user/features/README.md) is the user-docs index and still describes 1.x ("Three Modes", "Codex in the sidebar"). It should link here and be brought up to 2.0.
