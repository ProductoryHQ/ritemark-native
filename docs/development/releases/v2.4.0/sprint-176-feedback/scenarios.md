# Sprint 176 scenarios

### S1 · A completed answer gets a thumb (R1)

Given a finished answer in each supported AI and usage data on, when I press Good answer twice, then I see Thanks and Tell us more and one mark goes. Moving the pointer or keyboard focus to an older answer reveals its controls. Running, stopped and failed turns offer none.

### S2 · A thumb with usage data off or offline (R1, R3)

Given usage data is off or the machine is offline, when I press Good answer, then I can still leave words and qualify for the Home card locally. No mark leaves with usage data off. An offline mark is never replayed and the UI makes no claim of delivery.

### S3 · Optional words and answer (R1)

Given I press Not right or open Tell us more, when I enter words and Send with Add this answer off, then only my words use the straight route; with usage data on the source (`from: thumb`) goes with them, and with it off only the words go. When I opt in to an answer excerpt, then the preview matches the e-mail body and Copy fallback. Esc or an outside click before sending discards the draft and sends no content.

### S4 · A failure quote I can remove (R2)

Given a supported failure card, when I open Tell us about this, then its displayed words are quoted and editable. Remove them and add my own words, then Send. The receiving side gets only the final field and fixed source, with no diagnostics added. Repeat with usage data off and check the one-off identifier and absence of shared properties. Opening alone sends no quote.

### S5 · Feedback when the network is down (R1, R2, R4)

Given the straight route cannot reach the service, when I Send, then the words stay available and I can retry or open e-mail. An accepted e-mail handoff never says Sent. With no mail handler or an oversized body I can use Copy. Copy makes clear whether it replaces the picture clipboard.

### S6 · Home earns its moment (R3, R6)

Given a new installation, when I save on three distinct days or give a thumbs-up during the first session, then the card waits until a later session and an available slot. What moved and a same-day ready request still get their priority. Check each qualifying path independently with usage data off and after an update.

### S7 · Home remembers the choices (R3)

Given the card has shown, when I revisit Home or switch projects in the same session, then it does not spend another display. After Not now or a return in the same release it does not ask again. Try Discussions, a refused Star open and an accepted Star open separately. Discussions opens the community and leaves the card available in its current presentation. A refused Star open leaves a retry. An accepted one ends the ask on later releases. A fourth eligible release inside 12 months waits until the rolling cap allows another display.

### S8 · Picture stays local until I choose what to do (R4)

Given two Ritemark windows and another app, when I tick the picture box, then the preview shows only the window that opened the sheet and no picture is written to clipboard, disk or network. Uncheck or dismiss and verify the same. On Open in e-mail only the reviewed picture reaches the clipboard. The mail draft contains text, and the picture leaves the machine only if I paste it and send the e-mail.

### S9 · Capture and mail on Windows (R4)

Given Windows at 150% scaling, repeat S8 and check the correct window, readable controls and Ctrl+V in a mail client that accepts pasted images. With capture unavailable or a failed clipboard write, see a clear failure and keep the text draft available. Repeat the image handoff on macOS with ⌘V.

### S10 · Help remains available (R5)

Given Home is hidden or dismissed, when I open native macOS Help or Windows Help, then both new items appear beside Send feedback and open the exact addresses in the default browser. Offline the browser can show its own network error. If the system refuses a launch, the app offers a retry without claiming success.

### S11 · Upgrade and repeated saves (R6)

Given a previous build has two saved days, when I update and save twice on a third day in different projects, then the count reaches three once. Repeat offline, with usage data off and with overlapping windows. An untitled or otherwise nonqualifying save still does not count. No new usage event results from the count.

### S12 · Controls and dismissal (R1–R5)

Given keyboard navigation, a narrow sidebar and light and dark themes, when I visit every added button, then its tooltip and accessible name describe its action and its label stays on one line. Outside click and Esc close popups and restore focus. Existing retry and recovery actions still work. Check the native menu and the shell sheet with their respective controls.
