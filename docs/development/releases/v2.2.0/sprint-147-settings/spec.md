# Sprint 147 Spec: The new Settings

## Purpose

Today's Settings is one long page in the machinery's words ("Agent Runtime", "Bundled", "Debug Trace Logging"). This sprint moves today's settings, and only today's, into the sections of the Experience lead's experience 15, in plain words, built from the shared controls Sprint 146 gave their states. It also adds a read-only list of what each AI can use (#415), makes an open Settings tab follow changes made elsewhere (#460), moves the page's hand-rolled buttons onto the shared Button (#577), and makes the page draw at once on Windows, where it takes about 13 s today (#593).

The drawing: ritemark-dev `product/design/experience/experiences/settings/` (README, frames 2–9, `settings.html`). Its 2.2 version is today's settings in seven sections, with no new ones (Jarmo, 29 October: "ei neid uusi seadeid pole vaja").

## Principles

- **Nothing is lost.** Every setting, action, status line and way in that Settings has today keeps a place and still works (`CLAUDE.md`, hard rule 1). In v1.3.0 a Settings rewrite broke API-key entry and with it every AI feature. R1's inventory is the contract, and its test fails when a row goes.
- **No new settings.** The rows the first drawing added and the build doesn't have aren't built ("Later, not in 2.2" in the drawing's README). A part another sprint owns appears with that sprint, never as a placeholder (hard rule 1 forbids "coming soon").
- **The same storage, the same messages.** No setting key, secret name or stored value changes shape. The page keeps sending the messages it sends today. The host's handling of keys and sign-in changes in one PR only (PR 3, High).
- **The control, not the screen.** The page is built from `webview/src/components/ui/`. A control it needs and the folder lacks is added there, with its row in Sprint 146's catalogue and its images approved (`REVIEW.md`, its two rules on shared controls).
- **Words say only what the code does.** The lead's words, checked against the behaviour (`REVIEW.md`: "Docs, notes or comments that say something the code doesn't do").
- **Draw first, then fill in.** What needs no probe shows at once; what a probe answers fills in.
- **Fails first.** Each requirement's check fails on `main` at the branch's start, or the plan says why it can't (E1).

## Requirements

### R1: Every setting keeps a place and still works

As someone who set Ritemark up, I want every setting I used to find where it went, and to work as before.

Acceptance criteria:
- **The inventory below is complete** for the code at the branch's start (A4 checks it against the code and adds any row it misses before the page changes; the drawing's own list, of 29 October, missed Sprint 145's `openai-api-key` link).
- **Every row has its new place in the build and its check run.** The result of each row goes in `qa-evidence.md`.
- **The inventory test** (`settingsInventory.test.ts`, W1) holds the list of every message type the host takes from the page (28 today, and Google Docs' five) and every `ritemark.*` key the page writes. It fails when the Settings components no longer send one of them, and when the host's `handleMessage` drops one. It is written first, so it runs against today's page before the new one exists.
- **Opening Settings writes nothing.** A stored value the new control doesn't offer as a step (a chat size of 16, a timeout of 22) shows as it is and is never rewritten by opening or reading the page.
- **The existing flags keep gating the same rows:** `codex-integration` (ChatGPT's row and its two Advanced rows), `opencode-integration` (OpenCode's row, its Advanced row, the OpenRouter key), `transcription-workbench` (the ElevenLabs key, transcripts' working files), `google-docs-publishing` (Sharing's Google Docs group).

How a row is checked:
- **T**: the inventory test.
- **R**: a render test of that state from a recorded payload, for states a test machine can't reach safely (a broken install, a signed-in account, an update on offer).
- **D**: on a hidden dev instance on the Mac, with CDP input; the control changes the setting or the action runs. Sign-in rows start and cancel; nothing signs the person's own accounts out.
- **K**: the key round trip: Add, Test, used for what it's for (a Flow step, OpenCode or Transcribe), Change, Remove; Claude, ChatGPT and OpenCode still answer in a chat afterwards.
- **L**: a way in: the opener lands on the new place.
- **W**: also on Windows, through the test overlay.

#### The inventory

Read from `RitemarkSettings.tsx`, `GoogleDocsSettingsCard.tsx`, `AdvancedSettingsLink.tsx` and `RitemarkSettingsProvider.ts` at `e86cbb0c` (1 November 2026). Section numbers in the new place are the drawing's frames: 2 AI accounts, 3 Advanced, 4 Appearance, 5 Sharing, 6 Usage data, 7 Updates, 8 an AI's Details sheet, 9 the API keys sheet.

| # | Setting, action or line today | Today's place | New place | How it's checked |
|---|---|---|---|---|
| I1 | Theme: Ritemark Light, Ritemark Dark (`workbench.colorTheme`; a pick turns off `window.autoDetectColorScheme`) | Appearance | 4, Light and Dark as pictures of the window | T; D: each pick changes the window, a theme changed from the palette moves the chosen picture; W |
| I2 | Chat font size, 10–20 px, a slider with a preview line (`ritemark.chat.fontSize`) | Chat Appearance | 4, Text size in chats in three steps; the exact size in All settings; the chat beside shows the size, so the preview line goes | T; D: each step writes its size and the chat follows; a size set in All settings shows as no step chosen, with its size in words, and isn't rewritten |
| I3 | Runtime preference: bundled or system install (`ritemark.agentRuntime.preference`) | Agent Runtime | 3, Where the AI runs from: Ritemark's own or This computer's | T; D: each choice, and Claude's and ChatGPT's source follow; W |
| I4 | Currently active: Claude's and ChatGPT's source | Agent Runtime | 3, the "Now:" line under Where the AI runs from | D |
| I5 | This computer's tools: Git always, Node.js with this computer's runtime | Agent Runtime | 3, the same line ("This computer has Git 2.47") | D; W on a PC without Git |
| I6 | The fallback line (this computer's chosen, Ritemark's used) | Agent Runtime | 3, under Where the AI runs from | D: this computer's chosen with no system install |
| I7 | Claude's state (Connected) | Claude Account | 2, Claude's row: Ready | D |
| I8 | Install Claude (not installed) | Claude Account; Component readiness | 2, Claude's row and its 8; 3, Ritemark's parts | T; R |
| I9 | Repair Claude; Reload window (broken, or waiting for a reload) | Claude Account; Component readiness | 8, Repair Claude, and Reload in that state; 3, Repair… | T; R |
| I10 | Sign in with Claude.ai | Claude Account; Component readiness | 2, Claude's row: Sign in | T; D: the sign-in starts, Cancel ends it |
| I11 | Use an Anthropic API key (the host's prompt) | Claude Account | 8, Use an API key instead (the same prompt) | T; D |
| I12 | Where to get an Anthropic key (console link) | Claude Account | 9, Get a key, at Anthropic | D |
| I13 | Cancel sign-in | Claude Account | 2, Claude's row while signing in | T; D |
| I14 | Auth method, CLI version, billing source | Claude Account | 8, Signed in (how, who is billed); Version | R; D |
| I15 | Sign out (Claude.ai sign-in) | Claude Account | 8, Sign out | T; R; D only in a scratch home with a test sign-in |
| I16 | Switch to Claude.ai sign-in (an API key in use) | Claude Account | 8, Use Claude.ai sign-in | T; R |
| I17 | Refresh status | Claude Account; Component readiness | 8, Check again; 3, Ritemark's parts: Check | T; D |
| I18 | Technical details: the binary's path, diagnostics | Claude Account | 8, Technical details, folded | R |
| I19 | Used for, Learn more | Claude Account | 8, Used for, Learn more | D |
| I20 | ChatGPT's state (Connected) | ChatGPT Account | 2, ChatGPT's row: Ready | D |
| I21 | Signed out: the plan line ("Any plan works, free included") | ChatGPT Account | 2, ChatGPT's row's line | R |
| I22 | Sign in with ChatGPT; Opening browser…; Cancel sign-in | ChatGPT Account; Component readiness ("Sign in with OpenAI") | 2, ChatGPT's row: Sign in, and Cancel while signing in | T; D |
| I23 | A sign-in error | ChatGPT Account | 2, under ChatGPT's line | R |
| I24 | Missing or broken: the repair command (a system install), Repair ChatGPT, Reload Window, Refresh Status, diagnostics | ChatGPT Account; Component readiness | 8, its state and actions; 3, Repair… | T; R |
| I25 | E-mail, plan, API credits | ChatGPT Account | 8 | R; D |
| I26 | Sign out | ChatGPT Account | 8, Sign out | T; R |
| I27 | Used for, Learn more | ChatGPT Account | 8 | D |
| I28 | Approval policy, four choices (`ritemark.codex.approvalPolicy`) | ChatGPT Account | 3, ChatGPT asks before | T; D: each choice written; W |
| I29 | Sandbox mode, three choices (`ritemark.codex.sandboxMode`) | ChatGPT Account | 3, Where ChatGPT may write | T; D |
| I30 | OpenCode's plan line | OpenCode | 2, OpenCode's row, with Set up | R; D |
| I31 | Auto-approve edits and tool calls (`ritemark.opencode.autoApprove`) | OpenCode | 3, OpenCode changes files without asking | T; D |
| I32 | OpenAI key: field, show while typing, Save, Test and its answer, Used for, Get API key | API Keys | 9, OpenAI | T; K; W |
| I33 | Google AI key, the same | API Keys | 9, Google AI | T; K; W |
| I34 | Anthropic key, the same; it also tells Claude a key is there | API Keys | 9, Anthropic | T; K, and Claude's row says it uses the key; W |
| I35 | OpenRouter key, the same | API Keys | 9, OpenRouter | T; K |
| I36 | ElevenLabs key, the same | API Keys | 9, ElevenLabs | T; K |
| I37 | Removing a key (Save with the field empty: "API key removed") | API Keys | 9, **not drawn**: the lead's question 2 | T; K |
| I38 | Reading a saved key back (the eye on a filled field) | API Keys | **Goes, only with Jarmo's word** (decision 2): 9 says Saved, never the key; the eye stays for a key being typed | R |
| I39 | Your Google account: Connect, Cancel while the browser is open, Disconnect, the account | Google Docs | 5, Your Google account | T; D: Connect starts and Cancel ends it; Disconnect only on a test account |
| I40 | Template for new Google Docs: Choose, Change, Clear | Google Docs | 5, Template for new Google Docs | T; R; D where a test account is signed in |
| I41 | Inactivity timeout, 5–60 minutes, a slider (`ritemark.ai.agentTimeout`) | Agent Timeout | 3, When the AI goes quiet: a Select of steps, plus the stored value when it isn't one | T; D: a stored 22 shows as 22 minutes and isn't rewritten; the words name the AIs it stops (A4) |
| I42 | Debug trace logging, with "reload after changing" (`ritemark.ai.debugTrace`) | Agent Timeout | 3, Keep a detailed log, its line saying a reload starts it | T; D |
| I43 | Share anonymous usage data, with its words ("On, as you chose in Ritemark 1" included) | Usage data | 6 | T; D: the switch; the welcome's switch moves it while Settings is open |
| I44 | Privacy Policy, Terms of Use | Usage data | 6, as links | T; D |
| I45 | Check for updates on startup (`ritemark.updates.enabled`) | Updates | 7, Check for updates when Ritemark starts | T; D |
| I46 | The state badge (up to date, checking, available, error) | Updates | 7, the lede | R |
| I47 | Check Now | Updates | 7, Check now | T; D |
| I48 | Last successful check, last failed check | Updates | 7, Check now's line | R |
| I49 | Skipped version | Updates | **not drawn**: the lead's question 3 | R |
| I50 | Notifications paused until; Re-enable Notifications | Updates | **not drawn**: the lead's question 3 | T; R |
| I51 | Update source (the release feed, the legacy fallback, none) | Updates | 7, the version line ("from Ritemark's release feed") | R |
| I52 | Restart required, with Reload Window | Updates | 7, a state of the update card | T; R |
| I53 | An update on offer: its kind, version and summary; Install or Download Installer; Skip This Version; Pause 7 Days | Updates | 7, the card: Install update or Download the installer; Skip this version; Remind me in 7 days | T; R for each kind; D when a feed offers one |
| I54 | Up to date, blocked and error lines | Updates | 7, the card's states | R |
| I55 | The app's and the extension's versions (2.1's suffix rule, `versionLabel.ts`) | Updates | 7, Version | `versionLabel.test.ts`; D |
| I56 | Voice model: installed or missing, its name and size, managed by Ritemark | Component readiness | 3, Ritemark's parts: in its line, and in Repair… | R; D |
| I57 | Claude's and ChatGPT's readiness: state, versions (the SDK's too), errors, diagnostics, their actions | Component readiness | 3, Ritemark's parts: Check and Repair… | T; R |
| I58 | Transcription data: its size, Clear | Component readiness | 3, Transcripts' working files | T; D |
| I59 | AI information | the foot | 2, at the foot | T; D |
| I60 | Advanced settings (VS Code's settings page) | the foot | 3, More tools: All settings | T; `advancedSettings.test.ts`; D |
| I61 | Settings opened at a section: `google-docs`, `transcription`, `usage-data`, `google-ai-key`, `openai-api-key` | the editor's Share, Transcribe's gear, a Google image Flow step, an OpenAI Flow step (no opener in the build passes `usage-data` today; the name stays) | 5; 3 at transcripts' working files; 6; 9 at Google AI; 9 at OpenAI | L for each opener; the mapping's unit test for all five |
| I62 | Settings opened with no section: ⌘, and Ctrl+,, You ▸ Settings, the AI's sheet, the editor's sign-in recovery, the welcome, Home's guidance, the Task board, Transcribe, Claude's installer | each opener | 2, AI accounts (the first section) | L; D |
| I63 | A Settings tab restored after a reload | the window | The same tab, at AI accounts | D |
| I64 | The page follows the theme, usage data, Claude's and ChatGPT's status events, and Google Docs' account, as they change elsewhere | live | The same, and R11's | D: A2's table |

Not on today's page, and not moved: the settings that live only in All settings (the feature switches, update mode and channel, excluded folders, Transcribe's export folder, the chosen model and AI), which All settings in Advanced still reaches; and dictation's language, More languages and its Settings… sheet, at the microphone (the drawing's decision 8).

**The count:** 64 rows: 17 settings that hold a value (I1, I2, I3, I28, I29, I31, the five keys I32–I36, I39, I40, I41, I42, I43, I45), and the actions, status lines and ways in around them. **Without a drawn place:** removing a key (I37), a skipped version and paused update reminders with their Resume (I49, I50), and Repair…'s contents (I9, I24, I56, I57: placed in words, the sheet not drawn). **Going, only with Jarmo's word:** reading a saved key back (I38). **Changed but kept:** the chat's exact size moves to All settings (I2, as the drawing says).

### R2: Settings is a tab of sections

As someone who opens Settings, I want a short list of plain sections and one section at a time.

Acceptance criteria:
- **Settings opens as a tab on the desk**, named Settings, with its sections in a list on its left, in the drawing's order: AI accounts, Appearance, Sharing, Usage data, Updates, Advanced. **AI on this computer** joins the list, second, when Sprint 151 ships it; it isn't drawn before (decision 1).
- **The list is the shared Tabs, vertical** (keyboard arrows move between sections), with the chosen section on the indigo-soft fill.
- **Each section has its heading and its one-line lede**, the lead's words, and rows of name, one line and its control.
- **The ways in keep their names and land on the new places** (I61, I62): the page maps today's five section names, so no opener changes.
- **It fits the desk at any width**: nothing is cut and nothing scrolls sideways; at a narrow desk the list takes the lead's form (question 8).
- **Light and Dark**, as the kit renders them.

### R3: AI accounts

As someone choosing an AI, I want each one by name with its state and the one thing to do next.

Acceptance criteria:
- **Three rows, Claude, ChatGPT and OpenCode** (OpenCode only with `opencode-integration`), each with its state and action: Ready with Details…, Sign in, Set up, Cancel while signing in, and the not-installed and broken states (question 9). ChatGPT signed out reads "Not signed in. Any plan works, free included." ChatGPT, never Codex, in every visible word.
- **Details… opens the AI's sheet** (frame 8), on `ui/dialog.tsx`: how it's signed in and who is billed, Use an API key instead or Use Claude.ai sign-in, its version with Check again, Used for with Learn more, Technical details folded (where it runs from, what Ritemark found, diagnostics), Sign out, Repair. ChatGPT's sheet has its e-mail, plan and credits.
- **Other ways to connect: API keys, with Open…** (frame 9): the five services, each with what its key is for, Saved · it works (after Test) or Not added, Test and Change, or Get a key and Add. A key can be removed (I37). Keys stay on this computer.
- **AI information at the foot.**
- **The same messages as today** for every action (`claude:*`, `codex:*`, `setApiKey`, `testApiKey`). The key round trip (K) passes for all five keys, on the Mac and on Windows.

### R4: Appearance

- Light and Dark as small pictures of the window (frame 4), the chosen one on the indigo-soft fill, drawn in the bundle (no image files, so nothing here needs a shell release to change later).
- Text size in chats in three steps (I2), the lead's sizes (question 4).
- The line "Movement follows this computer's Reduce motion setting."

### R5: Sharing

- Google Docs: Your Google account and Template for new Google Docs (frame 5), today's card in the new rows, with every state it has today.
- "PDF and Word copies need nothing set: Share makes them on this computer."
- **Web pages joins with Sprint 149**, which owns publishing; 147 draws no row for it.

### R6: Usage data

- The one switch, with today's words, and Privacy policy and Terms of use as links (frame 6).

### R7: Updates

- The version and the last check in the lede; one card for an update on offer, ready to reload, blocked or failed (frame 7); Check for updates when Ritemark starts; Check now with the last good and failed checks; the version line.
- "Pause 7 Days" reads Remind me in 7 days; what it does doesn't change.
- A skipped version and paused reminders keep a place, with Resume (I49, I50; question 3).

### R8: Advanced

- Opens with "Nothing in this section is needed to write with Ritemark." (frame 3).
- Where the AI runs from; When the AI goes quiet; What the AIs may do alone (ChatGPT asks before, Where ChatGPT may write, OpenCode changes files without asking); When something isn't right (Ritemark's parts with Check and Repair…, Keep a detailed log, Transcripts' working files); More tools: All settings, and the drawing's other links as the lead answers (question 7).
- Each row's words say what it does: the timeout names the AIs it stops (A4), the log says a reload starts it.

### R9: The shared Button, with a tooltip (#577)

- Every button on the Settings page is the shared `ui/button.tsx`, with a `Tooltip` that says what it does, or why it's disabled. The links (Privacy policy, Terms of use, Learn more, AI information) are its link variant and open through the host's `openExternal`, not a bare `<a href>`.
- The Flow step panel's two (`NodeConfigPanel.tsx`, #577's list) too, looking as before at rest.
- No native `<select>` or hand-rolled `<button>` is left on the page; choices use `ui/select.tsx` or the new shared segmented control.
- Anything clickable gets `cursor: pointer` from the global rule in `index.css`; a new clickable kind joins that rule, never a class of its own.

### R10: Settings draws at once, then fills in (#593)

As someone on Windows, I want Settings to show at once, as on the Mac.

Acceptance criteria:
- **A1 measures first** where the 13 s goes, on the Windows PC and on the Mac; this requirement's target and shape follow it, and this file changes first if A1 says otherwise.
- **The page draws what needs no probe at once**: every section's choices, switches and sizes, which keys are saved, Google Docs, usage data and the versions. Each AI's state, Ritemark's parts, the tools line and the update check fill in as each answers, each showing "Checking…" until then.
- **One open runs each probe once.** Changing one setting, or the theme, doesn't run the probes again; only that setting's own state is sent.
- **Target:** on the Windows PC, at a normal start, the settings that need no probe show within 300 ms of the page's script having loaded, and the slowest probe fills in within its own time (A1's runs, the same method before and after). If the script's own load is most of the 13 s, A1 says so, and the shared bundle's split (GH #107) is named for later, not done here.
- **One log line per open**, with no words, names or paths: `settings: drawn <ms>, filled <ms>, slowest <step> <ms>`, so Gate 2 can read it.

### R11: Settings follows changes made elsewhere (#460)

As someone who signs in on the welcome or the AI's sheet, I want an open Settings tab to show it.

Acceptance criteria:
- **A2 reproduces first** which changes still leave an open Settings tab stale; the fix covers each row it finds.
- An open Settings tab redraws when: Claude or ChatGPT is signed in or out anywhere in Ritemark; the runtime choice or any other setting the page shows changes in All settings or `settings.json`; a key is saved or removed outside the page (the welcome, the Configure API Key command).
- **When the tab comes back into view**, each AI's state is checked again and the update state read again, which covers what no event reports (a sign-in in a terminal, for a system install; an update handled from the bell).
- The redraw sends only what changed (R10), and doesn't move the page's scroll or the open section.

### R12: What each AI can use (#415)

As someone who works with several AIs, I want to see which skills, connectors and plugins each can use.

Acceptance criteria:
- **Read-only, per AI** (Claude, ChatGPT, OpenCode): each skill, connector (MCP server) and plugin, with one line on what it is and where it comes from (this project, your own setup, the AI's own, or Ritemark). Something installed that the AI can't use now says so, and why.
- **Read from what each AI reports** (A3): Claude's session start report and its connector status; ChatGPT's and OpenCode's own lists where they have them. No other app's config file is parsed (#377's lesson); where an AI reports nothing of a kind, the list says so.
- **Ritemark's own tools come from the one registry**, `src/runtime/ritemarkTools.ts`, never a copy.
- **Only when asked:** read when the person opens the list, never on Settings' open (R10), kept for the window, with Check again.
- **No browsing or installing,** no marketplace, nothing promoted (Ritemark is free).
- **Where it lives is the lead's** (question 1); recommended: a folded "What Claude can use" in each AI's Details sheet.
- **Its own flag:** `settings-ai-capabilities` in `src/features/flags.ts`, ON by default, gates the host's request handler and the sheets' section; with it off, the sheets draw as without R12 and no AI session starts for it. A test covers both states.

## Engineering requirements

### E1: Each check fails first

The inventory test is written against today's page and passes; with one row's message removed it fails. A2's stale rows and A1's slow open are shown on `main` first. Render tests fail on the old components where they test a new state. Evidence in `qa-evidence.md`.

### E2: Records and older versions

No setting key, SecretStorage key name or stored value changes. The page's message types stay; PR 3 adds the fill-in messages and R12 a request and its answer, typed in the page's protocol. An older Ritemark reading the same settings sees the same values.

### E3: Tier

Extension-tier: no path on `CLAUDE.md`'s shell-tier list. 2.2 is a shell release, so it ships there; alone, each PR could ship as an extension release (the theme pictures are in the bundle for that reason). Review tiers per PR are in the sprint plan: PR 3 is High (`src/settings/` key handling; `src/agent/setup.ts` if A1 puts a fix there, `src/update/` if A2 needs an event from it); the rest Standard.

### E4: Bundle

`media/webview.js` measured before and after each PR (`notes/bundle.md`).

### E5: Docs

`docs/development/architecture.md` (Settings: the sections, the fill-in messages, the redraw rule, the capability report); the `docs/user/` pages that name Settings' old sections (`setup-ai.md`, `getting-started.md`, `troubleshooting.md` and the features pages, A4 lists them); `docs/CHANGELOG.md`; the release notes line through the `release-notes` skill.

## Non-requirements

- New settings: Match this computer, text size in documents, Show changes with underlines, the Writing section and its settings, a default for how much Claude may do alone (the drawing's "Later, not in 2.2").
- AI on this computer (Sprint 151) and Web pages (Sprint 149): each appears with its sprint.
- Installing or browsing skills, connectors or plugins.
- Splitting the shared webview bundle (GH #107).
- Changing how keys are stored, tested or used, or how sign-in works.
- Moving dictation's language or the voice model's settings sheet.

## Decisions

For Jarmo, each with a recommendation; the sprint plan says them in plain words.

1. **AI on this computer appears only when Sprint 151 ships it**, and Sharing's Web pages only with Sprint 149; nothing shows as "coming". Recommended: yes.
2. **A saved key never comes back to the page.** The API keys sheet says Saved · it works; the eye that showed a saved key goes (the eye for a key being typed stays). Recommended: yes.
3. **147's own cut order** (the sprint plan). Recommended: yes.

For the Experience lead: the sprint plan's questions 1–9.
