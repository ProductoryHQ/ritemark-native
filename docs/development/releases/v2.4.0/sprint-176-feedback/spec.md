# Sprint 176 spec

Experience 53 defines the words and behaviour for the app half of #1045. The frames due 27 November settle placement, spacing and the states called out below. The feedback and consent choices in this draft are for approval.

### R1 · React to an AI answer

Every completed answer has **Good answer** and **Not right** in its footer beside Done. Show them on the latest completed answer and on an older answer on hover or keyboard focus. Pending, stopped and failed turns have no thumbs. One press records one local reaction per answer. With usage data on it also sends the mark alone. Up shows “Thanks.” and **Tell us more**. Down opens “What wasn’t right?” and **Send**. The optional **Add this answer** starts off and previews the exact excerpt that would go by e-mail. Words are optional after a thumb. Frames settle the footer layout, narrow sidebar and confirmation and retry states.

### R2 · Report a failure where it happened

**Tell us about this** opens Send feedback from a failure card. The card’s visible words appear as an editable, removable quote. Opening or dismissing the sheet sends no quote. AI answer failures, sign-in and limit cards, Publish failures and file-read failures are the starting set. The frames settle the exact card inventory and where the link fits beside existing recovery actions.

### R3 · Find the project and community on Home

Home’s existing guidance slot offers **Ritemark is open source** in place of the week’s question. Use Experience 53’s words and buttons **Star on GitHub**, **Discussions** and **Not now**. The card is due after a local thumbs-up or the third distinct day with a saved document, whichever comes first, after the first app session. It opens the repository or Discussions in the default browser. Not now dismisses it until the next release. An accepted Star browser handoff dismisses it permanently. The card appears at most once per release and three times per rolling year. Frames settle the card layout and how it leaves the slot after an action.

### R4 · Add a window picture to feedback

**Add a picture of this window** starts off in the existing Send feedback sheet. Checking it shows the picture of this Ritemark window and “It shows what’s on your screen, your document too.” Unchecking or closing discards the preview. The e-mail action copies the pictured window for the person to paste into their e-mail. They see ⌘V on macOS and Ctrl+V on Windows. Ritemark never uploads the picture. The frames settle preview size, capture failure and e-mail handoff states.

### R5 · Find the links later in Help

Help offers **Ritemark on GitHub** and **Discussions** beside **Send feedback**. Both open the same destinations as Home, even after that card is dismissed. Frames settle the menu grouping. Send feedback also stays in the status bar.

### R6 · Keep saved days across releases

A qualifying document save counts once per local calendar day, across projects and versions. An update carries forward the days already known on that computer. Three days are enough to qualify for R3. The counter works offline and with usage data off.
