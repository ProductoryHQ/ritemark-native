# Sprint 133 Scenarios

These are the manual QA matrix. Each one names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it is run on the Mac, in Ritemark Light and in Ritemark Dark, on a dev instance launched in the background with its own short user-data directory (memory: `dev-instance-cdp-isolation`). A "fresh profile" is an empty user-data and extensions directory. A "v1.14.0 profile" is one made with the installed v1.14.0 app, in its own instance.

## Feature: The welcome is a Ritemark page (R1)

### S1: A fresh start with no folder
Given a fresh profile
When Ritemark opens with no folder
Then the welcome's sheet is the only thing in the window: no strips, tabs, +, side columns or status bar; on the Mac the traffic lights stay
And the sheet is 640 wide and centred, with the header illustration, the logo, "1 · Your AI" lit on the progress bar, "Welcome to Ritemark" and the one line
And VS Code's Getting Started page is not open, and no terminal opens.

### S2: The keyboard and a screen reader
Given the welcome on step 1
When the person moves with Tab and presses Enter, with VoiceOver on
Then focus moves through the cards in reading order, each button presses with Enter and Space, and VoiceOver reads the question, each card's name and words, and each state.

### S3: Dark
Given Ritemark Dark chosen in Settings on a fresh profile
When the window has no folder
Then the welcome draws as in Light on the dark ground, every text at 4.5:1 or more.

## Feature: Which AI do you use? (R2)

### S4: The three cards
Given step 1
Then it shows ChatGPT and Claude, each with "Sign in with the account you already use." and a blue Sign in, and OpenCode with "Open models, with an API key of your own." and Set up
And under them "You can use more than one.", API keys and Skip for now
And the word Codex appears nowhere.

### S5: API keys
When the person clicks API keys
Then a small sheet opens over the welcome, in experience 31's dialog style, where the Anthropic API key can be entered, as in Settings; no key is offered as a way to use ChatGPT
When a valid key is saved and the person clicks Done
Then the sheet closes, Claude is marked as set up, and the welcome moves to step 2.

### S6: Skip for now
When the person clicks Skip for now
Then the welcome moves to step 2 with no AI, and step 2's line about Claude names no AI
And step 2 offers no skip: closing the window is the way out.

### S7: Already signed in
Given Claude Code is signed in on this computer before Ritemark's first start
When the welcome opens
Then Claude's card shows Checking…, then Signed in, and its button reads Continue.

## Feature: Signing in (R3)

### S8: Signing in to Claude
When the person clicks Claude's Sign in
Then Claude's own sign-in starts, the card says the browser opened Claude's sign-in page, with a spinner, Finish there and Cancel, and "Did nothing open? Open the page again" shows under the cards
And the other cards fade but can still be clicked
When the sign-in finishes in the browser
Then the welcome moves to step 2 and says "Signed in to Claude".

### S9: Signing in to ChatGPT
As S8, with ChatGPT's own sign-in, ending with "Signed in to ChatGPT".

### S10: Cancelling, and opening the page again
Given a sign-in in progress
When the person clicks Open the page again
Then the provider's page opens again
When the person presses Escape, or clicks Cancel
Then the card returns to Sign in, and the sign-in started for it is stopped.

### S11: A sign-in that fails (negative)
Given the network drops during a sign-in, or the browser page is closed without finishing
Then the card returns to Sign in with one sentence saying what happened and what to do, and no error code or "authentication" appears.

### S12: OpenCode
When the person clicks OpenCode's Set up
Then a small sheet opens over the welcome with today's OpenCode fields
When the person enters a provider's key and clicks Done
Then OpenCode is marked as set up, becomes ready, and the welcome moves to step 2.

### S13: A terminal for a sign-in
Given a sign-in flow that opens a terminal
Then the terminal opens as a tab beside the welcome, never in the AI column, and the welcome learns when it finishes.

## Feature: States as they are known (R4)

### S14: Checking does not block
Given a fresh profile with Claude signed in and ChatGPT signed out
When the welcome opens
Then each card shows Checking… and changes on its own as its check answers; the person can click Skip for now or a Sign in while checks run.

### S15: A check that does not answer (negative)
Given a provider's check is made to hang (its binary replaced by one that sleeps)
Then after 20 seconds its card shows Sign in with "Couldn't check. Try again." and a retry, not a spinner
And a cold first start of the runtime that answers within 15 seconds is shown as its real state, not as a failure.

### S16: Offline
Given the network is off
When the welcome opens
Then one line says the person is offline and the sign-ins are checked when they are back, each provider says Not checked yet, and step 2's choices work.

## Feature: Set up project (R5)

### S17: Open a folder
Given step 2
When the person clicks Open a folder… and picks a folder
Then the window lands on that project (S20).

### S18: Start a new project
When the person clicks Start a new project
Then the row opens into a "Project name" field and Create, with "In ~/Documents/Ritemark/<name>" under it in muted ink and Change…
When the person types "Board report 2026" and clicks Create
Then an empty folder `~/Documents/Ritemark/Board report 2026` is created and the window lands on it
When the person instead uses Change… to pick another place
Then the line shows that place and the folder is created there.

### S19: A name that cannot be used (negative)
When the person names a new project the same as an existing folder there, or with a character the system refuses
Then the welcome says so in place, and nothing is created.

### S20: Missing Git
Given a Windows PC set to this computer's own Claude, with no Git
Then step 2 shows, under "Signed in to Claude", a warning-circle line: "Claude from this computer needs Git, and Git isn't installed. Use Ritemark's own Claude instead, or install Git and restart Ritemark." with Use Ritemark's own Claude, and no download or install link
When the person clicks Use Ritemark's own Claude
Then the runtime switches to Ritemark's own and the line goes
And with Ritemark's own Claude, or on a Mac, no such line shows; the same holds for Node.js.

### S50: Try the sample project
Given step 2, with the switch on
When the person clicks Try the sample project ("A small leadership programme, with documents to work on.")
Then a folder `~/Documents/Ritemark/Leadership programme` is made with the sample's brief, modules, kickoff notes and tasks, and the window lands on it (S21): Documents lists them, and the task board shows the sample's tasks
And `project_opened` arrives once with `source: sample`
And the sample inside the app is unchanged.

### S51: A sample folder already there (negative)
Given `~/Documents/Ritemark/Leadership programme` already exists (the person's own folder of that name, or an earlier copy of the sample with edits in it)
When the person clicks Try the sample project
Then nothing in that folder changes; the copy goes to `~/Documents/Ritemark/Leadership programme 2`, and the window lands there.

## Feature: Landing on the project (R6)

### S21: Landing
Given the person signed in to Claude and picked a folder
When the window reloads
Then Documents is open in the left column with the project's name in its head, the AI's sheet is open on a new chat with Claude, its message box reads "Ask Claude about this project", and the empty desk offers Text, Table and Web page as tiles
When the person clicks Table
Then a new table opens as a tab, as the +'s Table does.

### S22: Landing once
Given a landed project
When the person opens another folder from the head's menu
Then no landing happens there: the window opens as it would without the welcome.

### S23: A folder gone during the reload (negative)
Given the picked folder is removed while the window reloads
Then the window says the folder is not there and shows the welcome's step 2.

## Feature: Usage data (R7)

### S24: Off until yes
Given a fresh profile, with PostHog's live events open and a network capture of the app
When the person goes through the welcome to a project without touching the switch, then writes and chats for a while
Then nothing is sent to PostHog.

### S25: Yes
Given the same, but the person turns the switch on in step 2
Then from that moment events are sent, and the welcome's held events arrive once (R8).

### S26: Turning it off
Given the switch was turned on
When the person turns usage data off in Settings
Then nothing more is sent, from that moment.

### S27: The 1.x notice is gone
Given a fresh profile and a v1.14.0 profile
When Ritemark starts and the person works for a while
Then the 1.x usage-data toast never shows, and the Privacy Policy and Terms of Use links are reachable beside the switch and in Settings.

### S28: A 1.x Opt Out stays off
Given a v1.14.0 profile whose person chose Opt Out
When the update welcome shows
Then its switch is off, with "Off until you turn it on. Never your documents, chats or names.", and nothing is sent, before or after the person picks a project.

### S52: A 1.x OK carries over
Given a v1.14.0 profile whose person pressed OK on the usage-data notice, with PostHog's live events open
When this build starts on it
Then the update welcome's switch is on, with "On, as you chose in Ritemark 1. Never your documents, chats or names.", and events are sent from the first start, `welcome_shown` (`kind: update`) once
When the person turns the switch off on the sheet
Then nothing more is sent, from that moment, and Settings shows usage data off.
(This holds under the first reading of the open technical point in technical-plan.md, W1. Under the second, this profile starts off, as S53.)

### S53: No answer to 1.x's notice starts off
Given a v1.14.0 profile whose usage-data notice was never answered (the app quit while it showed)
When this build starts on it
Then the update welcome's switch is off, with "Off until you turn it on. Never your documents, chats or names.", and nothing is sent
When the person turns the switch on
Then events are sent from that moment.
A profile whose notice was closed with its ×, or left through Privacy Policy or Terms of Use, stored the same as an OK. It follows the reading Jarmo picks (technical-plan.md, W1), and its scenario is written then.

## Feature: Four events (R8, R9)

### S29: The events after a yes
Given a fresh profile, on a production build (or a dev run with `build_channel` checked as `dev`)
When the person signs in to Claude, turns the switch on, opens a folder and sends a first message
Then PostHog receives `welcome_shown` (`kind: fresh`), `ai_signed_in` (`provider: claude`, `method: account`), `project_opened` (`source: existing_folder`, `has_ai: true`) and `first_message_sent` (`provider: claude`), once each, each with `build_channel`
And no property holds a path, a name, a file, a message or an account.

### S30: The events after a no (negative)
Given a fresh profile
When the person signs in, leaves the switch off and opens a folder
Then none of the four events, and no other event, reaches PostHog; after a restart, still none.

### S31: A second first message
Given `first_message_sent` was sent on this profile
When the person sends a message in another project
Then it is not sent again.

### S32: Dev runs
Given a dev run from source with the switch turned on
Then every event carries `build_channel: dev`
And a run of the `ritemark-automation` skill's throwaway profile sends nothing.

## Feature: Updating from 1.x (R10)

### S33: The update welcome
Given a v1.14.0 profile signed in to Claude and ChatGPT, with three recent folders and the window last closed on "Leadership programme"
When this build starts on it
Then the update welcome shows once: "Welcome to Ritemark 2.0", Your AI with Claude and ChatGPT (Checking…, then Signed in), Leadership programme first with "Open when you left", two more with when they were last open, Open another folder…, Start a new project and the switch, showing the profile's 1.x answer (S28, S52, S53).

### S34: Back to where they left
When the person clicks "Open when you left"
Then the sheet closes and the window is as it was, without a reload, its tabs restored (a terminal from the AI column as a tab, Sprint 132)
When Ritemark restarts
Then no welcome shows.

### S35: Another project
Given the update welcome
When the person clicks another project
Then the window reloads into it, and the welcome never shows again.

### S36: One AI signed out
Given a v1.14.0 profile whose ChatGPT sign-in has ended
Then ChatGPT's row says its sign-in has ended with a blue Sign in, Claude's says Signed in, and a project opens at once with Claude.

### S37: A fresh profile never sees it (negative)
Given a fresh profile
Then the update welcome never shows; only the fresh welcome does.

## Feature: A first window opened with a file (R11)

### S38: A document double-clicked on the first launch
Given a fresh profile
When the first launch opens `note.md` in a folder (from Finder, or `<folder> <folder>/note.md`)
Then `note.md` opens once, in the Ritemark editor, the welcome does not cover it, and the AI's sheet offers the sign-ins
When the person later opens a window with no folder
Then the welcome shows.

### S39: #429's reproduction (negative)
Given a fresh profile with `"workbench.editorAssociations": {"*.md": "default"}`
When it is launched with `<folder> <folder>/note.md`
Then one tab is open for `note.md`
And 25 fresh launches with a `.md` each end with one tab.

## Feature: The Getting Started page retires (R12)

### S40: Every way in
When the person tries Help's welcome entry, the command palette's Welcome and walkthrough commands, and starts with `workbench.startupEditor` left at its default
Then VS Code's Getting Started page never shows: each opens Ritemark's welcome, or is not offered.

### S41: The launch check's rows
Given Ritemark Settings
Then, with this computer's own Claude chosen, the Git and Node.js rows show under the runtime choice, as 1.x's launch check did; with Ritemark's own Claude they do not show
And each AI's sign-in state shows with its Sign in
And it shows the usage-data choice with the welcome's words, with the Privacy Policy and Terms of Use links.

## Feature: The muted extension (R13)

### S42: The tree and the tabs
Given a project with `Brief.md`, `report.final.md`, `README`, `.gitignore` and `Kickoff notes.pdf`
Then in the tree and on tabs each name is in the body ink and its extension in the muted ink (`.md` of `report.final.md` only; none for `README`; `.gitignore` whole in the body ink)
And on the chosen tab and the open row both parts are the body ink
And in high contrast the extension keeps 4.5:1.

### S48: A finished profile's window with no folder
Given a profile that has opened a project from the welcome
When the person opens a new window with no folder
Then a short sheet on the ground asks "Where do you want to start?" with the recent projects, Open another folder… and Start a new project, and no Your AI or usage-data switch.

### S49: Every empty desk
Given a project window
When the person closes every tab on a desk
Then that desk offers Text, Table and Web page as tiles, and each opens its kind of tab.

## Feature: Nothing is lost (R14)

### S43: The inventory
When the tester walks the inventory rows this sprint moves (R12's table; sign-in, setup, repair and recovery cards; "You are interacting with AI")
Then each works from its 2.0 home.

### S44: Skipped, then signing in later
Given the person skipped the welcome's step 1 and opened a project
Then the AI's sheet offers Sign in to ChatGPT, Sign in to Claude and Other ways to connect, and each works.

## Feature: Windows (R15)

### S45: The welcome on Windows
Given a Windows build from main (after the merge) or the test overlay on the latest one (before it), and a fresh profile
When the person goes through the welcome with ChatGPT, then again with Claude, with an existing folder, a new project and the sample project
Then each works, paths are in Windows' form (the sample in `Documents\Ritemark\Leadership programme`), the folder picker is Windows', every shortcut says Ctrl, and the window buttons stay at the top right.

### S46: The first seconds on Windows (#401)
Given a fresh Windows profile
When the person clicks Sign in as soon as the welcome draws
Then the click is not lost: the sign-in starts once the extension host answers, and the card shows Checking… or its progress meanwhile.

### S47: An update on Windows
Given a v1.14.0 profile made on Windows
Then S33–S35 hold there.
