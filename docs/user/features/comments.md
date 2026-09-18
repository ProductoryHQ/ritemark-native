# Comments

> Annotate any passage without touching the prose.

Select text, drop a note in the right margin, and keep your writing clean — the familiar Google-Docs-style margin model, now in Ritemark.

---

## What You Can Do

- **Anchor a comment on selected text** — select any passage and click **Comment** in the bubble menu; Ritemark highlights the text and opens a note beside it in the right margin
- **Drop a quick standalone note** — type `///` anywhere to add a margin note that isn't tied to a specific passage
- **Hand a passage to an AI agent** — type `@` in a comment, pick Claude, Codex, or OpenCode, and send the note and the commented text to the conversation you have open in the AI sidebar
- **Watch the work honestly** — the comment says what its own task is actually doing: queued, working, waiting for you, finished, or failed
- **Notes that persist** — comments save into the Markdown file itself; they are still there when you reopen the document

---

## How It Works

### Anchored comments

1. Select any text in your document
2. Click **Comment** in the bubble menu that appears
3. Ritemark highlights the selected passage and opens a note card in the right margin
4. Type your note in the card

The highlighted anchor and the margin note stay linked. Hovering either one opens the comment — the highlighted text in the document as well as its marker in the margin. Move the pointer away and it closes again. When you leave the highlighted text there is a short pause first, long enough to reach the note in the margin.

To keep a comment open, click it: either the highlighted text or its marker in the margin. A pinned comment gets a coloured border and stays open wherever the pointer goes, so buttons such as **Send to Claude** are easy to reach. Only one comment stays pinned at a time; clicking another comment moves the pin to it. To close a pinned comment, click its highlighted text again or click somewhere in the text that isn't a comment.

### Standalone margin notes

Type `///` anywhere in your document and press Enter (or Space) to insert a standalone margin note. No text selection needed. Good for reminders or questions that aren't tied to one specific phrase.

In the raw Markdown a standalone note looks like this:

```markdown
<!-- {id:6f1e9f0c-1c2a-4a6b-8f21-9a0f0b7c5d31} Rephrase this -->
```

The `{id:…}` token is Ritemark's, not part of your note. It never appears in the editor and is not sent to the agent as instruction text — it is how a task that is already running keeps pointing at this exact note while you edit around it. Leave it alone; if you delete it by hand, Ritemark can no longer connect that note to its task.

### Writing the note

- The note box **resizes**. Drag the bottom-right corner to make it taller — it stops at eight lines, or 40% of the window height if that is smaller, so the buttons never scroll out of reach. **Cancel** and **Comment** sit outside the scrolling area and stay reachable at any height. The height you drag to is kept for the rest of the session; a new window starts at two lines again.
- Typing **`@`** opens the list of agents straight away. Keep typing to narrow it, use the arrow keys to move, **Enter** or **Tab** to insert, **Escape** to close without inserting — or just click one. The chosen agent is shown in the note while you write and on the comment after you save.

### Editing and deleting comments

- **Edit** — open the comment and click the pencil icon (**Edit comment**); change the text, then press **Comment** (or Enter) to save, or **Cancel** to leave it as it was
- **Delete** — hover the margin marker and click the trash icon; the margin note is removed and the highlighted anchor returns to plain text
- **Mark as done** — once a comment's task has finished, the trash icon becomes a checkmark labelled **Mark as done**. It is the same action under a truer name: the comment is cleared from the document. Clearing a comment is always your decision — an agent never removes a marker itself

---

## Sending a comment to an agent

Mention an agent inside a comment note:

| Mention | Agent |
|-------|-------|
| `@claude` | Claude (Anthropic) |
| `@codex` | Codex (OpenAI) |
| `@opencode` | OpenCode (bring-your-own-key) |

A **Send to Claude** (or Codex, or OpenCode) button appears on the comment. Above it, one line names where the work will go. Pressing the button sends:

- your note, without the `@mention`
- the exact passage the comment is anchored to, so the agent reads the same words you did
- the name of the document you are working in

### Where the task goes

**A comment task goes to the conversation you have open in the AI sidebar.** That is the whole rule — there is no picker and no extra confirmation step. A brand-new empty conversation counts; the task simply starts it.

- The line above the Send button names that conversation, so you always know before you press it. If nothing is open yet, it says **New conversation**.
- If that conversation is busy, your task waits in its queue and runs next.
- If that conversation is running a different agent, the task still goes there and runs as the agent you mentioned — the same runtime switch the sidebar composer offers. The line above the Send button says so before you press it, by adding **· Claude takes over** (or Codex, or OpenCode).
- Once sent, the task stays with that conversation. Switching to another conversation afterwards does not move it.

### Sending several at once

The **Comments** button in the toolbar lists every comment in the document, grouped by agent. Tick the groups you want, check the line naming the destination conversation, and press **Start tasks** — one task per agent, comments in document order. Unassigned comments are never sent.

Each group answers for itself, as its answer arrives:

```text
✓ Claude · 2 queued → Release note review
! Codex · Codex is signed out. Sign in and try again.   [Sign in]
```

You never get a blanket "all sent" when only one group was accepted.

### What each status means

The comment shows its own task's state — never another comment's, and never the conversation's in general:

| What you see | What it means |
|---|---|
| **Sending task…** | Ritemark is asking the agent to take the work. The button is disabled so one click cannot become two. |
| **Queued for Claude** | Accepted and waiting its turn in that conversation. |
| **Claude is working** | The agent is on it right now. |
| **Needs your input** | The agent asked a question, wants a plan reviewed, or needs permission. Open the conversation to answer. |
| **Claude completed this task** | Finished, with a short summary underneath. |
| **Task failed · …** | It ran and did not finish. The reason is shown in plain words, with **Retry** and **Open conversation**. |
| **Task cancelled** | You stopped the run in the AI sidebar. **Retry** sends it again. |
| **Task interrupted when Ritemark closed** | The app closed before the work finished. The line names the cause — the other variants are *Task interrupted when the agent stopped* and *Task interrupted before it reached the agent*. **Retry** sends it again. |
| **Conversation no longer available** | The destination conversation was deleted. Only **Retry** is offered; there is nothing left to open. |

Every state is a symbol plus a sentence, not just a colour, and it survives reloading the document, closing and reopening the tab, and restarting Ritemark. If work was cut short by a restart, the comment says so instead of pretending it is still running.

### When a task is refused

A refusal is not a task that failed — the task is never created. It appears on the comment itself, or on that agent's group in the **Comments** menu, in Ritemark's own words with the action that fixes it:

| What you see | What to do |
|---|---|
| **Claude is signed out. Sign in and try again.** | **Sign in** opens that agent's sign-in. The runtime is checked before the task is queued, so a signed-out agent never leaves you with a task that looks accepted. |
| **That conversation already has ten prompts waiting. Let one finish and try again.** | Let one of the queued prompts finish, then **Try again**. A full queue is a refusal, not a silent success. |
| **Save this document to disk before sending comments to an agent.** | Save the document. Until you do there is no file for the agent to read, so pressing Send again will not help. |
| **The document is still saving. Try again in a moment.** | Wait a moment, then **Try again**. |
| **That comment is no longer in the document.** | The note was deleted or edited away while the request was in flight. |

### Where the reply appears

- **On the comment** — a short plain-language summary of what the agent did, below your own note. If the agent worked without producing an answer to read, the comment says so rather than inventing one.
- **In the conversation** — the full thread, with the reasoning, the file changes, and everything else. **Open conversation** on the comment takes you to the exact conversation that ran the task, not simply the one currently on screen.

**Your comment is never rewritten.** The status line, the summary, and the buttons are shown beside your note; the note itself, the highlighted passage, and the Markdown in the file stay exactly as you wrote them. Nothing is deleted or marked resolved for you when a task finishes — that stays your call.

---

## Persistence

Comments are stored directly in the Markdown file using `<mark data-comment>` attributes (anchored) and HTML comment nodes (standalone). They survive saves, reopens, and round-trips through Ritemark's Markdown converter. No sidecar file is created.

Each comment also carries a short identifier so that a queued task keeps pointing at the right note even while you keep editing around it. Anchored comments have always had one; standalone notes now get one too, which is why a standalone note carries a `{id:…}` token in the raw file (see [Standalone margin notes](#standalone-margin-notes)). Opening an older document does not add identifiers or mark the file as changed — they are added the first time you send that comment to an agent, in one step that a single **Undo** reverses.

> **Note:** Comments are Ritemark-specific HTML embedded in Markdown. They are invisible when the file is opened in a plain-text editor, but do appear in the raw source. They are stripped from exports.

---

## Known Limitations

- **Multi-bullet selections** — selecting across several bullet points and commenting creates one comment anchor per bullet rather than a single shared comment. This will be addressed in an upcoming update.
- **Unsaved documents** — a document that has never been saved cannot be sent to an agent, because there is no file for the agent to read. Save it first.
- **Renaming outside Ritemark** — renaming or moving a document inside Ritemark keeps its comment tasks attached. Moving the file with Finder or Explorer while a task is running does not.

---

## Related

- [Core Editor](editor.md) — basic editing, slash commands
- [Text Formatting](formatting.md) — bubble menu, bold, italic, links
- [AI Agents](ai-agents.md) — Claude, Codex, and OpenCode in the sidebar
- [Keyboard Shortcuts](keyboard-shortcuts.md) — shortcut reference
