<!-- DECKS: the section "Make slides, present them and share them", between DECKS START and DECKS END, ships only if Decks (the ritemark.features.decks setting) is on in 2.3. If it is off, delete the section. If it ships, the headline and the opening lines should lead with it, and the presenter view on two displays still needs its Windows check (else add "On the Mac"). -->

<!-- Draft, started 19 November 2026 with the `release-notes` skill. Sources: docs/CHANGELOG.md ([Unreleased] — v2.3.0) and every change merged since 2.2.0. Work still to come adds its lines here. -->

# Ritemark 2.3.0

You can now edit an Excel file in Ritemark, and everything you didn't change stays as it was.

Workbooks now look as they do in Excel, too. 2.3 also lets you size, crop and change pictures, yourself or with ChatGPT, and change tables with the mouse.

## Edit Excel files without losing their look

- **Saving changes only what you typed.** Colours, bold text, borders, frozen rows, charts, pictures, drop-down lists and colour rules all stay. Before, one save removed them.
- **A workbook looks as it does in Excel.** Column widths, colours, fonts, borders, merged cells and frozen rows show as the author made them.
- **Charts and pictures stay in the file.** Ritemark shows a card where each one sits. Open the file in Excel to see them.
- **Dates and money show as written.** A date written 03.01.2026 no longer shows as 1/3/26. Money, percentages and durations follow each cell's format.
- **Hidden rows, columns and sheets stay hidden.**
- **Type below your data to add a row.** Type in any empty cell below or beside the data, and the sheet grows, as in Excel. CSV files keep **Add row**.
- **Sorting doesn't change the file.** Sorting by a column changes only what you see.
- **Totals catch up in Excel.** Totals that use a cell you changed update when you next open the file in Excel.
- **Ritemark says what it can't change.** A few cells, such as a table's column names, stay as they are, and Ritemark says why. If a save isn't safe, nothing is written and your changes stay, unsaved.
- **Large workbooks open and save faster.**

## Pictures: change them yourself or with ChatGPT

- **Resize a picture by its corner.** Click the picture and drag a corner. Or choose S, M, L or Full on its bar.
- **Crop a picture.** Choose **Crop** on its bar, frame the part you want and press **Done**. The picture file itself stays whole.
- **Swap a picture, keep its place.** Double-click it, or choose **Replace picture…** under ⋯. The new one gets the old one's size and place.
- **Make or change a picture with ChatGPT.** Click a picture and open **ChatGPT** on its bar. Choose **Change this picture…** or **Make a new picture…**, then say what you want.
- **The old picture stays.** ChatGPT's picture is saved beside the old one, in the images folder next to your document. **Undo** puts the old one back, and **Try another** makes a new version.
- **ChatGPT needs your account.** Sign in to ChatGPT in Ritemark first. Pictures need a ChatGPT account, not an API key.

## Change tables with the mouse

- **Drag rows and columns.** In a document, each row and column of a table has a grip. Drag it to move the row or column.
- **Each column has its own menu.** Click a column's grip to insert, move, align, sort or delete columns.
- **Add a row or column with +.** The + bars sit at the table's right and bottom edges. Tab in the last cell adds a row too.
- **Set column widths.** Drag the line between two columns. Double-click it to make the widths automatic again.
- **Right-click a cell for its menu.** It has Cut, Copy and Paste, and the actions for its row and column.

<!-- DECKS START -->
## Make slides, present them and share them

- **Make a deck of slides.** Choose **New → Deck**, or the Deck card on Home. Start empty or from a copy of an earlier deck.
- **Write on the slide as in a document.** Type a title, text and lists, with no layout to choose. Type / for columns, boxes, steps, tabs, a button, a picture or a table.
- **Write the handout beside the slides.** Participants read it. A comment stays with you and never goes out.
- **A deck opens on its slides.** Every deck opens showing only the slide. The switch on the deck's bar shows the handout beside it, or the handout alone.
- **Give the deck a look, yourself or with AI.** **Theme** on the deck's bar picks a theme and changes its colours, fonts and logo. Or ask the AI to match your brand guide or logo.
- **Ask the AI about this slide.** It knows which slide you're on. A comment on a slide can be a task for Claude.
- **Present from Ritemark.** **Present** shows only the slide on the projector. With a second display, your laptop shows this slide, the next one, your comments and the clock.
- **Lead the room.** Use a clicker, blank the screen or light up one item. Show a timer for an exercise, or a QR code for the page.
- **Share the deck as a page.** **Publish** puts it online as one page that people open on a phone or a computer. Each prompt has **Copy**, and exercise steps can be ticked.
- **Comments and skipped slides stay with you.** Before anything goes, Ritemark lists what goes and what stays.
- **The page keeps its look until you update it.** Change the theme, and the page online changes only with **Update the page**.
<!-- DECKS END -->

## Smaller changes

- **Add tabs to a document.** Type / and choose **Tabs**. Each tab holds its own text.
- **Add a button that opens a web page.** Type / and choose **Button**, then give it a full address that starts with https://. It opens the page in your browser.
- **The / menu knows more words.** Type /photo or /pilt, and Picture comes up. Image is now called Picture.
- **Give a comment to ChatGPT.** Write @chatgpt in the comment, or pick ChatGPT from the list of names.
- **Claude works with an API key alone.** Save an Anthropic API key in Settings, and Claude is ready without a Claude.ai sign-in. If you have both, Claude uses the sign-in.
- **An AI's usage limit says so.** The chat says when the AI can answer again, and offers another model or AI. The chat list shows "Limit reached".

## Fixes

- **On Windows, Claude asks you to sign in when it needs to.** Before, Claude could look ready, and the first question failed.
- **One sign-in at a time.** While a sign-in runs, the AI's sheet shows "Signing in…" with **Cancel**. Before, it offered a second sign-in.
- **A web page that failed to load opens again.** Open its file once it's back, and the page loads. Before, you saw the failed page again.
- **Tables keep their links in Google Docs.** Links, bold and italic in a table cell now arrive in Google Docs too.
- **A dropped picture never replaces another.** When a picture with the same name is already there, the new one gets its own name.
- **Theme choices made before the first start stay.** Ritemark no longer replaces a theme that you or your IT team set.

## Updating from 2.2

- **On the Mac,** Ritemark tells you that 2.3 is out. Choose **Download Installer**, open the file and drag Ritemark to Applications.
- **On Windows,** a version installed from our download does the same. A version from the Microsoft Store updates from the Store.
- **Your projects, chats and settings stay.**
- **Workbooks saved in earlier versions stay as they are.** 2.3 can't bring back the colours or charts an earlier save removed.

## Known issues

- **OpenCode can show "Working" for about a minute** before it says it has reached a limit. It tries again by itself first.
- **Sorting is off when merged cells cross the rows.** Ritemark says why.
- **Windows may warn about the new installer** until Microsoft knows it better. Installing from the Microsoft Store avoids this. [Read more](https://github.com/ProductoryHQ/ritemark-native/blob/main/docs/user/windows-smart-app-control.md).
