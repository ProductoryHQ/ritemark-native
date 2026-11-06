<!-- Written with the `release-notes` skill. Sources: docs/CHANGELOG.md (2.2.0), sprint-145-loose-ends/notes/release-notes-draft.md, and Sprint 149's merged PRs (#654, #670, #669, #672, #668) with A4's measurements. -->

# Ritemark 2.2.0

You can now share your ideas as a web page. Make it yourself or with AI.

Publish a page from your project, and anyone with the link can open it. 2.2 also searches your whole project, brings a simpler Settings and keeps your words when an AI saves.

## Share your ideas as a web page

- **Open a web page on the desk.** Any web page file in your project opens as the page, not as code.
- **Open it in your own browser.** **Open in your browser**, on the page's bar, shows the page in Safari, Chrome or whichever browser you use.
- **Put it online.** **Publish** puts the page online in your own Cloudflare account. A free account is enough. Anyone with the link can open it.
- **Connect once.** The first time, **Set up** opens Cloudflare's page. You copy one code from there into Ritemark.
- **See exactly what goes.** Before anything leaves your computer, Ritemark lists the page and the files it uses. Nothing else from the project goes.
- **Ritemark warns you about keys and passwords.** If a file looks like it holds one, Publish waits until you choose **Publish anyway**.
- **A new address takes a moment.** Your first page on a new address can take a couple of minutes to open. Ritemark tells you while you wait.
- **Share, change, take it down.** Use **Copy link**, **Update the page** after a change, or **Unpublish** to remove it.
- **Kept out of search engines, not secret.** Search engines are asked not to list the page. Anyone who has the link can still open it.

## Find anything in your project

- **Search from Documents.** Type in the Search box at the top of Documents. Results show as you type, with no AI.
- **Documents, chats and tasks together.** Search reads Markdown, Word, PDF and spreadsheet (CSV) files, your chats in this project and your tasks.
- **Open a result at the right place.** A document opens at the words you found. A chat opens at the matching message.
- **Keep your hands on the keys.** Press ⌘⇧F (Ctrl+Shift+F on Windows) to search. Use the arrow keys to move and Enter to open.
- **Accents don't get in the way.** "kasi" also finds "käsi". The exact spelling comes first.
- **Need to replace words in many files?** VS Code's search is still there, now called **Advanced search**, in More.

## A simpler Settings

- **Six plain sections.** AI accounts, Appearance, Sharing, Usage data, Updates and Advanced. Every setting you had is still there.
- **See each AI at a glance.** Claude, ChatGPT and OpenCode each have one line and one button, such as **Sign in** or **Repair**.
- **Keys in one place.** **API keys** lists every service, whether its key is saved, and lets you test or change it.
- **Settings opens at once.** It fills in each AI's state as it learns it. Before, it could take seconds on Windows.
- **Settings stays current.** Sign in somewhere else, or change a setting elsewhere, and an open Settings shows it.

## Your words stay

- **Your newest words are kept.** Did an AI or another app save the document while you typed? Both your words and its changes stay.
- **Both changed one paragraph? You choose.** Ritemark keeps yours and shows **Review changes**. Compare the two and pick one.
- **Changed your mind?** One Undo takes back the other app's changes.

## Smaller changes

- **See where the keyboard is.** A clear indigo ring shows which button the keyboard is on. A mouse click shows no ring.
- **Narrow buttons show their icon.** When a button is too narrow for its words, you see its icon. Its words are in its tooltip.
- **Tooltips look the same everywhere.**
- **File changes speaks plainly without Git.** It says what is missing, and offers **Set up Git here** where it can.
- **Tab menus show only what works.** Home and the Task board no longer offer Close. A tab offers **Show in Documents**.
- **Right-click menus are shorter.** Items that sent your text to Copilot instead of Ritemark's AI are gone.
- **No sparkle beside selected text.** This is in the text editor. ⌘I (Ctrl+I) still opens Copilot's Inline Chat where Copilot is set up.
- **Comments stand out from search.** Words you find in a document are marked in grey now. Amber always means a comment.
- **Mistakes in a box show in red.** When a box can't take what you typed, its edge turns red, not amber.
- **Your saved keys stay hidden in Settings.** Settings shows that a key is saved, not the key. Press the eye to see it.
- **Transcribe tells you when the microphone is silent.** It names the microphone and says when it hears nothing.
- **A Flow step names the key it needs.** It says so when the key is missing. One click opens that key in Settings.
- **Security fixes.** Ritemark has the newest security fixes for its built-in browser and everything it shows.

## Fixes

- **Switching projects opens on Home.** The AI is beside it at once. Before, your last document showed first, then the page moved.
- **The window opens in its final shape.** Nothing moves while Ritemark starts, and the AI column shows once, with no flicker.
- **The AI column you closed stays closed.**
- **The AI works in your chosen page.** With several browser tabs open, its clicks no longer land in another tab. It never brings a tab to the front.
- **Looking at a Flow no longer saves it.**
- **Fix a task card that won't open.** You can try again or remove it. A card you drop on the Task board now moves at once.
- **Quitting stops every AI helper on Windows.** ChatGPT's and OpenCode's helpers now stop when you quit Ritemark.
- **Coming from Ritemark 1? The welcome shows first.** This is on Windows, at the first start after the update. A terminal you had open waits behind it.
- **No more "Git not found" message.**
- **No green check on a failed answer.**

## Updating from 2.1

- **On the Mac,** Ritemark tells you that 2.2 is out. Choose **Download Installer**, open the file and drag Ritemark to Applications.
- **On Windows,** a version installed from our download does the same. A version from the Microsoft Store updates from the Store.
- **Your projects, chats and settings stay.**
- **Your ChatGPT chats go on.** This is for chats from before the update. Their history stays on screen. ChatGPT itself starts its side of each chat afresh, once.
- **Copilot's quick actions are off.** This is in the text editor. Modify and Review no longer appear beside selected text, and Fix and Explain no longer appear on a problem. To turn them back on, open **All settings** and search for **Copilot code actions**. Under GitHub Copilot Chat, turn on **Enable Code Actions**.
- **The first search reads your project once.** Results come while it reads. After that, search starts quickly.

## Known issues

- **Rarely, a late copy replaces your words.** When another app saves a copy, Ritemark merges it with your words. For that, it needs an earlier version, which it keeps for ten minutes. Without one, Ritemark takes the other app's copy. This can happen after a near-whole rewrite, more than 30 seconds after your last save.
- **A near-whole rewrite can't be merged.** Within 30 seconds, Ritemark asks which version to keep.
- **Search finds OneDrive files by name only.** This is on Windows, for a project in OneDrive.
- **Files kept only online are found by name.** Search doesn't download them.
- **Windows may warn about the new installer** until Microsoft knows it better. Installing from the Microsoft Store avoids this. [Read more](https://github.com/ProductoryHQ/ritemark-native/blob/main/docs/user/windows-smart-app-control.md).
