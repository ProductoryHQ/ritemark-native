# The feedback sheet's audit (R10–R13)

26 October 2026, on the Sprint 140 branch, VS Code 1.142 at the pin. What the technical plan asked, and what was found.

## VS Code's dialog with `renderBody`: not enough

`vscode/src/vs/base/browser/ui/dialog/dialog.ts` takes its buttons once, when the dialog is shown (`this.buttons`, line 175), and resolves on any button press (`onButtonClick` → `resolve`, lines 305–310). `renderBody` adds content between the message and the buttons; it cannot:

- change the primary button from Send to Open in e-mail as the boxes change (R11);
- keep Send disabled until something is typed (S54);
- stay open after a press with the message and one line when it did not go (D5, S60);
- turn into frame 5's hand-off with Copy and Done.

So the plan's preferred shape fails, and its fallback (the sheet on the AI's sheet, as `ReportDialog`) would not be as drawn. **What was built instead:** the sheet as its own DOM in patch 018 (`src/vs/workbench/browser/parts/ritemarkFeedbackSheet.ts` and `media/ritemarkFeedbackSheet.css`), on the dialog's own dimmed block (`.monaco-dialog-modal-block.dimmed`), in experience 31's dialog style (440 wide). It is not VS Code's dialog, but it is over the window as drawn, so the Experience lead's frames 2, 3 and 5 hold.

## What the sheet does, and how it was checked

| Point | Result | Evidence |
|---|---|---|
| The message field grows from 112 | `field-sizing: content`, `min-height: 112px`; no hand resize | CSS; screenshots `light-fb2-sheet.png` |
| The boxes change the button, the note and the foot at once | `update()` on every input and change | VS Code unit test "the words change live…"; CDP `qa-2-sheet.mjs` |
| The last answer's box only when the AI box is ticked and a chat answer exists | `last.row.hidden = !ai.input.checked`; no box without an answer | Unit test "an AI issue…"; CDP S49/S57 (no chat) and S55 (ChatGPT's answer) |
| A quoted block | The answer as the e-mail carries it (its Markdown source) | `light-s55-last-answer.png` |
| Enter makes a new line; ⌘Enter / Ctrl+Enter presses the button; Escape closes and sends nothing | `ritemarkFeedbackKey` | Unit test "the route follows the boxes, and the keys"; CDP S53 on the Mac (Ctrl+Enter on Windows not run) |
| Focus | The message field on open; Tab stays inside the sheet; focus returns where it was on close | Unit test; CDP (`focused: ritemark-feedback-area`) |
| The window dimmed behind, the desk's and the AI sheet's webviews included | The block covers the workbench, webviews included | Screenshots |
| `[hidden]` parts | `display: none !important` (the sheet's own flex rules had shown the e-mail note and Open in e-mail on the straight route) | Fixed in `a4f9084d`; screenshots after |
| Three buttons (D5) | The foot's note takes its own line so no button wraps | Fixed in `fcd669b3`; `light-fb-d5-did-not-go.png` |
| VoiceOver and Narrator | **Not run.** The sheet has `role="dialog"`, `aria-modal`, `aria-labelledby` and `aria-describedby`; the boxes are real checkboxes with labels | Markup only |
| Windows' custom dialogs | **Not run** (no Windows in this sprint's runs) | — |

## How the result returns

The extension opens the sheet with the hidden command `_ritemark.feedbackSheet(spec)`, registered by 018 through `CommandsRegistry`; the spec carries every word (`feedbackCopy.ts`), so the words change without an app release. The sheet asks the extension's `_ritemark.feedback.submit` to send or to open the e-mail app, with a token so a closed sheet cannot send. The command resolves `'sent' | 'mailed' | 'cancelled'`.

Found in QA: the extension read `result.outcome` from that string, so the thank-you never showed. Fixed in `a4f9084d` (the type is `FeedbackSheetOutcome` on both sides).

## Frame 4's toast

2.0's notification toast, restyled by 018, at the bottom right: "Thank you. It's with the people who make Ritemark." The drawing shows a dark pill centred under the document; Ritemark has no such surface, and the plan says "frame 4's toast as 2.0's notification toast". For the Experience lead's match check.

## Help ▸ Send feedback

An `Action2` in patch 015's `helpActions.ts` (`ritemark.help.sendFeedback`, order 4 in `1_welcome`, after Support), with its id in the menubar allowlist and the menu's test. Checked on the Mac in the menubar data (`lastKnownMenubarData`: Getting started, Support, Send feedback, then View License and Advanced) and by running it (the sheet opened, `feedback_opened {from: help}`). Windows' menu not run.

## The fallback

A shell without 018's sheet (an extension update over 2.0) gets 2.0's ways: an AI issue opens the report window on the AI's sheet, and feedback asks in an input box and sends straight. Not run live (it needs a 2.0 shell with this extension).
