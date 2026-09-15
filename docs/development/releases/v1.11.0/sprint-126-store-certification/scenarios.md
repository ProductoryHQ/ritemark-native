# Sprint 126 Scenarios

**Parent:** [spec.md](./spec.md) · ★ marks a scenario that must pass on the packaged Windows app, because it is evidence for the resubmission rather than only a regression guard.

## Feature: Report entry points (RQ1)

### ★ Scenario: Reporting is reachable from the status bar on any screen
Given Ritemark is open with the AI sidebar closed and no conversation started
When the user looks at the status bar
Then a report item is present immediately right of the AI status indicator
And activating it reveals the AI panel and opens the report window

### ★ Scenario: Reporting is reachable from AI Information
Given the composer is visible
When the user opens AI Information
Then a report entry is present there, keyboard reachable, with an accessible name stating what it does
And it opens the same window the status bar item opens

### Scenario: No per-turn control is introduced
Given the transcript contains completed turns from Claude Code, Codex and OpenCode
When the user inspects those turns
Then no per-turn report control is present, because reporting is reached from the status bar and AI Information

### Scenario: No user setting can remove the entry points
Given a user who has disabled analytics and every experimental feature available to them
When the sidebar renders
Then both report entry points are still present and functional

## Feature: The composition window (RQ2)

### ★ Scenario: The window opens empty and nothing is harvested
Given the user has a long conversation open, in a named workspace, with a document open
When the composition window opens
Then the body is empty and only the context lines of RQ5 are present
And no conversation content, document content, workspace name or file path appears anywhere in it

### ★ Scenario: The user pastes the output and edits it before reporting
Given the composition window is open
When the user pastes model output into the body, removes a sentence from it, and proceeds
Then exactly the remaining text is carried

### Scenario: Cancelling leaves nothing behind
Given the composition window is open
When the user cancels
Then nothing is transmitted, no mail client opens, and no draft is retained

### Scenario: Both entry points open the same window in the same state
Given the report window is opened from the status bar, and separately from AI Information
Then both show the same context lines, the same empty body and the same actions

## Feature: Transport (RQ3)

### ★ Scenario: A mail handler exists
Given the machine has a working default mail handler
When the user proceeds from the composition window
Then the mail client opens, addressed to info@productory.eu, with the subject naming Ritemark and its version and the body exactly as composed

### ★ Scenario: A clean Windows machine with no mail account
Given the machine has no mail handler registered
When the user proceeds from the composition window
Then Ritemark shows info@productory.eu and the complete report text with a Copy button
And the report text is selectable and copyable in full
And nothing about the outcome is presented as an error or a failure

### Scenario: Copy puts the whole report on the clipboard
Given the fallback state is shown
When the user presses Copy
Then the clipboard contains the entire composed report, not a truncation

## Feature: Honest language (RQ4)

### ★ Scenario: Ritemark never claims the report was sent
Given the user has proceeded and the mail client has opened
When the user reads what Ritemark says
Then it says the mail app was opened and the report still has to be sent from there
And the words "sent", "delivered", "received" and "thank you for your report" do not appear
And no checkmark, success animation or confirmation toast implies receipt

### Scenario: The fallback says who must act
Given the fallback state is shown
Then the text says plainly that the user must paste the report into an email and send it

### Scenario: The button says what it does before it is pressed
Given the composition window is open
Then the primary action is labelled with what will happen — the mail app opening — not with sending

## Feature: Payload bounds (RQ5)

### ★ Scenario: Only the stated fields are present
When the composed text is inspected
Then it contains a timestamp, the Ritemark version and platform, and the user's own text
And nothing else — no conversation, no turn, no document, no file path, no workspace name, no runtime or model identifier

### ★ Scenario: Credentials never appear
Given a signed-in runtime with stored credentials and a configured provider key
When a report is composed
Then no API key, token or account identifier appears anywhere in it
And this holds by construction, because the builder is never given them

### Scenario: The bound is enforced where the payload is built
Given a caller that passes extra fields to the payload builder
When the payload is built
Then the extra fields are dropped rather than forwarded

## Feature: No external acquisition promotion (RQ6)

### ★ Scenario: Windows without Git shows no download button
Given a Windows machine with no Git installed
When the user opens Source Control
Then the view explains that Source Control needs Git installed
And no button offering to download Git is rendered
And the reload and troubleshoot actions still work

### ★ Scenario: The welcome page informs without offering
Given a machine with neither Git nor Node installed
When the welcome page renders its launch checks
Then it says "Ritemark needs Git." and "Ritemark needs Node."
And neither line offers an action that opens an external download page

### ★ Scenario: Installed Git is untouched
Given a Windows machine with Git installed and a repository open
When the user uses Source Control
Then staging, committing and branch operations behave exactly as before the change

### Scenario: An upstream bump cannot silently restore the strings
Given the VS Code submodule is updated and upstream has changed the scm.missing strings
When the patches are applied
Then the applicability check fails loudly rather than leaving the download links in place

## Feature: Store metadata (RQ7)

### Scenario: The live StoreLogo2 asset is identified before replacement
Given the Partner Center listing is open
When the StoreLogo2 slot is inspected
Then the actual published asset is recorded, with its dimensions, before any replacement artwork is prepared

### Scenario: Freemium classification without inventing a payment feature
Given the pricing classification is changed to Freemium
When the listing text is read
Then it explains that AI features may require the user's own paid third-party account
And it does not describe a Ritemark subscription, purchase or in-app payment

### Scenario: Every other submitted image is checked
Given the set of images in the submitted listing
When each is inspected
Then none shows non-Windows UI or devices, and the check is recorded per image
