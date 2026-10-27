# Ritemark 2.1.0 Release Notes

Ritemark 2.1 makes what your AI writes ready to send. Formulas from ChatGPT and Claude show as typeset equations, in your document and in the PDF and Word copies you share. Saving a document changes only what you changed, and when the AI edits a document you're working in, Ritemark asks one question. A new project's Home offers a first request to start from. The AI you choose says which plans work before you sign in, keeps a chat's model after a restart, and explains a failed reply in one sentence. And **Send feedback**, in the status bar and in Help, reaches the people who make Ritemark.

## Equations

- **Formulas show as math.** Write LaTeX between dollar signs, the way ChatGPT, Claude and most Markdown tools write it: `$…$` in a sentence, `$$…$$` on lines of their own, or ChatGPT's `\(…\)` and `\[…\]`. A dollar amount such as `$5 and $10` stays text.
- **Your file keeps every formula as written.** Obsidian, GitHub, Typora and Pandoc read the same formulas, and an edit elsewhere in the document leaves them alone.
- **Click a formula to change it,** or select it and press Enter. Its LaTeX opens in place, with the result shown as you type. Esc finishes, and one ⌘Z (Ctrl+Z on Windows) undoes the change.
- **A new formula.** Type `$…$`, or `$$` and Enter, or choose **Equation** from the `/` menu or the **+** menu.
- **A formula Ritemark can't typeset** shows its LaTeX with an amber mark that says what's wrong, for example "`\fracc` isn't a command it knows", instead of breaking the page.
- **Copy and paste.** Formulas copy as their LaTeX, and the AI reads them as LaTeX. Formulas pasted from ChatGPT's or Claude's pages arrive as formulas. The status bar counts them.

## Sharing a copy

- **Equations in PDF and Word.** A PDF copy typesets them, in the line or centred, and scales a wide one to fit the page. A Word copy has real Word equations that you can edit in Word.
- **Equations in Google Docs** arrive as pictures, because Google Docs can't take equations from another app. A formula in a table cell goes as its LaTeX, and Ritemark says so.
- **A formula that can't be typeset** goes as its LaTeX, and the message after a PDF or Word copy says how many.
- **Bold, italic and code in PDF copies.** They now come through in paragraphs, headings, lists, quotes and table cells, where a PDF copy used to drop them. A table's header row is bold.
- **Quotes in Google Docs.** Every line of a long quote now starts at the quote's indent, beside a thin bar, instead of at the page margin.

## Your files, as you wrote them

- **Saving changes only what you changed.** Open a Markdown file, change a word and save, and the file changes in that one place. If you keep your documents in git, a diff shows your edit and nothing else. Over the team's own documents, 3 in 100 came back unchanged after one save in 2.0. In 2.1, 89 in 100 do, and the rest change only in the forms under [Known issues](#known-issues).
- **What comes back as written.** Lists, with their marker, the space after it, their indent and whether they are tight or loose. Line breaks. Tables, with the row under the header, the columns' alignment and the spacing in the cells. Dividers, web addresses and code blocks. And front matter, byte for byte, when you haven't changed a property. No line gains spaces at its end, and text such as `snake_case`, `[1]` or `[[Wikilinks]]` no longer gains backslashes.
- **Nothing in the file is lost.** A link to a file in another folder, such as `[the report](notes/report.md)`, a link or bold around code, and images in a row are all kept. A save used to drop them.
- **New writing uses one plain form.** A new list is written `- item`, a line break you type with Shift+Enter is a backslash at the end of the line, and a new divider is `---`. **Make an editable copy** of a Word file and **Copy as Markdown** follow the same rules.
- **One question when the AI changes your document.** When the AI or another app changes a document while you're editing it, Ritemark asks once, with **Review changes** in the document. VS Code's "The content of the file is newer" notification no longer shows as well. If the document is behind another tab, one notification names it. After **Keep my version** or **Use disk version**, your next edit saves without a question. In 2.0 this was a known issue.
- **No question when your words didn't change.** A sync client such as OneDrive that only touched the file, or changed its line endings, no longer stops your save. A document open in VS Code's plain text editor keeps VS Code's own notification.

## The first day

- **A first request on Home.** A project you open for the first time offers one ready request under **Waiting for you**, chosen by what the project holds:
  - **In a folder with files,** **Ask Claude what is here** (or the AI you use) sends it at once, in a new chat. The AI starts from the file names and ends with two things it could do next. The card says that nothing in the folder was moved or changed, and counts what it holds from the names alone, such as "37 files: 20 Word documents, 10 PDFs, 4 spreadsheets and 3 text documents."
  - **In an empty project,** **Tell Claude what this project is for** puts "This project is for " in the message box, with a second line asking for About this project and a first outline. Nothing goes until you press Send.
  - **In the sample project,** **Ask Claude to draft Module 4** gives the board's task to the AI.
- **Choosing the AI for it.** **Ask with** picks the AI, with **Sign in** or **Set up** for one that isn't ready. Pressed again, the card takes you back to the chat it started. It goes once it's answered, once you start a chat of your own, or with ×.
- **Starting points in a new chat.** An empty chat asks "What shall we work on?" and offers up to three starting points for what is in front of you: your project, an empty project, the sample, a short or long text, or a table. A click puts the words in the message box, ready for Send, and nothing is sent until you press it. They step aside while you type. They replace 2.0's three examples, which sent at once.
- **Empty places say what they are for.** An empty Task board, an empty Conversations list and an empty Transcribe library each say what goes there.
- **About this project, from any AI.** Asked to write About this project, Claude, ChatGPT and OpenCode each write the page Home shows under that name.

## The AI you chose

- **Which plans work, before you sign in.** The welcome's AI cards, Ritemark Settings and the sign-in cards on the AI's sheet say it. ChatGPT: "Any plan works, free included." Claude: "Needs a paid plan, such as Pro or Max." OpenCode: "Open models, with an API key of your own." Each card keeps its line once you're signed in.
- **The status bar names your AI.** Instead of "AI Ready", it names the AI your next message goes to: "Claude ready", "Claude: sign in", "No AI yet" or "Offline". It follows sign-ins and switching between chats, and a click opens the AI's sheet.
- **A chat keeps its model.** After a restart, a reload, or opening it from the Conversations list, a chat comes back on the model it last used, and your next message continues the same thread. If that model is no longer offered, Ritemark says so once and uses the default. In 2.0 this was a known issue.
- **A failed reply, in one sentence.** When Claude, ChatGPT or OpenCode can't finish, the chat shows the provider's own sentence once, never its raw error, with one card and one way on:
  - an ended ChatGPT sign-in offers **Sign in to ChatGPT**;
  - a refused key names the company and opens AI Settings;
  - a model the AI won't use offers its default, such as **Use GPT-6.1 Sol**, without sending your message again;
  - a limit says whose it is and, when the AI says, when it resets, with **Continue with** another AI when one is ready.
- **ChatGPT says when it's busy.** When ChatGPT turns requests away because too many arrive at once, Ritemark waits as long as ChatGPT asks and tries again, counting down: "ChatGPT is busy. Trying again in 7 minutes." While more than a minute is left, you can continue with Claude or another AI that is ready. Before, the chat looked frozen.
- **Lists in the AI's answers have their bullets and numbers back,** in muted ink. When the AI offers two things it could do next, you can answer with a number.
- **Every AI says which files it couldn't open,** such as a scanned PDF or a protected document, rather than leave them out.
- **ChatGPT's references to your files are links,** not raw markup.

## Send feedback

- **One door, in four places.** **Send feedback** sits in the status bar and in Help. AI information has it as **Report an AI issue**, and All commands has it too. Each opens one sheet over the window.
- **Send, straight from Ritemark.** With no box ticked, **Send** sends your words to the people who make Ritemark, even with usage data off, and says thank you only once they've arrived. If it didn't go, your message stays, with **Try again** and **Open in e-mail**. Your documents and chats are never included.
- **For an answer, or about the AI.** Tick "I'd like an answer" or "This is about something the AI said or did", and the sheet opens your own e-mail app with a message to info@productory.eu, so you see exactly what goes and send it yourself. Ritemark never asks for your address. In a chat, you can add the AI's last answer, shown to you before anything goes.
- **A question in your first week.** On the third day you save a document in Ritemark 2.1, Home asks once: "What did you make with Ritemark this week?" **Send** or **Not now** ends it.

## Models and Flows

- **Gemini 4 Argon,** Google's flagship reasoning model, is first in a Flow's Gemini list and joins OpenCode's Google and OpenRouter groups. OpenCode's Google group starts with Gemini 3.8 Flash, which a free AI Studio key can use.
- **Current models in OpenCode.** Its Claude group gains Sonnet 5.5, Opus 5.5 and Haiku 5.5, its OpenAI group GPT-6.1 Sol, and its OpenRouter group Claude Sonnet 5.5 and GPT-6.1 Sol. After your first OpenCode chat, each provider you have a key for lists the models the bundled OpenCode can run, so a new model shows up without a Ritemark update.
- **A new Gemini step starts on Gemini 3.5 Flash Lite.** Google now offers the Gemini 2.5 models only to people who used them before, so a new Google account couldn't run the old default. The 2.5 models stay in the list for steps that already use them, and a saved Flow keeps its model.
- **A step's model picker is ready at once,** instead of "Loading models..." for five seconds. An Image step lists the image models your key can use, and its card names the model it runs on. Without a key, the step says which key it needs, with a link to it in Settings. A saved model the list no longer has shows as "Unavailable" until you choose another.
- **A step with no model chosen** shows the model it will run on.
- **Gemini says what went wrong.** A step refused for its model says to choose another model and run the Flow again. An answer that used up the step's Max tokens says that too, instead of "No response from Gemini API". The Gemini list holds every model Google offers your key.
- **Your Google AI Studio key stays out of web addresses.** Ritemark sends it in a request header, so it can't end up in proxy logs or error messages.

## Smaller changes

- **Split buttons are one button.** Home's first-day card, the Task board's Give to, Review with, Retry with and Send to, dictation, and Open in Word, PowerPoint or Excel: one tone, one hover, and never half a button greyed out.
- **The note after a project switch steps aside** after six seconds, or as soon as you start something. It stays while you point at it.
- **Home's folder path** is cut in the middle, keeping your project's own folder whole, with the whole path in its tooltip.
- **A file you transcribe opens as a tab,** and its transcript fills in there, as a recording made in Ritemark does. It opens behind a document you're typing in.
- **The Task board fits the default 1440-wide window** with both side columns showing.
- **File changes** is what Source Control is called in More, at the head of its panel and in View ▸ Advanced.
- **Cleaner edges.** The AI's sheet and the desk draw whole corners.
- **The status bar's items** light up when you point at them and when you press them, in Light and Dark.
- **Claude and ChatGPT** no longer carry "Experimental" badges in Settings.
- **The sign-in buttons on the AI's sheet** match the rest of Ritemark, and each says what it does when you point at it.
- **Open in Excel looks like Open in Word.**

## Usage data

- **New counts, with no text.** With usage data on, Ritemark now also counts:
  - each reply from an AI, in a chat or a Flow, with which AI and how it ended;
  - whether your first message got a reply;
  - a voice capture, and a document begun by voice that you change again on a later day;
  - Home's first request, a starting point used, and a new document, shared copy or Google Docs publish;
  - which door opened Send feedback.
- **Never your words.** No count carries a message, an answer, a model, a file, a name or a project. As in 2.0, nothing is sent with usage data off, and no event carries where you are.
- **Feedback is your own choice.** Send feedback sends what you wrote when you press Send, even with usage data off.

## Updating from 2.0

- **Files saved by Ritemark 2.0.1 or earlier change once,** on their first save in 2.1: the spaces Ritemark put on empty lines go, and so do backslashes that were never needed. Their lists keep the form they have now. After that, they come back as written.
- **Send feedback replaces two older windows.** Report AI issue's window and Send Feedback's four reactions are now the one sheet.
- **Updated built-in agents.** Ritemark 2.1 ships Claude Code 2.1.310, Codex 0.164.0 and OpenCode 1.19.4.
- **Security fixes underneath.** Ritemark 2.1 runs on Electron 43.8.3 with Node 24.22.0, which brings three weeks of Chromium security fixes to the built-in browser and stops trusting a compromised security certificate.

## Fixes

- **Editing a link's address works.** The link dialog changed nothing when you edited an existing link. It now changes the address, from anywhere in the link.
- **No false "Retry document update"** after an AI edit to a document in a window behind other windows.
- **Deleting text no longer freezes the editor.**
- **Your first chat uses the AI you chose in the welcome,** even when the welcome's hand-over is slow.
- **Choosing an agent from a comment's @ list assigns the comment.** The formatting toolbar covered the list, so the click missed.
- **A task's message keeps its line breaks** in the AI's sheet, for every AI.
- **Chat titles in the chat's language.** Automatic titles come from the conversation alone, so your own Claude settings can no longer give an English chat an Estonian title.
- **A stopped reply reads Stopped,** for all three AIs, live and after a restart. It could read Failed or Done.
- **ChatGPT's working note and its answer no longer run together,** so the answer's first heading shows as a heading.
- **The chat's header no longer says "Interrupted"** after a failed or stopped reply.
- **A chat saved by 2.0** shows the provider's sentence for a failed ChatGPT or OpenCode reply, not its raw error.
- **After a project switch, the AI column comes back with Home,** instead of seconds after it, and the document you were in keeps the keyboard.
- **Transcribe on Windows.** An .m4a or .aac file that needs converting on this device is refused before the transcription starts, not halfway; ElevenLabs can still take it. A failed or interrupted card has **Dismiss**, and the recording stays where it is.
- **Ritemark's file pickers start in a folder that exists,** never in a missing Desktop folder.
- **No white strip beside the left column's scrolling lists.** A thin slider shows while you point at a list or it scrolls.
- **A tooltip no longer stays up after a click.**
- **Home fits even the narrowest window** with the AI's sheet open.
- **A task's tab keeps its title after a restart,** not its file's name.
- **A Flow step's Delete row no longer covers Temperature and Max Tokens** in a short window.

## Known issues

- **Some Markdown is still rewritten,** without losing anything: HTML (its text stays), headings underlined with `===`, `_emphasis_` (written `*emphasis*`), reference links (written inline), table columns padded to line up, and `~~~` or indented code (written with backticks). A link around an image, such as a badge in a README, keeps the image and loses the link, as before.
- **Brackets in files saved by 2.0.1.** Ritemark 2.0.1 wrote every bracket as `\[` and `\]`, so a line that holds nothing but `\[draft\]` now opens as an equation. Brackets anywhere else in a line stay brackets.
- **Equations in Word and Google Docs.** Word centres an equation that stands alone in a table cell. In Google Docs, an inline equation may sit slightly high in its line.
- **Source Control's name in places.** File changes' Repositories and Graph views, and its group in Settings, still say Source Control.
- **Windows may warn about a new version.** SmartScreen or Smart App Control can warn about, or block, a newly signed installer while its reputation builds. Installing from the Microsoft Store is the recommended way. See [Installing Ritemark safely on Windows](https://github.com/ProductoryHQ/ritemark-native/blob/main/docs/user/windows-smart-app-control.md).
