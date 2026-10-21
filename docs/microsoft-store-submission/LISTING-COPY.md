# English Microsoft Store listing copy

Use one English listing initially. Review wording against the shipping candidate before every submission.

**2.0 (2026-10-21):** the copy in this file is a draft for Ritemark 2.0, awaiting Jarmo's approval (Sprint 136, R7). Nothing has been submitted. Jarmo enters the approved text in Partner Center himself, through his ChatGPT flow. The copy used up to v1.14.0 is kept below under [v1.14.0 copy (for reference)](#v1140-copy-for-reference), and [What changed for 2.0](#what-changed-for-20) lists each change.

Microsoft's limits ([`OFFICIAL-REFERENCES.md`](./OFFICIAL-REFERENCES.md)): description 10,000 characters; short description 1,000, with under 270 recommended; What's new 1,500; each feature 200, with at most 20; seven search terms of up to 40 characters each, with no more than 21 unique words in all.

## Product name

Ritemark

## Short description

> A writing app where the AI you choose works directly in your files, and you stay the author. Work with Claude, ChatGPT or open models. Each project has its own Home and task board, and your documents stay ordinary Markdown files on your computer.

Under 250 characters, within the recommended 270.

## Description

> Ritemark is a writing app where the AI you choose works directly in your files, and you stay the author.
>
> Ritemark 2.0 puts your project at the centre. Each project has its own Home: what waits for you, a place to start a new text, table or web page, and the documents changed last. Each project has its own task board too. Write down what you want done, give a task to Claude, ChatGPT or OpenCode, and review the result before you mark it done. Switch between projects in the same window, and each one keeps its own tabs.
>
> The first start is a welcome that asks which AI you use. Sign in to ChatGPT or Claude with the account you already use, or use OpenCode with an API key of your own. Then open a folder, start a new project or try the sample project, and your project opens with the AI ready beside it.
>
> Write in a visual Markdown editor, with tables, diagrams and comments. Read Word documents, PowerPoint presentations and PDFs without leaving Ritemark. Turn a recording into a transcript you can edit, on your computer or with a provider you choose. Share a copy as a PDF or Word document, or copy it as Markdown.
>
> The window is calm: no title row, your places in one row, the AI on a sheet of its own and your documents on a raised desk, in Ritemark Light and Ritemark Dark. The terminal opens as a tab.
>
> Your documents remain ordinary files on your computer, and local editing works without an account. AI features need network access and an account or API key with the provider you choose, and they send that provider the context you work on with it. Ritemark explains this boundary in the product and in its privacy information. Anonymous usage data is on by default and never includes your documents, chats, names or location. You can turn it off on the welcome or in Settings.

## Product features

Enter each line as a separate feature. Partner Center adds bullets automatically. Every line is under 120 characters.

| Order | Feature text |
|---:|---|
| 1 | A welcome that asks which AI you use and opens your project with it ready |
| 2 | A Home for each project, with what waits for you and the documents changed last |
| 3 | A task board in every project: give a task to Claude, ChatGPT or OpenCode, then review the result |
| 4 | Switch between projects in the same window; each keeps its own tabs |
| 5 | Visual Markdown editing backed by ordinary local files |
| 6 | Tables, diagrams and comments inside the writing workflow |
| 7 | Word, PowerPoint and PDF previews, drawn on your computer |
| 8 | Audio transcription with clear local and provider choices |
| 9 | Share a copy as a PDF or Word document, or copy it as Markdown |
| 10 | A calm window in Ritemark Light and Ritemark Dark, with the terminal as a tab |
| 11 | Local editing without a Ritemark account |

## Search terms

Seven terms, 10 unique words.

1. `Markdown editor`
2. `writing app`
3. `local-first`
4. `AI writing`
5. `transcription`
6. `task board`
7. `tables`

## What's new

For the first Store submission, **What's new in this version** was left blank, because Microsoft's instructions reserve the field for updates to an existing Store app. Ritemark is now live, so every update fills it.

Copy release-specific text into that candidate's record and keep it under 1,500 characters. Describe only behaviour present in the submitted binary.

### What's new in 2.0

**Drafted from the release notes** ([`docs/releases/v2.0.0/release-notes.md`](../releases/v2.0.0/release-notes.md)), which are themselves still a draft for Jarmo's approval. If the notes change before release, this changes with them. The runtime versions are left out until the notes confirm them. Under 1,150 characters.

> Ritemark 2.0 is a new Ritemark. The window has a calm new frame in Ritemark Light and Ritemark Dark, with no title row: the menu is the button at the start of the left column's strip, and Alt opens it. The first start is a welcome that asks which AI you use, ChatGPT, Claude or OpenCode, and where your work is, with a sample project to try. Your project then opens with the AI ready beside it. Each project has its own Home, with what waits for you, and its own tasks, and you switch between projects in the same window. The terminal is a tab, Settings and Help are behind You at the top right, Export is now Share on the document's bar, and new documents land in your project. Your projects, documents, task boards and chats carry over from 1.14, and your first Home says where things moved. Anonymous usage data is on by default and never carries your documents, chats, names or location. Turn it off on the welcome or in Settings; if you opted out in 1.14, it stays off. Ritemark now runs on a newer VS Code, and the built-in agents are updated. This release also fixes task tabs, row deletion in sorted tables, saving after a conflict and more.

## Additional information

| Field | Copy |
|---|---|
| Developed by | `Productory Services OÜ` |
| Copyright and trademark | `Copyright 2024–2026 Productory Services OÜ. Ritemark is released under the MIT License.` |
| Applicable license terms | `https://www.productory.ai/en/terms/` |

Unchanged for 2.0.

## Claims checklist

Before submission, confirm that:

- “local-first” does not imply that all optional AI/provider processing stays on-device;
- the shipped Windows build contains every listed feature;
- any payment, subscription, provider account, or API-key requirements are disclosed where relevant;
- screenshot captions describe the visible product and do not announce future features;
- no “free”, “best”, or unsupported security/privacy superlatives are added.

For 2.0, also confirm that:

- the copy leaves out "free". The release notes open with "a free writing app"; the Store's pricing is Freemium, and this checklist rules the word out;
- the AI's control of the browser is not claimed, because it is macOS only;
- Google Docs publishing is not claimed, until a Windows check of the Google sign-in is recorded;
- the usage-data sentence matches the privacy page at Submit time ([`LEGAL-AND-URLS.md`](./LEGAL-AND-URLS.md), step 3);
- the copy says ChatGPT, not Codex, as the app does (in comments, @codex still assigns ChatGPT);
- no runtime version is named until the release notes confirm it.

## What changed for 2.0

| Field | v1.14.0 | 2.0 | Why |
|---|---|---|---|
| Short description | A local-first Markdown editor with a list of features | The notes' opening sentence, the AIs, Home and the task board, ordinary Markdown files | 2.0's notes describe Ritemark as a writing app where the AI you choose works in your files |
| Description | Editor-first, three paragraphs | Project at the centre, the welcome, the writing tools, the window, and the same provider boundary with a usage-data sentence | The notes' sections: your project at the centre, the welcome, a calmer window, usage data |
| Features | 8 lines | 11 lines: the welcome, Home, the task board, switching projects, previews and the window added; "reusable insights" and "project file browser" dropped; Export became Share | The notes' new parts; Share is 2.0's word for Export |
| Search terms | `writing`, `AI agents`, `diagrams` | `writing app`, `AI writing`, `task board` | The other four are kept |
| What's new | v1.14.0's text | Drafted from the 2.0 notes | New release |
| Additional information | Developer, copyright, terms URL | Unchanged | Nothing in 2.0 changes them |

## v1.14.0 copy (for reference)

The text this file held up to v1.14.0, which the live listing has used since the first submission (v1.10.1). Partner Center holds the live text.

### Short description (v1.14.0)

> A local-first Markdown editor with visual writing, AI agents, transcription, diagrams, tables, and export.

### Description (v1.14.0)

> Ritemark is a local-first Markdown editor for people who want a clean visual writing experience without giving up ordinary files.
>
> Write and format Markdown, work with tables and diagrams, transcribe audio, create reusable document insights, and export polished results. Integrated AI agents can help with your project while Ritemark keeps the document workflow visible and under your control.
>
> Your documents remain standard files on your computer. Local editing works without an account. Network-connected AI features depend on the provider you choose and may send the context you select to that provider; Ritemark explains this boundary in the product and privacy information.

### Product features (v1.14.0)

| Order | Feature text |
|---:|---|
| 1 | Visual Markdown editing backed by ordinary local files |
| 2 | Tables and diagrams inside the writing workflow |
| 3 | Audio transcription with clear local and provider choices |
| 4 | Integrated AI agents for project-aware assistance |
| 5 | Reusable insights saved as separate Markdown documents |
| 6 | Export for sharing polished results |
| 7 | Project file browser and familiar desktop shortcuts |
| 8 | Local editing without a Ritemark account |

### Search terms (v1.14.0)

1. `Markdown editor`
2. `writing`
3. `local-first`
4. `AI agents`
5. `transcription`
6. `diagrams`
7. `tables`

### What's new in v1.14.0

From [`release-candidates/v1.14.0-candidate-2.md`](./release-candidates/v1.14.0-candidate-2.md), saved in Partner Center on 2026-10-16:

> Ritemark 1.14 adds a task board to every project folder. Capture work, hand tasks to Claude Code, Codex or OpenCode, and review results before marking them done. Voice dictation and on-device transcription now work on Windows and Intel Macs. Browser Recent now records pages you actually visit. New Codex conversations use GPT-6.1 Sol, Claude Haiku 5.5 is available, and the built-in agents are updated. This release also improves dictation reliability, browser tools across Claude conversations, audio file opening, and task/agent cleanup.

### v1.10.0 update draft (superseded)

This file kept it for a later update; v1.14.0's text took its place.

> Durable project-scoped agent conversations now survive restart, with native resume or bounded transcript restoration across supported runtimes. Bundled Claude, Codex, and OpenCode runtimes are refreshed. Supported models gain per-turn thinking-effort controls. Transcribe Insights can save language-aware results as separate Markdown documents. Editor and disk synchronization is more reliable, including safer conflict preservation.
