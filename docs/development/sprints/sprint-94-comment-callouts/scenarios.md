# Sprint 94 Scenarios

These scenarios become the manual QA matrix at Phase 4/5. `tasks.md` checkboxes refer back to this file — do not duplicate the detail there.

## Feature: Comment Load Parsing (R1)

### Scenario: Single-line comment loads as a callout
Given a Markdown file containing `Before\n\n<!-- private note -->\n\nAfter`
When the file is opened in Ritemark
Then `Before` and `After` render as normal paragraphs
And `private note` renders as a comment callout between them

### Scenario: Multi-line comment loads as one callout
Given a Markdown file containing a multi-line `<!--\nline one\nline two\n-->` block
When the file is opened
Then a single comment callout renders containing both lines

### Scenario: Comment-like text inside a fenced code block is not converted
Given a Markdown file with a fenced code block containing the literal text `<!-- not a comment -->`
When the file is opened
Then the code block renders as code, unchanged, with the literal `<!-- -->` text visible as code

### Scenario: Comment at document start and end
Given a Markdown file that starts with `<!-- first -->` and ends with `<!-- last -->`
When the file is opened
Then both render correctly as callouts with no adjacent-paragraph corruption

### Scenario: Flag disabled falls back to prior behavior
Given the `comment-callouts` flag is off
When a file containing `<!-- note -->` is opened
Then the editor behaves exactly as it did before Sprint 94 (comment is dropped, no crash)

## Feature: Comment Save Serialization (R2)

### Scenario: Round-trip is content-stable
Given a comment callout containing "remember to update the intro"
When the document is saved and then reopened
Then the callout still contains "remember to update the intro" exactly

### Scenario: Copy-as-Markdown matches Save
Given a document with a comment callout
When the user copies the document as Markdown
Then the copied text contains the comment as a standard `<!-- -->` block, identical to what Save would produce

### Scenario: Comment content containing a literal `-->` does not corrupt the file
Given a comment callout whose text includes the literal sequence `-->`
When the document is saved
Then the resulting file is still valid, parseable Markdown with the full comment content preserved (escaped or rejected per the chosen mitigation — not silently truncated)

## Feature: Styled Callout Rendering (R3)

### Scenario: Callout is visually distinct from body text
Given a document containing a comment callout
When viewed in the editor
Then the callout shows dimmed text, a colored left border, and a comment icon
And it is visually distinguishable from any existing blockquote/admonition styling

## Feature: `///` Shorthand (R4)

### Scenario: Shorthand at line start converts to a comment
Given the cursor is at the start of an empty line
When the user types `/// quick note` and a trailing space/newline
Then the line converts to a comment callout containing "quick note"

### Scenario: Shorthand does not fire mid-line
Given a line already containing text
When the user types `///` in the middle of that line
Then no comment conversion occurs

### Scenario: Single slash still opens the command menu
Given the cursor is at the start of an empty line
When the user types `/`
Then the existing `SlashCommands` popup opens, unaffected by the new shorthand rule

### Scenario: Shorthand canonicalizes on save
Given a comment created via `/// quick note`
When the document is saved
Then the file contains `<!-- quick note -->`, not `/// quick note`

## Feature: `Cmd+/` Toggle (R5)

### Scenario: Selection becomes a comment
Given the user has selected the text "this paragraph needs work"
When they press `Cmd+/`
Then the selection converts into a comment callout containing that text

### Scenario: Toggling back
Given the cursor is inside/selecting an existing comment callout
When the user presses `Cmd+/` again
Then the callout unwraps back into plain paragraph text

### Scenario: Toggle is undoable in one step
Given a selection was just converted to a comment via `Cmd+/`
When the user presses `Cmd+Z` once
Then the text returns to its pre-toggle state

## Feature: Multi-Line Comments (R6)

### Scenario: Selecting multiple paragraphs and toggling
Given the user has selected two full paragraphs
When they press `Cmd+/`
Then both paragraphs become one multi-line comment callout

### Scenario: Multi-line comment round-trips
Given a multi-paragraph comment callout
When the document is saved and reopened
Then all paragraphs and their line breaks are preserved

## Feature: Export Filtering (R7)

### Scenario: PDF export omits comments
Given a document with a comment callout containing a sensitive private note
When the document is exported to PDF
Then the exported PDF contains zero trace of the comment content

### Scenario: Word export omits comments
Given the same document
When exported to Word (.docx)
Then the exported document contains zero trace of the comment content

### Scenario: A new export path inherits the filter
Given a hypothetical future export path that consumes the same editor-content chokepoint
When it exports a document containing a comment
Then the comment is stripped without that export path needing its own filtering logic

## Feature: AI Mention Syntax + Assigned Callout (R8)

### Scenario: Recognized mention renders an assigned callout
Given a document loaded with `<!-- @claude: simplify this section -->`
When viewed in the editor
Then the callout renders with an agent badge identifying Claude, distinct from a plain comment

### Scenario: Unrecognized mention falls back to plain comment
Given a document loaded with `<!-- @gpt: do something -->`
When viewed in the editor
Then the callout renders as a plain comment (no badge), and no error occurs

### Scenario: Mention round-trips through save
Given an assigned callout for `@codex`
When saved and reopened
Then the file still contains `<!-- @codex: ... -->` with the alias intact

### Scenario: `@` inside a comment does not trigger file-link search
Given the cursor is inside a comment callout being edited
When the user types `@`
Then the `FileLinkSuggestions` file-search popup does NOT open

## Feature: Send to AI Action (R9)

### Scenario: Sending an assigned comment to AI
Given an assigned callout for `@claude` reading "fix the tone of this paragraph"
When the user clicks "Send to AI"
Then the AI sidebar opens/focuses (if not already visible)
And the instruction text plus surrounding document context is sent via the existing `agent-execute` path
And no new webview message type is used

### Scenario: Sidebar not visible before sending
Given the AI sidebar panel is currently closed
When the user clicks "Send to AI" on an assigned callout
Then the sidebar opens and the request is still sent

## Feature: Resolve Action (R10)

### Scenario: Resolving a plain comment
Given a plain comment callout
When the user clicks "Resolve"
Then the comment callout is removed from the document

### Scenario: Resolving an assigned comment without sending it
Given an assigned callout that was never sent to AI
When the user clicks "Resolve"
Then the callout is removed with no error and no AI call is made

### Scenario: Resolve is undoable
Given a comment callout was just resolved
When the user presses `Cmd+Z`
Then the callout reappears with its original content

## Feature: Feature Flag Kill-Switch (R11)

### Scenario: Flag off restores prior behavior mid-session
Given the `comment-callouts` flag is toggled off
When an already-open document containing comment callouts is affected by the change
Then no crash occurs and the on-disk file remains valid Markdown (exact live-toggle behavior — reload required or not — is confirmed during Phase 3)
