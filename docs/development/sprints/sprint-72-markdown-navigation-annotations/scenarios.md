# Sprint 72 Scenarios

## Feature: Inline Local File Links

### Scenario: Insert a relative link to a sibling file

Given the current document is `docs/notes/meeting.md`  
And the workspace contains `docs/notes/follow-up.md`  
When the user types `@follow`  
And selects `follow-up.md`  
Then the editor inserts a link with text `follow-up`  
And the link target is `follow-up.md`

### Scenario: Insert a relative link to a file in another folder

Given the current document is `docs/notes/meeting.md`  
And the workspace contains `docs/briefs/q2-plan.md`  
When the user types `@q2`  
And selects `q2-plan.md`  
Then the editor inserts a link with text `q2-plan`  
And the link target is `../briefs/q2-plan.md`

### Scenario: Distinguish duplicate basenames

Given the workspace contains `docs/product/roadmap.md`  
And the workspace contains `docs/company/roadmap.md`  
When the user types `@roadmap`  
Then both results are shown  
And each result includes enough folder context to distinguish it

### Scenario: Dismiss inline file search

Given the user has typed `@road` in the editor  
And file-search results are visible  
When the user presses Escape  
Then the dropdown closes  
And the text `@road` remains in the document

### Scenario: Link to a non-Markdown source file

Given the workspace contains `extensions/ritemark/webview/src/lib/test-utils.js`  
When the user types `@test-utils` in any Markdown document  
Then `test-utils.js` appears in the dropdown  
And selecting it inserts a link with text `test-utils`  
And the link target is the relative path to that file  
(file-type allowlist removed mid-sprint — every workspace file outside heavy/generated folders is searchable)

## Feature: Add Link Dialog Local File Search

### Scenario: Fill link target from local file search

Given the user selected the text `launch notes`  
And opened the Add Link dialog  
When the user types `@launch` in the URL field  
And selects `launch-checklist.md`  
Then the URL field is filled with the relative path to `launch-checklist.md`  
And pressing Add applies that link to `launch notes`

### Scenario: External link behavior still works

Given the user opened the Add Link dialog  
When the user enters `example.com`  
And presses Add  
Then Ritemark applies the link as `https://example.com`

## Feature: Internal Link Activation Safety

### Scenario: Relative file link is not opened as an external URL

Given the document contains a link to `../briefs/q2-plan.md`  
When the user modifier-clicks the link  
Then Ritemark does not open `https://../briefs/q2-plan.md` or any other external-browser URL  
And the navigation is handled by the internal R7 flow (see below)

### Scenario: Unsaved document cannot create relative internal links

Given the current document has no stable saved file path  
When the user types `@plan`  
Then the file-search popup shows a clear empty state  
And selecting an internal file link is disabled

## Feature: Internal Link Navigation

### Scenario: Cmd-click opens a Markdown link target

Given the current document is `docs/notes/meeting.md`  
And the workspace contains `docs/briefs/q2-plan.md`  
And the current document contains a link to `../briefs/q2-plan.md`  
When the user Cmd-clicks (Ctrl-click on Windows/Linux) the link  
Then `docs/briefs/q2-plan.md` opens in a Ritemark editor tab  
And the previously active editor is preserved for "Go Back" navigation

### Scenario: Cmd-click opens a non-Markdown file via VS Code

Given the current document contains a link to `assets/diagram.png`  
When the user Cmd-clicks the link  
Then VS Code opens the image with its default opener  
And Ritemark does not try to render the image inside the Markdown editor

### Scenario: Regular click still opens the edit dialog

Given the document contains a link to `../briefs/q2-plan.md`  
When the user clicks the link without holding a modifier key  
Then the link-edit dialog opens  
And no file is opened in another tab

### Scenario: Path traversal that escapes the workspace is rejected

Given the workspace root is `~/Projects/ritemark-native`  
And the current document contains a link to `../../../../etc/passwd`  
When the user Cmd-clicks the link  
Then Ritemark resolves the path and finds it lies outside the workspace root  
And a non-blocking warning notification reads "Link target is outside the workspace"  
And no file is opened

### Scenario: Symlink that points outside the workspace is rejected

Given the workspace contains `docs/notes/escape.md` which is a symlink to `~/secrets.md`  
When the user Cmd-clicks a link to `escape.md`  
Then Ritemark resolves the real path of the target  
And rejects it because the real path is outside the workspace  
And a non-blocking warning notification is shown

### Scenario: Missing target shows a clear notification

Given the current document contains a link to `does-not-exist.md`  
And no such file exists on disk  
When the user Cmd-clicks the link  
Then Ritemark shows a non-blocking notification "File not found: does-not-exist.md"  
And no editor tab is opened

### Scenario: External link is unaffected

Given the current document contains a link to `https://example.com`  
When the user Cmd-clicks the link  
Then Ritemark opens it in the system default browser  
And the internal-link navigation flow is not invoked

## Feature: TOC Heading Level Changes

### Scenario: Change heading level from inline TOC

Given the document contains `## Roadmap`  
And the inline table of contents is visible  
When the user right-clicks `Roadmap` in the TOC  
And chooses `H3` from the context menu  
Then the document heading becomes `### Roadmap`  
And the TOC refreshes to show it as an H3 item

### Scenario: TOC does not show heading dropdowns

Given the inline table of contents is visible  
Then TOC rows do not show always-visible H1-H6 dropdowns  
And heading-level actions are hidden until the user right-clicks a TOC row

### Scenario: Undo heading level change

Given the user changed `Roadmap` from H2 to H3 using the TOC  
When the user invokes Undo once  
Then `Roadmap` returns to H2

### Scenario: Keyboard heading shortcut from TOC

Given the inline TOC row for `Roadmap` is focused  
When the user presses `Cmd+Opt+1`  
Then `Roadmap` becomes an H1 heading

## Feature: Comment Callout Audit

### Scenario: Existing HTML comment round trip

Given the Markdown file contains `<!-- private note -->`  
When Ritemark loads and saves the document without edits  
Then the saved Markdown still contains `<!-- private note -->`  
And the note does not appear in PDF or Word export if comment callouts ship

### Scenario: Shorthand comment input

Given the user types `/// Check this later` at the start of a line  
When comment callouts are enabled  
Then Ritemark stores the note as a standard HTML comment  
And the editor renders it as a styled comment callout
