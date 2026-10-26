# Sprint 138 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it runs on the Mac, in Ritemark Light and Ritemark Dark, on a dev instance launched in the background with its own short user-data directory (memory: `dev-instance-cdp-isolation`). "Byte for byte" is checked with `cmp` against a copy of the file taken before opening it. The fixtures are in `extensions/ritemark/webview/src/extensions/math/fixtures/` ([technical-plan.md](technical-plan.md), W1); `analyst-report.md` is the film's stand-in. Scenarios marked *Windows* also run on a Windows build from the sprint branch, through the Development manager's Windows session.

## Feature: Math is read from the file (R1)

### S1: Inline and display math, typeset
Given `analyst-report.md`, with inline `$\bar{x}$` and a `$$` block on its own lines
When it opens
Then the inline formula is typeset in its sentence and the block is typeset and centred
And no `$` shows anywhere a formula is.

### S2: Dollar amounts stay text
Given a paragraph `The licence costs $5 and the support $10 a month, between $20,000 and $30,000 a year.`
When it opens
Then the paragraph shows exactly as written, with every `$` as text, and nothing typeset.

### S3: Not inside code
Given `` `$x$` `` in a code span, and a fenced block containing `$$ y $$`
When the document opens
Then both show as code, with their dollars, untypeset.

### S4: ChatGPT's delimiters
Given a paragraph `The slope is \(m = \frac{\Delta y}{\Delta x}\).` and a block `\[ y = mx + b \]` on its own lines
When it opens
Then both are typeset, the first inline and the second as a block (decision for Jarmo 3).

### S5: Display math inside a paragraph
Given `The result is` on one line and `$$`, `x = 1`, `$$` on the next three lines, with no blank line before them
When it opens
Then `x = 1` is typeset and centred on its own line within that paragraph.

### S6: An escaped dollar
Given `Price: \$5, or \$x\$ literally.`
When it opens
Then it shows `Price: $5, or $x$ literally.` with nothing typeset.

### S7: Math everywhere it can sit
Given math in a heading, a bullet item, a numbered item, a quote, a table cell, and an equation block inside a list item and inside a quote
When the document opens
Then every one is typeset in its place.

## Feature: Math is written back as it was (R2)

### S8: Open and save, untouched
Given `analyst-report.md` copied aside
When it opens, and is saved with ⌘S without any edit
Then the file is byte for byte the copy.

### S9: An edit elsewhere leaves every equation alone
Given `analyst-report.md` copied aside
When one word is added to its first paragraph and the file is saved
Then `diff` shows only that line, and every equation, with its `\{`, `\,`, `\%`, `_`, `*` and `\\`, is byte for byte as before.

### S10: Every form of delimiter survives
Given `forms.md` with `$x$`, `$$x$$` on one line, `$$ x $$`, a `$$` block on three lines, `\(x\)`, `\[ x \]`, a block opening `$$x` and closing `y$$` on the next line, and a block in a list item
When it is opened and saved
Then the file is byte for byte as it was.

### S11: Editing one equation
Given `$$`, `\int_0^1 x^2 \, dx`, `$$` on three lines
When the person changes `x^2` to `x^3` and leaves the field, then saves
Then the file has `$$`, `\int_0^1 x^3 \, dx`, `$$` on three lines, and nothing else changed.

### S12: An inline edit stays math
Given `$a+b$`
When the person edits its source to ` a + $b ` (a space at each end, a bare dollar inside), then leaves and saves
Then the file has `$a + \$b$`: the outer spaces trimmed and the inner dollar written `\$`
And reopening shows it typeset.

### S13: Literal dollars
Given a new document
When the person types `It costs $5.` and saves
Then the file has `It costs $5.`
When the person types `$x$`, sees it become an equation, and presses ⌘Z at once
Then `$x$` shows as text, and on save the file has `\$x\$`, which reopens as text
And a `\$5` already in the file is still `\$5` after any save.

### S14: A document without math
Given a 2.0.1 corpus document with no `$` in it, copied aside
When it is opened, one word added, and saved
Then the diff is the same as on 2.0.1 for the same edit.

## Feature: Typeset in the editor (R3)

### S15: Dark and Light
Given `analyst-report.md`
When Ritemark Dark is chosen, then Ritemark Light
Then the equations take the text's colour in both, readable.

### S16: A screen reader
Given VoiceOver on
When the cursor moves into the paragraph with `$\bar{x} = \frac{1}{n}\sum x_i$`
Then VoiceOver reads the sentence with the equation from its MathML, not KaTeX's glyphs one by one and not the LaTeX
And what it says is written down in the QA evidence, since Chromium's MathML support decides the words.

### S17: Nothing loaded without math
Given a document without math, in a fresh view
When it opens and the webview's network requests are listed (CDP)
Then nothing under `media/katex/` was requested
When a document with math opens in another view
Then `katex.min.css` and only the woff2 faces it uses are requested, once.

### S18: Showing math is not an edit
Given `analyst-report.md` just opened
Then the tab shows no unsaved mark, and no save happens, while equations typeset.

### S19: The stylesheet missing
Given a dev instance whose `media/katex/katex.min.css` is renamed away
When `analyst-report.md` opens
Then every equation shows as its source in the code style, nothing shows as broken glyphs, and saving still keeps the file byte for byte.

## Feature: Editing an equation where it is (R4)

### S20: Inline, by click
When the person clicks `$\bar{x}$`
Then its source shows in place in the code style between muted dollars, with the cursor in it
When they press Escape
Then it is typeset again.

### S21: A block, by keyboard
When the person moves to an equation block with the arrows and presses Enter
Then the LaTeX shows in a field the text's width with the typeset result below it
When they type, the result below follows
When they click elsewhere
Then only the typeset equation shows, and one ⌘Z brings back the old formula.

### S22: Emptying removes it
When the person opens an inline equation, deletes all its source and leaves
Then the equation is gone, and the file has nothing where it was.

### S23: The cursor passes it
Given the cursor just before an inline equation
When the person presses → twice
Then the cursor is after it
When they press Backspace
Then the equation is selected; a second Backspace deletes it.

## Feature: Writing a new equation (R5)

### S24: Typing inline math
When the person types `the mean $\bar{x}$`
Then on the closing `$` it becomes a typeset equation
When they type `costs $5 and $10`
Then nothing turns into math.

### S25: Starting a block
When the person types `$$` and Enter in an empty paragraph
Then an equation block opens for editing, empty
When they choose **Equation** from the slash menu (and, in another paragraph, from the block menu)
Then the same happens.

## Feature: A typo shows the source (R6)

### S26: An unknown command
Given `$\foo{x}$`
When it opens
Then it shows `\foo{x}` in the code style with a small warning mark
When the person points at the mark
Then a tooltip says Ritemark can't typeset it because `\foo` isn't a command it knows
When they fix it to `\frac{x}{2}`
Then it typesets at once, and the rest of the document never changed.

## Feature: Copy, paste and the AI (R7)

### S27: The AI sees the source
Given a sentence with `$\hat{\beta}$` selected
When the person asks Claude, then ChatGPT, then OpenCode about the selection
Then each agent's prompt carries `$\hat{\beta}$` (checked with the bridge trace, memory: `reference_webview_bridge_trace_holdback`).

### S28: A comment on an equation
When the person comments on a sentence containing an equation and hands it to an agent
Then the comment task's captured text contains the equation's source with its delimiters.

### S29: Copy as Markdown and plain text
When the person selects a paragraph with math and chooses Copy as Markdown
Then the clipboard has the paragraph with `$…$` exactly as in the file
When they copy it normally and paste into TextEdit (plain text)
Then the text has the source with delimiters.

### S30: Paste from ChatGPT's and Claude's pages
Given an answer with typeset math in ChatGPT's web page, and one in Claude's
When the person selects it there, copies, and pastes into a document
Then the formulas arrive as equations, typeset, and saving writes their LaTeX between `$…$` or `$$…$$` (decision for Jarmo 4).

### S31: Paste plain text with math
When the person pastes the plain text `the mean $\bar{x}$ is 4` into a paragraph
Then `\bar{x}` arrives as an equation.

## Feature: PDF (R8, R12)

### S32: The film's report as PDF *(Windows)*
Given `analyst-report.md`
When it is shared as a PDF and opened in Preview and in Acrobat Reader
Then inline equations sit on their lines' baseline, display equations are centred, the table's and the list's equations are typeset, and they look like the editor's (KaTeX's fonts)
And at 200% they are sharp, and no LaTeX appears anywhere.

### S33: A very wide equation
Given a display equation wider than the page's text column
When it is shared as a PDF
Then it is scaled down to fit the column, nothing cut off.

### S34: Bold, italic and code come back
Given a paragraph with **bold**, *italic* and `code`, a list item and a table cell with the same
When it is shared as a PDF
Then all three keep their look in every place (R12).

### S35: A typo at export
Given `$\foo{x}$` in a document
When it is shared as a PDF, then as Word
Then the export finishes, that equation shows as its source in the code style, and the message after the export says one equation couldn't be typeset (decision for Jarmo 5).

## Feature: Word (R9)

### S36: The film's report as Word *(Windows)*
Given `analyst-report.md`
When it is shared as a Word document and opened in Word for Mac and in Word for Windows
Then Word opens it with no repair prompt
And every equation is a Word equation: clicking one opens Word's equation editor; inline ones sit in their sentences, display ones are centred
And no LaTeX appears anywhere.

### S37: An equation Word can't take
Given an equation the converter cannot convert (a fixture from audit A4)
When the document is shared as Word
Then that equation is a picture at its text size and every other is a Word equation.

### S38: Other readers
Given the Word file from S36
When it is opened in LibreOffice and in Pages, and imported into Google Docs
Then LibreOffice shows equations; Pages and Google Docs show them as equations or pictures (recorded in A4), never as LaTeX.

## Feature: Google Docs (R10, R11)

### S39: Equations in a published Doc
Given `analyst-report.md`, connected to a Google account
When it is published to Google Docs
Then the display equations are centred pictures, the inline ones are pictures in their sentences at the text's size, and the table cell with math shows its source, which the result names in one sentence.

### S40: Sync with nothing changed
Given the Doc from S39
When Sync runs with no change to the document
Then Ritemark says nothing has changed and writes nothing.

### S41: Quote blocks (#408)
Given a single-paragraph quote, a two-paragraph quote, a nested quote and a quote containing a list
When the document is published to Google Docs
Then every line of every quote, the first included, starts at the quote's indent, and the left border is a thin line
When an older Doc with the heavy bar is synced
Then its quotes change to the same look.

## Feature: The weight, and how it reaches people (R13)

### S42: The bundle
Given the sprint branch's build
Then `webview.js` is at most 40 KB larger than before (`notes/bundle.md`), holds one KaTeX, and `media/katex/` holds the stylesheet, 20 woff2 faces and the licence.

### S43: The production build *(Windows)*
Given a production build from a clean-room worktree at the merged commit
Then `validate-build-output.sh` passes with its new check, the app's extension has `media/katex/` and `node_modules/mathml2omml`, and S36 passes from the packaged app.

## Feature: Nothing lost (R14)

### S44: Mermaid
Given a document with a Mermaid flowchart, and one with math in a Mermaid label
When they open, and are shared as PDF and Word
Then the diagrams render and export as on 2.0.1.

### S45: The rest of the editor *(Windows)*
Given the 2.0.1 regression set (memory: `ritemark-visual-regression`)
When it runs on the sprint branch
Then comments, task cards, tables, images, Export, Copy as Markdown and Google Docs behave as on 2.0.1.

## Feature: The film (E3)

### S46: Before capture
Given the release candidate and the film's own document (the Social manager's report)
When it is opened, one word edited and saved, then shared as PDF and Word
Then the save is byte for byte outside that word, the PDF matches S32 and the Word file matches S36, on the Mac and on Windows
And only then is the film captured.
