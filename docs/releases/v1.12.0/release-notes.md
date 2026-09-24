# Ritemark 1.12.0 Release Notes

> Draft. Each v1.12.0 sprint adds its section here; the release manager edits the whole file before publishing.

## Publish to Google Docs

Sprint 119 lets you hand a document to people who live in Google Docs without giving up Markdown.

Connect a Google account once, in the new **Google Docs** card in Settings. Then choose **Export → Create Google Doc**, and the document appears in your Google Drive as a real Google Doc. Headings, lists, tables, links, code, quotes, images and diagrams all come through. Ritemark remembers which Doc belongs to which file. After you edit, **Export → Sync Google Doc** updates that same Doc: same link, same sharing, no copies piling up in Drive.

Sync is deliberately one-way. Your markdown file is the original, and nothing is read back from Google Docs. Because Sync replaces the Doc's text, Ritemark asks before the first overwrite. It warns you again whenever someone has edited the Doc in Google Docs since your last Sync, with **Open Google Doc** so you can look first. When nothing has changed, it says so and writes nothing.

**Templates.** Pick any Google Doc as a template, and new Docs start as a copy of it, with your fonts, colours, header and footer. Sync replaces only the text, so the template's look stays.

**Narrow access.** Ritemark asks Google for one permission, which covers only the Docs it creates and the template you pick. It can't see or change anything else in your Drive. Sign-in tokens are stored encrypted on your computer. Everything travels directly between your computer and Google, and Ritemark's analytics record nothing about publishing. Disconnect revokes the access; it never deletes a Google Doc.

**When a Doc can't be synced,** Ritemark says why and offers the way out. A Doc in the Drive trash can be restored or unlinked. A document published from another Google account asks you to reconnect that account instead of writing to the wrong one. A missing or unsupported image is named rather than silently dropped.

Two things Google's API can't do: a ticked checkbox arrives unticked, and bullets nested under a numbered item show as a., b. [How publishing works](../../user/features/google-docs.md)

## Record in Transcribe

Sprint 118 lets you record from your microphone straight into Transcribe.

The Transcribe panel has a new **Record** button, marked with a dot, beside **Add recording**. The first time you press it, your operating system asks for microphone permission. While it waits, the panel shows "Waiting for microphone permission…" with **Cancel**. Every button in the panel now has a tooltip that says what it does, or why it is unavailable.

While you record, the panel shows the elapsed time and the approximate size of the audio saved so far. **Stop and use** puts the recording into the same engine-choice card as Add recording. Nothing is transcribed and nothing is uploaded until you choose an engine. The recording is an ordinary audio file that stays where it was saved, and clearing the card keeps it. **Cancel** asks first once there are more than 5 seconds of audio, and moves the recording to the Trash rather than deleting it.

**Where the file goes.** With a folder open, recordings go into a `recordings` folder inside the project. With several folders open, they go into the folder of the file you are editing, and otherwise Ritemark asks which. With no folder open, Ritemark asks where to save before the first recording, remembers the choice, and shows it under the buttons with **Change**. A file is named by date and time, like `Recording 2026-09-22 14.05.wav`, and is a 16 kHz mono WAV of about 115 MB per hour. An existing file is never overwritten: a second recording in the same minute gets " (2)".

**A recording is written to disk as it happens,** as a `.wav.part` file next to where it will land. If the panel reloads, or Ritemark quits or crashes mid-recording, the audio is kept. The panel then shows "Recording interrupted" with **Save recording** and **Discard**. Discard moves it to the Trash.

**When recording can't continue,** it stops and what was recorded is saved, with a note saying why. That happens if the system pauses audio input, the microphone disconnects, or Ritemark can't keep up with saving. A warning appears after 2 hours; at 4 hours the recording stops and saves automatically.

**If microphone access is denied,** the panel says so and offers **Microphone Settings**, which opens the system privacy settings on macOS and Windows.

**The microphone is recorded as it is,** with no echo cancellation or noise suppression, so the other side of a call played through your speakers is kept.

Record works on macOS and Windows, wherever Transcribe runs. It is on by default. The setting `ritemark.features.transcribe-direct-recording` switches it off and hides **Record**; a recording already in progress still finishes. [How recording works](../../user/features/transcribe.md#record-directly)

## Ritemark's own privacy policy and terms

Ritemark now has its own privacy policy and terms of use on ritemark.app, in English and Estonian. Productory Services OÜ remains the provider. The links in the app (analytics consent and AI information) point there now. The privacy policy has a section on exactly what Google Docs publishing does with your Google data. The old productory.ai addresses still work for earlier versions.

## Clearer Agent Chat

Sprint 122 makes it obvious which conversation you are in, gives long prompts room, and makes every link in a reply do something.

**The conversation is named.** A header above the transcript shows the title of the conversation you are in. Its **⋮** menu has **Rename**, **Pin** or **Unpin**, and **Delete** — the same actions, words and confirmations as the conversation history.

**The composer has room.** It grows with what you write, up to eight lines instead of about five. To set the height yourself, drag the handle on its top edge — up for taller, down for shorter, as tall as the sidebar allows — or focus it and use the arrow keys. Double-click the handle to go back to fitting the text. Ritemark keeps the height you chose while it is open, and the send button and model control always stay on screen, even at large zoom levels.

**Links do something, or say why not.** A file in your project opens in its editor, and a folder is shown in the project tree. A file outside your project is shown in Finder rather than opened, because a path in a reply is written by the AI, not by you. A missing file names the path. A link Ritemark does not open from chat, such as `mailto:`, says so and offers **Copy link**. Right-click a link, or press Shift+F10, for the rest: **Reveal in project**, **Locate in Finder**, **Copy path**, **Open in browser** or **Copy link**, depending on where it points.

## Find your way in long work

Sprint 123 makes a long recording searchable and keeps a crowded tab row readable.

**Search a transcript.** A search field sits above the transcript. Type a word or phrase and every match is highlighted as you type; case doesn't matter, and words the engine was unsure about are found too. The count shows where you are ("3 of 12"); the arrows, or Enter and Shift+Enter, move between matches. Cmd/Ctrl+F puts you in the field and Escape clears it.

**Keep your place while the audio plays.** Going to a match stops the transcript from scrolling along with the audio, so you can read around it. **Back to playing line** brings you back to where the recording is — and it now also appears after you scroll away with the mouse wheel, which used to leave no visible way back.

**A tab row that fits.** With many files open, tabs shrink to fit the row instead of running off the edge. Hover a tab for its full name.

## Word documents, as pages

Sprint 124 makes a Word document look like the document you sent, not a long web page.

**Word's own pages.** A document last saved in Word now shows its pages where Word put them, with the right number on each page. Covers and page decorations placed behind the text appear, fonts embedded in the document are used, and blank pages after page breaks are gone. Office fonts your Mac doesn't have — Calibri, Cambria, Aptos — are drawn in a close system font instead of Times.

**Move through it like a PDF.** Word and PDF previews now share one quiet toolbar: the page you are on, zoom, and a zoom menu with **Fit width**, **Fit page** and the usual sizes. **Open in Word** is the main button, with **Save as Markdown** behind its arrow. In a Word document, Cmd/Ctrl+F or the magnifier opens the same find bar as the Markdown editor, with a count and Enter / Shift+Enter between matches. Edit the file in Word and the preview follows, on the same page.

**Honest about the rest.** When a document has charts, SmartArt or equations that the preview can't draw exactly, a note says so. When a file can't be previewed — too large, password-protected, damaged — you get the reason and a way to open it in Word (or Pages, or your default app). A document made by another program, such as a Google Docs export, has no saved page breaks, so it still shows fewer, longer pages.

## Claude Opus 5.5

Sprint 127 brings Claude Opus 5.5 to Ritemark.

Anthropic requires Claude Code 2.1.280 or newer for Opus 5.5. Ritemark now ships Claude Code 2.1.281, so Opus 5.5 appears in the Claude Code model menu, whether you sign in with a Claude subscription or an API key. If you had chosen Opus, you move to Opus 5.5 automatically.

**Your sign-in decides the list.** With a Claude subscription, the menu follows your subscription, even when an API key is also saved in Settings. With an API key, it follows what your key can use, from the first day.

**No silent switches.** If the model you last used is no longer available, Ritemark says so in the chat, for example "Opus 5.5 isn't available right now — using Sonnet 5." It no longer switches quietly. If your account can't use a model, for example because your plan or organization doesn't include it, the message names the model and asks you to choose another in the model menu.

The recommended default stays a deliberate choice: a new model is never made the default automatically.

## Fixes

- **A year at the start of a line stays a sentence.** Typing `2026. ` at the start of a paragraph turned it into a numbered list starting at 2026, and the saved file kept the list instead of your sentence. Numbers up to 99 still start a list, which is every number anyone types to start one; 100 and above stay prose. A list can still be started at any number from the toolbar or the slash menu, and a file that already starts a list at a higher number opens exactly as before.
- **Images kept outside the document's own folder now show.** An image written as `![plan](../images/plan.jpg)`, or kept in one shared `images/` folder at the top of a project, was refused by the editor and appeared blank. A diagram kept that way fared worse: it also vanished from PDF and Word export, and publishing to Google Docs reported "the image file was not found". Every image inside the folder you have open is now available to the documents in it, and a diagram saved outside the document's folder refreshes in place again while you edit it. If you add a folder to the window while a document is already open, reopen that document to pick it up.
- **Images with a plain relative path now show in the editor.** An image written as `![diagram](img/diagram.png)`, the form most Markdown tools produce, appeared as a broken image. Only `./` and `../` paths were displayed.
- **Images from a parent folder no longer break on save.** Editing and saving a document with a `../images/…` image wrote an internal `vscode-resource` address into the file in place of the path, breaking the image in every other app. The original path is now kept.
- **The Export menu works from the keyboard.** Opening it with Enter now moves focus into the menu. The arrow keys move between entries, and Escape or Tab closes the menu and returns focus to the Export button. Previously no entry could be reached without a mouse.
- **Shift+End no longer selects the rest of the document.** Holding Shift and pressing End selected everything from the cursor to the end of the file instead of to the end of the line, so the next keystroke could wipe out paragraphs and lists further down without you noticing. Shift+End and Shift+Home now select to the end and start of the line you are on, and can never reach past the paragraph, list item or code block the cursor is in.
- **Conversation titles are in the language you wrote in.** When your own Claude setup contained text in another language, such as skills described in Estonian, an English prompt was often given a title in that language. The title now follows the language of your prompt.
- **Menus are readable in the dark theme.** Drop-down and right-click menus, such as those in the AI sidebar, stayed white in the dark theme with near-white text on them. They now follow the theme.
