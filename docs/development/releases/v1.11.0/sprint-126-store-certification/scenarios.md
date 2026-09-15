# Sprint 126 Scenarios

**Parent:** [spec.md](./spec.md) · ★ marks a scenario that must pass on the packaged Windows app, because it is evidence for the resubmission rather than only a regression guard.

## Feature: Report entry points (RQ1)

### ★ Scenario: Reporting is reachable from a completed turn
Given the AI sidebar has at least one completed assistant turn
When the user looks at that turn
Then a report control is present, keyboard reachable, and carries an accessible name stating it reports the output

### ★ Scenario: Reporting is reachable with no turn at all
Given a fresh conversation with no assistant output yet
When the user opens AI Information from the composer
Then a report entry is present there

### Scenario: All three runtimes expose the same control
Given completed turns produced by Claude Code, by Codex and by OpenCode
When the user inspects each turn
Then the same report control appears on each, with identical wording and behaviour

### Scenario: No user setting can remove the entry points
Given a user who has disabled analytics and every experimental feature available to them
When the sidebar renders
Then both report entry points are still present and functional

## Feature: The composition window (RQ2)

### ★ Scenario: The user sees the exact bytes before anything leaves
Given the user reports a specific assistant turn
When the composition window opens
Then it shows the reported output and the context lines of RQ5 as editable text
And no content is carried that the window does not display

### ★ Scenario: The user removes something private before reporting
Given the composition window is open with the model output pre-filled
When the user deletes a sentence from the field and proceeds
Then only the remaining text is carried

### Scenario: Cancelling leaves nothing behind
Given the composition window is open
When the user cancels
Then nothing is transmitted, no mail client opens, and no draft is retained

### Scenario: Reporting from AI Information opens an empty body
Given the user opens the report entry from AI Information with no turn in context
Then the context lines are present and the body is empty for the user to describe the problem

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
Given a report composed from a turn in a long conversation, in a named workspace, with a document open
When the composed text is inspected
Then it contains the reported output, the runtime, the model identifier, a timestamp, the Ritemark version and platform, and the user's own text
And it contains no other turn from that conversation, no document content, no file path, no workspace name

### ★ Scenario: Credentials never appear
Given a signed-in runtime with stored credentials and a configured provider key
When a report is composed
Then no API key, token or account identifier appears anywhere in it

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
