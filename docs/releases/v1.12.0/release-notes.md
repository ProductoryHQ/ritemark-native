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

**The composer has room.** It grows with what you write, up to eight lines instead of about five, and you can drag its corner to make it taller or shorter. Ritemark keeps the height you chose while it is open. The send button and model control always stay on screen, even at large zoom levels.

**Links do something, or say why not.** A file in your project opens in its editor, and a folder is shown in the project tree. A file outside your project is shown in Finder rather than opened, because a path in a reply is written by the AI, not by you. A missing file names the path. A link Ritemark does not open from chat, such as `mailto:`, says so and offers **Copy link**. Right-click a link, or press Shift+F10, for the rest: **Reveal in project**, **Locate in Finder**, **Copy path**, **Open in browser** or **Copy link**, depending on where it points.

## Fixes

- **A year at the start of a line stays a sentence.** Typing `2026. ` at the start of a paragraph turned it into a numbered list starting at 2026, and the saved file kept the list instead of your sentence. Numbers up to 99 still start a list, which is every number anyone types to start one; 100 and above stay prose. A list can still be started at any number from the toolbar or the slash menu, and a file that already starts a list at a higher number opens exactly as before.
- **Images kept outside the document's own folder now show.** An image written as `![plan](../images/plan.jpg)`, or kept in one shared `images/` folder at the top of a project, was refused by the editor and appeared blank. A diagram kept that way fared worse: it also vanished from PDF and Word export, and publishing to Google Docs reported "the image file was not found". Every image inside the folder you have open is now available to the documents in it, and a diagram saved outside the document's folder refreshes in place again while you edit it. If you add a folder to the window while a document is already open, reopen that document to pick it up.
- **Images with a plain relative path now show in the editor.** An image written as `![diagram](img/diagram.png)`, the form most Markdown tools produce, appeared as a broken image. Only `./` and `../` paths were displayed.
- **Images from a parent folder no longer break on save.** Editing and saving a document with a `../images/…` image wrote an internal `vscode-resource` address into the file in place of the path, breaking the image in every other app. The original path is now kept.
- **The Export menu works from the keyboard.** Opening it with Enter now moves focus into the menu. The arrow keys move between entries, and Escape or Tab closes the menu and returns focus to the Export button. Previously no entry could be reached without a mouse.
- **Shift+End no longer selects the rest of the document.** Holding Shift and pressing End selected everything from the cursor to the end of the file instead of to the end of the line, so the next keystroke could wipe out paragraphs and lists further down without you noticing. Shift+End and Shift+Home now select to the end and start of the line you are on, and can never reach past the paragraph, list item or code block the cursor is in.
