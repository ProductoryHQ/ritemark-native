# Ritemark 2.1.0

You can now add math formulas to your documents. Write them yourself or with AI. They look right in Ritemark, in PDF and in Word.

Saving now changes only what you changed. Almost always. And a new project shows you where to start.

## Add math formulas to your documents

- **Formulas look like formulas.** When ChatGPT or Claude writes a formula, you see the real formula, not code full of backslashes.
- **Write your own.** Put a formula between dollar signs, as ChatGPT and Claude do. Or choose **Equation** from the `/` menu. A price such as $5 stays text.
- **Click a formula to change it.** You see its code and the result together. The result changes as you type.
- **A mistake is marked, not hidden.** If a formula has an error, Ritemark shows it in amber and says what is wrong.
- **Other apps can read your formulas.** Your file keeps each formula as plain text. Obsidian, GitHub and Typora show the same formulas.

## Formulas come with you when you share

- **PDF and Word keep the formulas.** In a PDF they are laid out properly. In Word you can still change them.
- **Google Docs gets pictures.** Google Docs can't take formulas from other apps, so they arrive as pictures.
- **PDF copies keep bold and italic.** Before, a PDF copy lost them.

## Your files stay the way you wrote them

- **Saving now changes only what you changed.** Almost always. Before, saving could also change lists, spacing and tables.
- **Nothing is dropped.** Links to files in other folders and images in a row stay in the file.
- **Does the AI edit a file while you type? Ritemark asks what to keep.** It usually asks once, in the document.
- **Fewer needless questions.** If OneDrive or a similar app only touched the file, your save goes through without a question.

## A new project shows you where to start

- **One thing to try first.** Open a folder for the first time, and its Home offers one request. In a folder with files, the AI tells you what is there and what it could do next. Nothing in the folder is moved or changed.
- **An empty project asks what it is for.** You finish the sentence, and the AI writes a short page about the project and a first outline.
- **A new chat suggests a start.** An empty chat offers up to three things to ask, based on what you have open. A click puts the words in the box. Nothing is sent until you press Send.

## Your AI

- **You know which plans work before you sign in.** Any ChatGPT plan works, Free included. Claude needs a paid plan, such as Pro or Max. OpenCode needs your own API key.
- **The status bar shows which AI you are using.** For example "Claude ready", or "Claude: sign in" when you need to sign in.
- **A chat remembers its model.** After a restart, a chat goes on with the model you chose.
- **When the AI can't answer, you see why.** One sentence says what happened, with one button to fix it. For example, sign in again or switch to another model.
- **ChatGPT busy? Ritemark waits for you.** It shows how long until it tries again. Meanwhile you can switch to another AI you have signed in to.
- **Lists in answers have their bullets and numbers back.** When the AI offers two next steps, you can reply with a number.
- **The AI tells you which files it couldn't open,** such as a scanned PDF.

## Tell us what you think

- **Press Send feedback, at the bottom of the window.** It's also in the Help menu. Write what worked or what got in your way, and press Send. It reaches the people who make Ritemark.
- **Your documents and chats are never included.** You can choose to add the AI's last answer, and you see it before it goes.
- **Want an answer?** Tick "I'd like an answer". Your own e-mail app opens, so we can write back.

## Flows and models

- **Gemini 4 Argon is available.** It is first in a Flow's Gemini list, and OpenCode lists it too.
- **New Flow steps start on a Gemini model that new Google accounts can use.** Google no longer offers the old default to them. Saved Flows keep their model.
- **Choosing a model in a Flow step is instant.** A step without its key tells you which key it needs.
- **When a Gemini step fails, it says why.** For example, choose another model, or allow more words in the answer.
- **OpenCode lists the latest models** for each key you have, after your first OpenCode chat. No Ritemark update is needed.
- **Your Google key is safer.** Ritemark no longer puts it in web addresses, so it can't end up in logs.

## Smaller changes

- **Split buttons work as one button.** For example **Ask with** on Home and **Give to** on the Task board.
- **The note after you switch projects goes away by itself** after a few seconds.
- **A file you transcribe opens as a tab,** and the text fills in there.
- **The Task board fits the default window,** with both side columns open.
- **Source Control is called File changes** in the More menu.
- **Claude and ChatGPT are no longer marked "Experimental"** in Settings.

## Fixes

- **The `.claude` folder shows in Documents again,** with your skills, agents and commands. Ritemark 2.0 hid it. Claude Code's own working copies inside it stay hidden.
- **Editing a link's address works again.** Before, your change was ignored.
- **Deleting text no longer freezes the editor.**
- **Your first chat uses the AI you chose** in the welcome.
- **A chat title is in the chat's language.**
- **A stopped answer says Stopped,** not Failed or Done.
- **After you switch projects, the AI column comes back with Home,** and the document you were in keeps the cursor.
- **On Windows, Transcribe refuses a file it can't handle before it starts,** not halfway. A failed recording can be removed from the list.
- **File pickers no longer open in a folder that doesn't exist.**
- **A tooltip no longer stays up after a click.**
- **A task's tab keeps its title after a restart.**

## Usage data

If you have usage data on, Ritemark now also counts these things. It never sends your words, files, names, projects, models or where you are.
- Each answer from an AI, which AI it was, and whether it finished.
- Whether your first message got an answer.
- A voice recording, and a document you started by voice and changed later.
- Home's first request, a suggested start you used, and a new document, shared copy or Google Docs page.
- Which button opened Send feedback.

With usage data off, nothing is sent. Send feedback sends only what you write, when you press Send.

## Updating from 2.0

- **On the Mac,** Ritemark tells you that 2.1 is out. Choose **Download Installer**, open the file and drag Ritemark to Applications.
- **On Windows,** a version installed from our download does the same. A version from the Microsoft Store updates from the Store.
- **Your projects, chats and settings stay.**
- **Older files change once.** When you first save a file from 2.0.1 or earlier, Ritemark removes a few leftovers. For example, spaces on empty lines. After that, the file stays as you wrote it.
- **Built-in AI tools are updated:** Claude Code 2.1.310, Codex 0.164.0 and OpenCode 1.19.4.

## Known issues

- **A few Markdown forms are still rewritten,** without losing text. For example, `_word_` becomes `*word*`, and a table's columns are no longer padded to line up.
- **A line with only a bracketed word may open as a formula** if Ritemark 2.0.1 saved the file. For example, a line that is just `[draft]`.
- **In Word, a formula alone in a table cell is centred.** In Google Docs, a formula in a sentence may sit a little high.
- **Some File changes views still say Source Control.**
- **Windows may warn about the new installer** until Microsoft knows it better. Installing from the Microsoft Store avoids this. [Read more](https://github.com/ProductoryHQ/ritemark-native/blob/main/docs/user/windows-smart-app-control.md).
