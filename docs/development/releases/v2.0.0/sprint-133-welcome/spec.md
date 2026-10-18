# Sprint 133 Spec — The welcome

## Purpose

Ritemark 2.0's second step changes how Ritemark starts. A new window with no folder opens on one calm sheet that asks one question, "Which AI do you use?", then where the person's work is, and lands them on a project with their AI ready beside it. Someone updating from Ritemark 1 sees a shorter sheet once, already signed in, and goes straight back to their work. The usage-data choice is part of the sheet, and nothing is counted until the person says yes; for someone updating, an OK on Ritemark 1's notice is that yes. Four anonymous events tell whether people reach a project.

## Principles

- **The drawings are the contract.** Experience 2 (`ritemark-dev`: `product/design/experience/experiences/welcome/`) for a fresh start, experience 32 (`experiences/update/`) for updating from 1.x and the welcome's states. Where a drawing and this spec disagree, the drawing wins and this spec changes first (Jarmo, 17 October: match the Experience prototype exactly).
- **Two questions, in order, and nothing else.** The AI first, the folder second (experience 2, decision 1).
- **People's names for things.** ChatGPT and Claude, never Codex; no "authenticated", "runtime" or "workspace" in the main path (experience 2, decisions 2 and 4).
- **Nothing is counted before yes** (Jarmo, 17 October). Not the four events, not any other event, not on a dev run. For someone updating from 1.x, an OK on 1.x's usage-data notice is that yes (Jarmo, 18 October).
- **Nothing is lost** (HARD RULE #1). Everything the 1.x first window does — the Getting Started page, its launch check, the usage-data notice and the AI's setup wizard — keeps a home in 2.0.
- **A Ritemark page, not a patched VS Code page.** The welcome lives in the extension, so its words can change without a full app release.

## Requirements

### R1: The welcome is a Ritemark page

As someone opening Ritemark, I want one calm sheet that tells me what Ritemark is and asks me one thing at a time.

Acceptance criteria:
- A window with no folder opens the welcome, a Ritemark page in the shared React bundle (`webview/src`), built from the UI components. Once a profile has finished the welcome (a project has been opened from it, R6 and R10), a window with no folder shows a short sheet on the ground instead: "Where do you want to start?" with the recent projects, Open another folder… and Start a new project. It is experience 32's frame 1 without Your AI and usage data (the Experience lead, 18 October).
- The welcome is one raised sheet, 640 wide, centred on the flat ground, with the header illustration and the white Ritemark logo, a two-part progress bar on the header ("1 · Your AI", "2 · Set up project"), "Welcome to Ritemark" in Space Grotesk 40, and the North's one line (experience 2, frame 1).
- While the welcome is open, nothing else shows: the side columns are closed, and the desk's strip, sheet and the status bar are hidden, as drawn. On the Mac the traffic lights stay; on Windows the window buttons stay at the top right, with no menu button (the Experience lead, 18 October).
- VS Code's Getting Started page never opens: not at start, not from a menu, not from the command palette (R12).
- The welcome works with the mouse and the keyboard (Tab order follows reading order; Enter and Space press; Escape cancels a sign-in in progress), and VoiceOver and Narrator read its question, each card and each state.
- The welcome draws in Ritemark Light and Ritemark Dark. The header illustration is the one moment the brand's gradient appears (experience 2, decision 3).
- Text on the sheet meets 4.5:1.

### R2: Which AI do you use?

As someone new to Ritemark, I want to connect the AI I already pay for, by the name I know it by.

Acceptance criteria:
- Step 1 asks "Which AI do you use?" with three cards: ChatGPT, Claude and OpenCode (Jarmo, 15 October: OpenCode as the third option).
  - ChatGPT and Claude each say "Sign in with the account you already use." and offer a blue Sign in (Jarmo, 15 October: sign-in buttons are blue).
  - OpenCode says "Open models, with an API key of your own." and offers Set up.
- Under the cards: "You can use more than one.", an API keys link, and Skip for now.
- The API keys link opens a small sheet over the welcome, in experience 31's dialog style, with the Anthropic API key field that Ritemark Settings already has (`anthropic-api-key`). Done goes back to the welcome with Claude marked as set up; Settings stays the place to change it later. ChatGPT is reached only through its own sign-in: no OpenAI key is offered as a way to use ChatGPT (see *Resolved Questions*). The OpenAI key Settings already has for OpenCode and other services stays where it is, for what it does today.
- Skip for now goes to step 2 with no AI. Step 2 itself has no skip: a window needs a project, closing the window is the way out, and File ▸ Open still opens a loose file (the Experience lead, 18 October). Ritemark then works as an editor, and the AI's sheet offers the sign-ins (experience 13, frame 3, as Ritemark's AI sheet does today when nothing is connected).
- A provider that is already signed in shows "Signed in" on its card, and its card's button becomes Continue.
- Under a line: "Your documents stay on this computer. An AI reads only what you work on with it."

### R3: Signing in

As someone signing in, I want to know where to finish and how to get back if nothing happens.

Acceptance criteria:
- Sign in starts that provider's own sign-in, as Ritemark does today: for Claude, Claude Code's own browser sign-in (`agent/claudeLogin.ts`, `claude auth login --claudeai`), with its backup link; for ChatGPT, Codex's account sign-in (`codex/codexAuth.ts`, `account/login/start`). Nothing about either is re-implemented.
- While it runs, the card says where to finish ("Your browser opened Claude's sign-in page."), with a spinner, "Finish there" and Cancel, and under the cards "Did nothing open? Open the page again" (experience 2, frame 2). The other cards fade but stay usable.
- When the sign-in succeeds, the welcome moves to step 2 and says "Signed in to Claude" (or ChatGPT) above its question.
- When it fails or is cancelled, the card returns to Sign in and says in one sentence what happened and what to do, with no error codes.
- OpenCode's Set up opens a small sheet over the welcome, in experience 31's dialog style, with the fields Ritemark's OpenCode setup has today (its own API keys). Done goes back to the welcome with OpenCode marked as set up; when OpenCode is ready (a key set whose provider has models, as today), the welcome moves to step 2 as for the others.
- Where a step still needs a terminal (installing or repairing a runtime), it opens as a tab beside the welcome, never in the AI column (Sprint 132 R8), and the welcome learns when it finishes.
- Signing in to a second provider from step 2 is possible through Add another (R10) or later in Settings; the welcome never asks twice.

### R4: Each provider's state as it is known

As someone on the welcome, I want to see at once what is already set up, without waiting.

Acceptance criteria:
- On opening, the welcome checks each provider's sign-in in the background. Each card or row shows its state as its own check arrives: Checking… with a small spinner, then Signed in, Sign in (with the reason when a sign-in has ended: "Your sign-in has ended. Sign in again to use ChatGPT here."), or Not checked yet when offline (experience 32, frames 2–4).
- No check blocks anything. Step 2's choices and the project rows work while checks run.
- A check usually answers within 5 s, but a runtime's first start on a cold computer can take up to 15 s. A check that has not answered after 20 s shows Sign in with "Couldn't check. Try again." and a retry, not a spinner forever.
- Offline: one line at the top of Your AI says the person is offline and the sign-ins are checked when they are back; the projects open as usual.

### R5: Set up project

As someone who has an AI ready, I want to point Ritemark at my work, start something new, or try Ritemark on a sample first.

Acceptance criteria:
- Step 2 asks "Where is your work?" with three rows (experience 2, frame 3):
  - **Open a folder…** opens the system's folder picker.
  - **Start a new project** opens in place into a name field ("Project name") and Create. Under it, in muted ink: "In ~/Documents/Ritemark/<name>" (`Documents\Ritemark\<name>` on Windows), with Change… to pick another place. The person names it. The folder is created empty: About this project is not written at creation (the Experience lead, 18 October). Its file is decided (Jarmo, 18 October: `AGENTS.md`, with a `CLAUDE.md` that points to it), and the project's menu offers it in step 3 (Sprint 134); when else to offer it is still open in experience 24.
  - **Try the sample project**, "A small leadership programme, with documents to work on." (experience 2, frame 3; Jarmo, 18 October: Ritemark ships a sample project). It copies Ritemark's sample, a small leadership programme with a brief, modules, kickoff notes and a few tasks, into `~/Documents/Ritemark/Leadership programme` (`Documents\Ritemark\Leadership programme` on Windows), and the window lands on it (R6). The person works on their copy; Ritemark's own stays as shipped. A folder of that name that is already there is never written into: the copy takes the next free name ("Leadership programme 2"). The sample's content is real, written for it before step 2 is built.
- One line says what a project is: "A project is a folder on this computer. Claude works only inside it." (The AI's name follows the one signed in.)
- A name that would create an existing folder or an invalid path is refused in place, in words, before anything is written.
- Git and Node.js are needed only on Windows with this computer's own Claude (`systemRuntimeToolsRequired`, `agent/setup.ts`), so this line is rare. When one is missing, one line sits under "Signed in to Claude" at the top of step 2, in body ink with a warning-circle icon (the Experience lead, 18 October):
  - Git: "Claude from this computer needs Git, and Git isn't installed. Use Ritemark's own Claude instead, or install Git and restart Ritemark." with a quiet button, Use Ritemark's own Claude, which switches the runtime to Ritemark's own (`ritemark.agentRuntime.preference`);
  - Node.js: the same sentence with Node.js;
  - when a restart is needed: "Restart Ritemark to finish setting up Claude." with Restart.
  No download or install link (patch 016, Microsoft Store policy 10.1.5). Nothing else from the launch check shows when nothing is missing.

### R6: Landing on the project

As someone who has picked a folder, I want to land on my project, with my AI ready beside it.

Acceptance criteria:
- Choosing a folder or creating a project opens it in the same window. The window reloads, as VS Code always does when the folder changes.
- After the reload the window shows the project:
  - Documents in the left column, with the project's name in its head (Sprint 132 R10);
  - the AI's sheet open on a new chat with the AI the person signed in with, its message box reading "Ask Claude about this project";
  - the desk empty, offering the + menu's three as tiles: Text, Table and Web page (experience 2, decision 6: an empty desk offers the same three as the +). Every empty desk offers them, not only the landing's.
- The landing happens once for the folder the welcome sent the person to. Opening any other folder later does not repeat it, and a landing older than 10 minutes is dropped.
- If the folder is gone after the reload, the window says so and shows the welcome's step 2 again.
- In step 3 (Sprint 134) the landing also opens Home first. This sprint does not open Home.

### R7: Usage data on the welcome

As someone starting Ritemark, I want to choose about usage data myself, and know nothing is counted before I say yes.

Acceptance criteria:
- Step 2 ends with a switch: "Share anonymous usage data to improve Ritemark" / "Off until you turn it on. Never your documents, chats or names." It is off when the welcome opens (experience 2, frame 3). The update welcome's switch shows the person's 1.x answer instead (the last criterion here; R10).
- **Nothing is sent to PostHog until the switch is turned on**, from any part of Ritemark: not the welcome's events, not the existing events, not on a dev run. Turning it off stops sending at once.
- Leaving the welcome without turning it on is a no. The welcome never asks again; the choice stays in Settings.
- The 1.x usage-data notice (the toast with OK, Opt Out, Privacy Policy and Terms of Use) no longer shows. Its Privacy Policy and Terms of Use links stay reachable: beside the switch on the welcome, and in Settings.
- Ritemark Settings gains the same choice with the same words (it has none today; the only switch is VS Code's `ritemark.analytics.enabled`), and changing it there takes effect at once.
- Someone updating from 1.x keeps the answer they gave to 1.x's notice (Jarmo, 18 October, refining the 17 October rule; experience 32, frame 1, redrawn to match):
  - an OK carries over as a yes. The update welcome's switch is on, with "On, as you chose in Ritemark 1. Never your documents, chats or names.", and they can turn it off there;
  - Opt Out, or no answer, is off, with "Off until you turn it on. Never your documents, chats or names."
  1.x's OK wrote no yes, only that the notice was closed, and it wrote the same when the notice was closed in other ways. So any notice closed without Opt Out counts as the OK (Jarmo, 18 October; technical plan, W1).

### R8: Four events

As the people building Ritemark, we want to know whether people reach a project, without learning anything about them.

Acceptance criteria:
- Four events, anonymous, through Ritemark's PostHog (`src/analytics/posthog.ts`):

  | Event | When | Properties |
  |---|---|---|
  | `welcome_shown` | The welcome opens | `kind`: `fresh` or `update` |
  | `ai_signed_in` | A provider becomes ready from the welcome | `provider`: `claude`, `chatgpt` or `opencode`; `method`: `account` or `api_key` |
  | `project_opened` | The welcome's landing opens a project | `source`: `existing_folder`, `new_project`, `recent` or `sample`; `has_ai`: true or false |
  | `first_message_sent` | The first message of this profile is sent | `provider` |

- No event carries a path, a folder or project name, a file name, a message, or an account or e-mail.
- Every event carries the build channel (R9) and the existing shared properties.
- **The welcome's events are held in memory until the person answers.** A yes sends them; a no, or quitting without an answer, drops them. Nothing is written to disk before the answer (Jarmo, 18 October; *Open Questions* 1). On an update welcome whose switch is on from 1.x, the answer is already yes, so they are sent as they happen.
- `first_message_sent` is sent once per profile, and only if the switch is on when the message is sent.
- Each event reaches PostHog once, verified in PostHog's live events, and none appears before an answer or after a no.

### R9: Dev and test runs are marked (#338)

As the people reading the numbers, we want dev and automated runs out of them.

Acceptance criteria:
- Every event carries `build_channel`: `prod` for an installed app, `dev` for a run from source (an unfloored version, or the extension running in development mode).
- The automation skills' throwaway profiles never send anything: they never turn the switch on, and the 2.0 default is off.
- PostHog's internal-user filter can be one rule (`build_channel = dev`); the release plan's analytics row records it.

### R10: Updating from 1.x: the welcome once

As someone updating from Ritemark 1, I want to see what is true, confirm it and get back to my work in one click.

Acceptance criteria:
- On the first start of this build for a profile that used Ritemark 1, the update welcome shows once (experience 32, frame 1), whether or not the window restored a folder:
  - one sheet, no progress bar, a header 120 high, "Welcome to Ritemark 2.0", one sentence;
  - Your AI: one row for each AI the profile was signed in to, with its state (R4), and Add another, which offers step 1's choices;
  - Where do you want to start?: up to three recent folders, the one open when the person last quit first with "Open when you left", the others with when they were last open, each a 56 row with the project's mark;
  - Open another folder… and Start a new project under the list;
  - the usage-data switch at the foot: on, with "On, as you chose in Ritemark 1.", for someone who pressed OK on 1.x's notice; off, with "Off until you turn it on.", for anyone else (R7).
- A project row opens its project. The project open when they left closes the sheet and restores the window as it was, without a reload; any other reloads into it (R6).
- After a project is picked the update welcome never shows again on this profile; a later window with no folder shows the short "Where do you want to start?" sheet, as for any finished profile (R1).
- A fresh profile never sees the update welcome.
- What moved, the card on Home that says where the terminal, Copilot Chat and Settings went, arrives with Home in step 3 (Sprint 134).

### R11: A first window opened with a file or folder (#429)

As someone whose first launch opens a document, I want that document, once.

Acceptance criteria:
- When a fresh profile's first window opens with a folder or a file (a `.md` double-clicked in Finder, a folder given on the command line), the folder or file opens as asked and the welcome does not cover it. The AI's sheet offers the sign-ins. Nothing is counted. The welcome shows the next time a window has no folder, until it has been finished once, that is, until a project has been opened from it (the Experience lead, 18 October).
- The same file never opens twice. In particular, the one-time stuck-tab healer (Sprint 107 R3) replaces a plain-text tab with the Ritemark editor instead of opening a second one beside it.
- The issue's deterministic reproduction (a fresh profile with `"workbench.editorAssociations": {"*.md": "default"}`, launched with `<folder> <folder>/note.md`) ends with one tab, and 25 fresh launches with a `.md` end with one tab each.

### R12: The Getting Started page retires, and its launch check keeps a place

As someone who used Ritemark 1's first page, I want what it told me to still be somewhere.

Acceptance criteria:
- VS Code's Getting Started page (patch 001's Ritemark version, with the hero, recent files and the launch check) never opens. Every way in (start-up, Help, the command palette, a walkthrough command) opens Ritemark's welcome instead, or is gone.
- What the page did keeps a home:

  | 1.x Getting Started | 2.0 |
  |---|---|
  | New document, with New table and New flow on its chevron | The + (Text, Table) and the head's New (Text, Table, Flow), Sprint 132 |
  | Open folder | The welcome's step 2; the head's Open a folder… (Sprint 132) |
  | Recent files and folders | The update welcome's projects (R10); Switch project… (Sprint 132); the project list (Sprint 134) |
  | Launch check: ChatGPT and Claude signed in, "Click here to log in" | The welcome's provider states and Sign in (R2–R4); Settings' sign-in cards |
  | Launch check: Git found, Node found (only when needed) | A line at the top of step 2 when one is missing, with Use Ritemark's own Claude (R5); rows in Ritemark Settings under the runtime choice, shown for this computer's runtime (new) |
  | Links: Getting started, Support articles, Blog | Help, under You (Sprint 132 R11), which opens ritemark.app's support pages |
  | The logo and tagline | The welcome's header (R1) |

- Patch 001's, 016's and 017's Getting Started hunks are removed, and the files they touched go back to upstream wherever nothing else in them is Ritemark's. Patch 016's Store rule still holds: no download link for Git or Node.js on any Ritemark surface.

### R13: A file's extension in muted ink

As a writer, I want names to read first and extensions to step back.

Acceptance criteria:
- In the document tree and on tabs, a file's extension is drawn in the theme's muted ink, and its name in the body ink. On the chosen tab and the open row both are the body ink (the Experience lead's review of Sprint 132, 17 October).
- Names with no extension, names starting with a dot, and names with several dots (`report.final.md`: only `.md` is muted) are drawn correctly.
- Search results, quick picks and the tab's tooltip are unchanged.
- It holds in Light, Dark and high contrast; in high contrast the extension keeps 4.5:1.

### R14: Nothing the 1.x first window did is lost

As someone who used Ritemark 1.14, I want every function of its first window to still be there.

Acceptance criteria:
- Every row of the before-and-after inventory (`comparison/README.md`) that this sprint moves works from its 2.0 home: "Sign-in, setup, repair, recovery cards, offline and compatibility notices" (first launch; Settings; the conversation), "You are interacting with AI" (the first-use note and the line under the message box), and the rows in R12's table.
- The AI sheet's sign-in, setup, repair and recovery cards still work in a project window, for a person who skipped the welcome.

### R15: The welcome on Windows

As a writer on Windows, I want the same welcome, with Windows' words.

Acceptance criteria:
- The welcome, both sign-ins, OpenCode's setup, Open a folder…, Start a new project and the landing work on a Windows PC with a build from main.
- Paths show Windows' form; shortcuts say Ctrl; the folder picker is Windows'.
- The welcome stays responsive during the extension host's first seconds on a fresh Windows profile ([#401](https://github.com/ProductoryHQ/ritemark-native/issues/401)): it draws at once, its checks show Checking… until they answer, and a click on Sign in is never lost. *Open Questions* 2 records the decision on #401 itself.

## Engineering requirements

### E1: One consent gate

- Every send to PostHog passes one function that reads the person's answer. No caller sends around it.
- `ritemark.analytics.enabled` defaults to off. The kill-switch flag `analytics` stays as it is (a flag that turns analytics off, never on).
- Unit tests prove: no send before an answer; none after a no; the held welcome events sent once after a yes and dropped after a no; `build_channel` on every event; a 1.x OK carried over as a yes, and a 1.x Opt Out or no answer off.

### E2: The welcome's host side is small and testable

- The welcome's state (which kind, which step, the pending landing) is a pure module with no `vscode` import, unit tested.
- The welcome reuses the existing sign-in, setup and health code through their current entry points; no second copy of a provider check.
- New webview ↔ host messages are typed in one protocol file, as the task board's are.

### E3: Tests

- Extension unit tests for the welcome's state, the landing, the update detection, the consent gate and the events, and for the healer's replacement (#429).
- A VS Code unit test for the resource label's muted extension (R13), if the patch adds logic beyond CSS.
- CDP checks on a dev instance: the welcome alone (nothing else drawn), the sheet's size and place, the landing, the empty desk's tiles.
- The screenshot baseline of Sprint 132 gains the welcome's frames, light and dark.

### E4: The bundle ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107))

- `media/webview.js` is measured before and after. The header illustration is a separate image file served to the webview (not inlined into the bundle), sized for a 640 sheet at 2×.

### E5: Builds and Windows

- Merging into main is followed by a production build from a clean-room worktree at the merged commit (a build check, not a release) and a Windows build from main.
- Before the merge, the extension side is tried on Windows through the test overlay on the latest Windows build from main.
- All patches apply on the pinned VS Code, and a second `apply-patches.sh` run is clean. The stacking check (pre-commit Check 14) passes.

### E6: Docs

- `architecture.md`: the welcome and the consent gate as a subsystem note; the version-history row.
- `CLAUDE.md`'s patch table where 001, 016 and 017 change.
- `references/layout-invariants.md`: the welcome alone, if the frame gains that rule.
- A note to the Development manager when the privacy policy on ritemark.app needs a line for `build_channel` or for the opt-in (cross-repo; not changed here).

### E7: Drift is measured

- At the merge, the whole stack is dry-applied on the newest VS Code release (`scripts/check-vscode-drift.sh`), and the release plan's risk register records the failing files.

## Non-Requirements

- **Home, the project file and list, switching projects, and the What moved card** (step 3, Sprint 134).
- **A ChatGPT (OpenAI) API key** anywhere in 2.0.
- **About this project**, whether written by Claude on the first look at a folder or created with a new project (experience 24). Its file is decided (Jarmo, 18 October) and the project's menu offers it in Sprint 134; when else to offer it is still open in experience 24.
- **The Settings redesign** (experiences/settings). Settings keeps its 1.x page; this sprint adds the usage-data choice and the launch check's rows to it.
- **A tour, a video or a changelog** in the welcome (experience 32, "Not on it").
- **A VS Code update.** The pin stays at 1.117.0.

## Resolved Questions

- **2026-10-15 (Jarmo):** OpenCode is the third choice on step 1; the welcome uses the header illustration from 1.x's Welcome tab; sign-in buttons are blue; the steps are a two-part progress bar on the header; "2 · Set up project".
- **2026-10-17 (Jarmo):** the usage-data choice is on the welcome, and nothing is counted until yes; people updating from 1.x see the welcome once; the Home tab comes in step 3 ("ok").
- **2026-10-17 (release plan, engineering):** the welcome is a Ritemark page rather than the Getting Started page rewritten again; opening the folder reloads the window, and the welcome writes where it is going.
- **2026-10-18 (the Experience lead's answers to this plan's design questions):** the welcome alone shows only the sheet on the ground (on Windows the caption buttons, no menu button); a first window opened with a file opens it, shows "No AI yet" and counts nothing, and the welcome waits until a project has been opened from it; step 2 has no skip; a finished profile's window with no folder gets the short "Where do you want to start?" sheet; the missing Git or Node line's place, words and Use Ritemark's own Claude, and its Settings rows under the runtime choice; the landing's empty desk offers Text, Table and Web page as tiles while Home does not exist yet; OpenCode's Set up and API keys open a small sheet over the welcome; Start a new project is a name field with Create and a Change… for the place; About this project stays out of step 2.
- **2026-10-18 (Jarmo, via the Experience lead's question form):**
  - **About this project** is one file, `AGENTS.md`, which both Claude and Codex read, with a `CLAUDE.md` that only points to it, shown everywhere as "About this project". The project's menu item that opens it or offers to create it is built in Sprint 134; a new project here still starts empty (R5).
  - **The sample project:** yes. Ritemark ships one, and step 2 offers "Try the sample project" (R5). Its content is written before step 2 is built; the Experience lead offered to draft it.
- **2026-10-18 (the sample project's content):** written by the Experience lead and approved by Jarmo the same day ("files look good!"). It is `ritemark-dev` 70701c1, `product/design/experience/sample-project/Leadership programme`, copied as it is into `extensions/ritemark/sample-project/`. Its README lists what each file sets up. The four cards' `created` and `updated` are placeholders (2026-01-01), which the copy sets to the time of copying (R5).
  - **Usage data for people updating from 1.x:** an OK on 1.x's notice carries over as a yes. They see the switch on, with "On, as you chose in Ritemark 1. Never your documents, chats or names.", and can turn it off there. Anyone who opted out or never answered sees it off, with "Off until you turn it on." This refines the 17 October rule (R7, R10). Experience 32's frame 1 was redrawn to match (`ritemark-dev` a82c852).
- **No ChatGPT API key in 2.0.** Recommended in the release plan ("leave it out of 2.0 and add it if people ask") and listed as decided in the Development manager's brief of 18 October; the release plan still lists it as open, so this plan's approval confirms it. It means ChatGPT is reached only through its sign-in. The OpenAI key that Settings already holds (`openai-api-key`, used by OpenCode and other services) is not a ChatGPT key and stays (HARD RULE #1).

## Open Questions

Both are decided: Jarmo accepted both recommendations with the plan's approval (18 October, "approved with your proposals").

1. **The welcome's events before the yes: decided, hold and send.** `welcome_shown` and `ai_signed_in` are held in memory, sent at the yes, and dropped otherwise. Without it no fresh start is ever counted (the switch is on step 2, after both), and nothing leaves the computer or is written before the yes.
2. **[#401](https://github.com/ProductoryHQ/ritemark-native/issues/401), the Windows extension host's first 8 seconds.** The release plan left it to this plan. **Decided: include it as an audit first** (a CPU profile of the extension host on a fresh Windows profile, then the same on the Mac) and fix it in this sprint when the cause is Ritemark's own start-up code. If the cause is outside Ritemark (for example the first scan of the bundled binaries), record it in the issue and keep R15's guarantee. The case to profile is the first start after a clean install or an update, with Defender on. The logs on Jarmo's Windows PC (18 October) show first starts taking 32–54 s to be fully up, the extension host starting 14–18 s late with three or four "unresponsive" periods, and later starts about 7 s; a fresh profile alone does not reproduce it.

The technical point on recognising a 1.x OK is decided (Jarmo, 18 October): a notice closed without Opt Out counts as the OK (technical plan, W1).

The design questions sent to the Experience lead on 18 October were all answered the same day (*Resolved Questions*). Jarmo's answers of the same day, through the Experience lead's question form, settled the sample project, the 1.x OK and About this project's file. The sample project's content was written and approved the same day.
