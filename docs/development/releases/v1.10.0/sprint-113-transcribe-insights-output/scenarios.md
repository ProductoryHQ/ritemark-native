# Sprint 113 Scenarios

## Feature: Insights Language (R1, R2)

### Scenario: Generate Estonian Insights from an English transcript
Given a completed English transcript with no Insights
When the user selects Estonian and chooses Generate insights
Then the summary, decisions, actions, and questions are Estonian
And verbatim quotes remain in the source language
And timestamps still seek to supporting transcript segments

### Scenario: Generate English Insights from an Estonian transcript
Given a completed Estonian transcript
When the user selects English and generates Insights
Then generated Insights prose is English
And the raw transcript is unchanged

### Scenario: Auto resolves a known transcript language
Given the session records language `et`
When the user leaves Insights language on Auto
Then the UI exposes Estonian as the resolved output language
And the host prompt receives the normalized Estonian language value

### Scenario: Language survives reload
Given Estonian Insights were generated successfully
When the workbench is closed and reopened
Then the same Insights and Estonian selection are restored

### Scenario: Failed regeneration preserves the prior result
Given successful English Insights exist
When the user selects Estonian and regeneration fails or is cancelled
Then the English Insights and their language metadata remain intact
And no partial Estonian result is stored

### Scenario: Legacy session has no Insights language
Given a pre-Sprint-113 session contains Insights without language metadata
When the workbench opens
Then it loads without migration failure
And the selector uses the documented Auto fallback

## Feature: Separate Insights Document (R3)

### Scenario: Create a named Insights file
Given generated Insights and a saved primary transcript
When the user chooses Create insights document
And names a new target `meeting-memo.md`
Then `meeting-memo.md` contains Insights-only Markdown and provenance
And the primary transcript bytes, modification time, link, and `session.exportPath` are unchanged

### Scenario: Filename receives Markdown extension
Given generated Insights
When the user chooses the new filename `meeting-memo`
Then the created filename is normalized to `meeting-memo.md`

### Scenario: Existing target is refused
Given `meeting-memo.md` already exists
When the user chooses that path
Then Ritemark does not replace it
And asks for another name or permits cancellation
And neither the existing file nor the primary transcript changes

### Scenario: Primary transcript path is refused
Given the session primary export is `meeting.md`
When the user chooses `meeting.md` for the Insights document
Then Ritemark refuses the target even if the file is otherwise writable
And the transcript remains unchanged

### Scenario: Cancel creates nothing
Given generated Insights
When the user cancels the save dialog
Then no file is created
And no session path or metadata changes

### Scenario: Write failure is non-destructive
Given a valid new target cannot be written
When the host attempts to create the Insights document
Then Ritemark names the failure and a next action
And no partial target or transcript change remains

## Feature: Regression Safety (R4)

### Scenario: Primary transcript save is unchanged
Given a transcript with generated Insights
When the user uses the primary transcript Save action
Then existing transcript save/collision/link behavior is unchanged

### Scenario: Keyboard-only use
Given focus is in the Insights rail
When the user changes language and creates a document using only the keyboard
Then focus order, visible focus, labels, and cancellation are complete

## Feature: Speaker Name Editing and Layout (R5)

### Scenario: Rename a speaker with a full name
Given the speaker is named `Speaker 1`
When the user opens Rename speaker and enters `Jarmo Tuisk`
And presses Enter
Then the saved speaker label is `Jarmo Tuisk`
And every segment for that speaker uses the full name
And closing and reopening the workbench preserves it

### Scenario: Space in the rename input does not control playback
Given audio is playing or paused
And focus is inside the Rename speaker input
When the user presses Space between `Jarmo` and `Tuisk`
Then a space is inserted into the input
And playback state does not change

### Scenario: Playback shortcuts still work on the workbench surface
Given focus is on a non-interactive area of the Transcript Workbench
When the user presses Space
Then playback toggles
When the user presses Left or Right
Then playback seeks by the documented interval

### Scenario: Normalize surrounding whitespace
Given the rename input contains `  Jarmo   Tuisk  `
When the user commits the rename
Then the stored label is `Jarmo Tuisk`

### Scenario: Reject an empty speaker name
Given the rename input contains only whitespace
When the user attempts to commit
Then the prior speaker name remains unchanged
And the rename UI stays available for correction or cancellation

### Scenario: Long name is ellipsized in the transcript gutter
Given a speaker is named `Risto-Raaper Kultuuriministeerium`
When that speaker's turn renders in the fixed-width transcript gutter
Then the name stays on one line and ends in an ellipsis when it does not fit
And the transcript text and timestamp columns remain aligned
And hovering or focusing the label exposes the full name

### Scenario: Long name is ellipsized in the speaker bar
Given a speaker has a name longer than the available chip width
When the speaker bar renders at its minimum supported width or 200% zoom
Then the chip remains bounded and shows an ellipsis
And its rename action and full accessible name remain available

### Scenario: Full name survives exports and Insights
Given the speaker is named `Jarmo Tuisk`
When the transcript Markdown and Insights prompt are generated
Then both use `Jarmo Tuisk` without joining, splitting, or truncating the stored name

## Manual Evidence Log

### 2026-08-24 — first draft PR #217 smoke

- **Failed:** the actual Insights rail DOM/tab order placed **Regenerate** before the language selector.
- **Failed:** at approximately 207% zoom (`innerWidth=354`), the workbench reported `scrollWidth=1080` and clipped the transcript/editor surface.
- **Fix implemented locally; PR retest pending at this checkpoint:** the selector now precedes **Regenerate** in DOM order. At narrow widths the transcript and Insights panes stack vertically, flex children opt into shrinking with `min-width: 0`, controls wrap where needed, and long labels retain ellipsis plus their full accessible names. No whole-document horizontal scrolling or overflow-hiding workaround was added.
- Automated DOM-order and responsive-containment contracts passed, but this was not yet manual pass evidence. Keyboard order, approximately 207% zoom geometry, rail usability, and long-name accessibility still required a draft-PR rerun at this checkpoint.

### 2026-08-24 — first draft PR #217 responsive-fix rerun

- **Passed:** actual language → **Regenerate** keyboard order, zero horizontal overflow at `innerWidth=354`, column stacking, the wider `innerWidth=654` zoom layout, and long recording/document/speaker accessible-name plus ellipsis checks.
- **Failed:** at the exact `354×300` viewport with Explorer visible, fixed chrome consumed almost all available height. The Insights rail collapsed to `clientHeight=0`, its content scroller was only 24 px high, and focusing language or **Create insights document** left the control clipped below the viewport.
- **Failed:** **Regenerate** retained a native 1 px orange outline instead of the approved 4 px translucent indigo focus-visible ring.
- **Next fix implemented locally; another PR retest pending at this checkpoint:** narrow chrome is bounded to half the viewport with its own scroller; the remaining height is split deterministically between transcript and Insights with two `minmax(0, 1fr)` grid rows; Insights retains its own bounded content scroller; **Regenerate** now uses the standard indigo ring. This was automated contract evidence only, not a manual pass.

### 2026-08-24 — final responsive UI rerun

- **Passed:** at the exact `354×300` viewport and DPR `4.147200107574463` (approximately 207%) with Explorer visible, document, body, and `#root` all remained exactly `354×300` with zero horizontal or vertical document overflow and document/body `scrollTop=0` during inner scrolling and focus.
- **Passed:** chrome was 150 px high with its own bounded scroller; the remaining 150 px pane grid resolved to two `74.9904px` rows. Transcript and Insights scrolled independently, with the Insights rail at 74 px and its inner scroller at 37 px for 727 px of content.
- **Passed:** language, keyboard-reached **Regenerate**, and **Create insights document** were wholly visible after their bounded pane scrolling. **Regenerate** computed the approved `rgba(67, 56, 202, 0.1) 0 0 0 4px` indigo focus ring with a transparent outline and no native orange outline.
- **Passed:** `654×300` at the same DPR retained the bounded two-row layout; `1400×766` at 100% retained side-by-side panes with a 288 px Insights rail. Long document and speaker names stayed ellipsized while their complete path/name remained in title and ARIA metadata.
- **Unverified:** no authenticated model generation/regeneration was invoked, and the final read-only rerun focused but did not click **Create insights document**. Those model-quality and file-mutation scenarios remain open; earlier save-fixture coverage was not repeated.
