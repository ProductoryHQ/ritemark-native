# Sprint 133 QA evidence

Run on 18 October 2026, on the Mac (Apple Silicon), from `sprint-133-welcome` (rechecked after main's #452 was merged in), on dev instances of this worktree launched in the background (`open -n -g`) with their own short user-data and extensions directories and their own debugging port, driven over CDP. Nothing ran on Jarmo's own profile. "Fresh" is an empty profile; "v1.14.0 profile" is one made with the installed v1.14.0, copied before each run. Usage-data sends went to a local stand-in for PostHog (`127.0.0.1:9450`) that records each request.

The screenshots are in [qa-evidence/](qa-evidence/), at 1440 × 900 for the welcome's own scenes (`scripts/qa/welcome-screenshots.mjs`) and 1200 × 800 for the rest.

Windows (S45–S47 and R15's Windows half) is not in this file yet: it runs through the Development manager's Windows session, as the plan says.

## Results

| Scenario | Result | Evidence and notes |
|---|---|---|
| S1 A fresh start with no folder | Pass | `scripts/qa/welcome-check.mjs --expect alone`: 8 of 8 (the welcome open and alone, both columns closed, no tabs, no status bar, the sheet 640 wide and centred, no Getting Started). `light-welcome-step-1.png`, `dark-welcome-step-1.png`. No terminal opened. |
| S2 The keyboard and a screen reader | Pass for the keyboard; VoiceOver not run | Tab goes Continue/Sign in for ChatGPT, then Claude, Set up OpenCode, API keys, Skip for now, and round again. Enter and Space press; Escape closes the sheets. Two fixes from this run (below): each card's button now names its AI and is described by the card's words and state ("Continue with Claude", described "Sign in with the account you already use. / Signed in"), and focus goes back to the button that opened a sheet. VoiceOver was not turned on (a system setting on Jarmo's Mac); the accessible names and descriptions were read from the page instead. |
| S3 Dark | Pass | Every text on the sheet measured against its ground: lowest 6.03:1 in Dark, all above 4.5:1 in Light. The header's step labels sit on the illustration; at first "2 · Set up project" (80% white, the kit's value) was about 3.4:1. With the Experience lead's shade at the header's foot it was still 4.3:1 at its worst pixel, so both labels are full white: worst pixel 5.66:1, median 6.9:1, on steps 1 and 2 (measured against the header captured with the labels hidden). |
| S4 The three cards | Pass | Step 1 as drawn: ChatGPT and Claude with "Sign in with the account you already use.", OpenCode with "Open models, with an API key of your own.", "You can use more than one.", API keys, Skip for now. "Codex" appears nowhere on the page. |
| S5 API keys | Partly | The sheet opens over the welcome with the Anthropic key only, drawn as experience 31's dialog (`*-welcome-key-sheet.png`: 440 wide, radius 12, padding 20, 32-high buttons, no X; dim 18% ink in Light, 50% near-black in Dark); the protocol refuses an OpenAI key as a way to use ChatGPT (`welcomeState.test.ts`). Saving a real Anthropic key was not run: there is no spare key, and this Mac's Claude is signed in. The saved-key path (Checking…, then step 2) is unit-tested and was fixed in `d3cfd860`. |
| S6 Skip for now | Pass | Step 2 with "Your AI works only inside it."; no skip on step 2. |
| S7 Already signed in | Pass | This Mac is signed in to Claude and ChatGPT: both cards show Checking…, then Signed in with Continue. |
| S8–S11 Signing in, cancelling, failing | Not run | Each opens Jarmo's browser on his real accounts. The card states, the one-sentence failures and their words are unit-tested (`welcomeState.test.ts`: no code, "authentication", "Codex" or "runtime" in any of them). Needs a run on a signed-out machine (the Windows round can cover it). |
| S12 OpenCode | Pass | A provider key in Set up: OpenCode marked set up, step 2 says "OpenCode is set up" (`s12-opencode-set-up.png`). |
| S13 A terminal for a sign-in | Does not arise | Neither sign-in opens a terminal in this build: Claude's runs its own CLI in the background, ChatGPT's goes through Codex's app server. |
| S14 Checking does not block | Pass | On every fresh start the cards showed Checking… and changed on their own as each check answered. Skip for now and API keys have no waiting state: they are live from the first draw (by code). |
| S15 A check that does not answer | Unit-tested | 20 s to "Couldn't check. Try again." with a retry (`CHECK_TIMEOUT_MS`, `welcomeState.test.ts`). A hanging binary was not swapped into the bundled runtimes. |
| S16 Offline | Unit-tested | "Not checked yet" and the offline line (`welcomeState.test.ts`); the network was not turned off on Jarmo's Mac. |
| S17 Open a folder | Partly | The macOS folder picker can't be driven over CDP. What happens after a pick is the same landing as S18 and S50, which passed. |
| S18 Start a new project | Pass for Create | "R133 landing test" made in `~/Documents/Ritemark` and landed on. Change… opens the native picker: not run. |
| S19 A name that cannot be used | Pass | "a/b": "A project name can't contain "/"." in place, nothing made (`s19-name-in-use.png`). A name already taken there is refused the same way in `newProject.test.ts`. |
| S20 Missing Git | Mac half pass | On the Mac no line shows, with either runtime. The Windows half is in the Windows round. |
| S50 Try the sample project | Pass | `~/Documents/Ritemark/Leadership programme` made with the brief, modules, notes and tasks; the board shows the cards; `project_opened` with `source: sample` once (`s50-sample-landing.png`). |
| S51 A sample folder already there | Pass | The second copy went to "Leadership programme 2"; the first was untouched. |
| S21 Landing | Pass | Documents open with the project's name in the head, a new chat with "Ask Claude about this project" (and "Ask OpenCode about this project" for OpenCode, `s21-opencode-landing.png`), the empty desk's three tiles. Table opens a new table. |
| S22 Landing once | Pass | On a profile that had landed: a second folder opened, then Switch project from the head's menu back to the landed one. Neither window landed again (the message box kept its own words, no new chat forced). |
| S23 A folder gone during the reload | Pass, with a finding | The new project's folder deleted while the window reloaded: "The folder "R133 gone" isn't there any more. Choose where your work is." over step 2 (`s23-folder-gone.png`). Ritemark's Flows storage then recreated the folder by making `.ritemark/flows` in it (below). |
| S24 Off until yes | Pass | On fresh profiles nothing reached the stand-in until the switch was turned on (S25's run); the Opt Out profile sent nothing through a project (S28); with usage data off, opening documents sent nothing (S26). |
| S25 Yes | Pass | The switch turned on in step 2: `app_session_start`, then the held `welcome_shown` (`kind: fresh`) and `ai_signed_in`, once each. |
| S26 Turning it off | Pass | On in Settings: `app_session_start` and `feature_used` arrived. Off in Settings: two documents opened, nothing more arrived. |
| S27 The 1.x notice is gone | Pass | No toast on fresh or v1.14.0 profiles. Privacy Policy and Terms of Use beside the switch and in Settings. |
| S28 A 1.x Opt Out stays off | Pass | Off with "Off until you turn it on. …"; nothing sent before or after a project (`*-welcome-update-off.png`). |
| S52 A 1.x OK carries over | Pass | On with "On, as you chose in Ritemark 1. …"; `app_session_start` and `welcome_shown` (`kind: update`, `build_channel: dev`) from the first start; off on the sheet stopped sends at once, and Settings showed off (`*-welcome-update-on.png`). |
| S53 No answer starts off | Pass | Off; turning it on sent `app_session_start` and the held `welcome_shown`. |
| S29 The events after a yes | Pass, with other paths | Seen: `welcome_shown` (`fresh`), `ai_signed_in` (`opencode`, `api_key`), `project_opened` (`sample`, `has_ai: true`), `first_message_sent` (`claude`), each once with `build_channel`. The Claude-account and existing-folder paths were not run (S8, S17). No property holds a path, name, file, message or account. |
| S30 After a no | Pass | Off profiles sent nothing, before and after a restart. |
| S31 A second first message | By code | The marker is global and set before the send (`posthog.ts`, `trackFirstMessageSent`); the profile that sent it has `ritemark.analytics.firstMessageSent: true`. A second real message was not sent. |
| S32 Dev runs | Pass | Every event carried `build_channel: dev`. A throwaway automation profile is a fresh profile, so it is off and sends nothing (S24). |
| S33 The update welcome | Pass | "Welcome to Ritemark 2.0", Claude and ChatGPT Signed in, Leadership programme first with "Open when you left", two more with "Today". |
| S34 Back to where they left | Pass | The sheet closed with no reload; a restart showed no welcome (`s34-open-when-you-left.png`). |
| S35 Another project | Pass | Sales proposal Q4 picked: the window reloaded into it, `ritemark.welcome.finished` written, no welcome after a restart. |
| S36 One AI signed out | Not run | ChatGPT is signed in on this Mac. The row's words are unit-tested. |
| S37 A fresh profile never sees it | Pass | Fresh profiles only ever showed the fresh welcome. |
| S38 A document on the first launch | Pass | `<folder> <folder>/note.md` on a fresh profile: one tab, in the Ritemark editor, no welcome (`s38-first-launch-with-file.png`); a new window then showed the welcome alone (`s38-then-new-window.png`). The AI's sheet showed chat, not sign-ins, because this Mac is signed in. |
| S39 #429's reproduction | Pass | With the folder really open (see the harness note): 5 of 5 fresh launches with `"*.md": "default"` and 25 of 25 without it ended with one tab, in the Ritemark editor. |
| S40 Every way in | Pass | Help: Welcome, Welcome: Open Walkthrough…, Chat: Open Walkthrough, Get Started with Accessibility Features and the default `startupEditor` all open Ritemark's welcome or nothing; Getting Started never showed (`s40-help-welcome.png`). |
| S41 The launch check's rows | Pass | With this computer's Claude: "This computer's tools: Git found … Node.js found …" under the runtime choice; with Ritemark's own, no rows. Sign-in states with Sign Out; Usage data with the welcome's words and both links (`s41-settings-this-computers-tools.png`). |
| S42 The tree and the tabs | Pass | Name in body ink, extension muted (`.md` only for `report.final.md`; none for `README`; `.gitignore` whole); on the chosen tab and the open row the name is in ink and the extension in body (#1E1B4B and #475569 in Light; #F8FAFC and #C7D2FE in Dark), as revised after Windows round 3. In Dark and Light High Contrast the extension takes the name's ink (21:1 and about 14.7:1) (`s42-*.png`). |
| S48 A finished profile's window with no folder | Pass | "Where do you want to start?" with the recent projects, Open another folder… and Start a new project, no AI or switch (`*-welcome-start.png`). |
| S49 Every empty desk | Pass | In a project window with every tab closed: Text opened a new document, Table a new table, Web page a browser tab (`s49-empty-desk-tiles.png`). The new files went into the project (#451 unchanged). |
| S43 The inventory | Partly | The launch check's rows live in Settings (S41) and the welcome (S20); "You are interacting with AI" shows on the AI's sheet. The sign-in, setup, repair and recovery cards need signed-out or broken runtimes: not run here. |
| S44 Skipped, then signing in later | Not run | Both AIs are signed in on this Mac, so the AI's sheet shows no sign-in cards. |
| S45–S47 Windows | Pass on the overlay and from main | S45, S46 on the overlay (four findings fixed in #453); S47 and the shell parts from main `eae1dedd`: see *The Windows round from main*. |

## Fixed during this QA

Each is in the commit that adds this file.

1. **Screen-reader names (S2).** The cards' buttons said only "Continue" or "Sign in". They now name their AI ("Sign in to Claude", "Set up OpenCode", "Cancel Claude sign-in") and point at the card's words and state.
2. **Focus after a sheet closes (S2).** The keys sheet has no Radix trigger, so focus fell to the page on Escape. It now goes back to the button that opened it.
3. **Switches that answer at once (S26, R7).** The Settings switch and the welcome's switch waited for the settings write, about 0.7 s and on a session's first write over 3 s, and looked dead meanwhile. Both now flip on the click; the host's state confirms them.
4. **The welcome's scrollbar rules leaked into every webview.** `welcome.css` is in the bundle every Ritemark webview loads, and its unscoped `html` and `::-webkit-scrollbar` rules restyled the editor's, the AI sheet's and Settings' scrollbars (Chromium ignores the `::-webkit-scrollbar` styles once `scrollbar-width` is set). They are now scoped to the welcome's page; the bundle's global scrollbar rules match main's again.
5. **The update sheet at 1440 × 900.** With three projects it overflowed by 24 px and the scrollbar pushed the sheet 6 px left. The short sheets now keep 12 px below as above, and the scrollbar's room is kept on both edges.
6. **A Sign in click shows progress at once (R15, #401).** On a busy first start the host can take seconds to answer; the card now shows Checking… from the click until the host's next word about that AI, so a second click can't happen (`welcomeState.test.ts`).

## The Experience lead's review (18 October)

The welcome matches experiences 2 and 32 in both themes. Their three calls, done in `719b4db7`:
1. A soft shade at the foot of all three headers (`linear-gradient(to top, rgba(22,19,47,.45), transparent 72px)`); over it the 80% label was still 4.3:1 at its worst pixel, so both step labels are full white, their fallback (S3).
2. The keys sheet is experience 31's dialog (S5). The dim stays inside the welcome's page: letting the page cover the whole window would put a webview over the window's drag area and Windows' buttons, more than a small change, which they accepted for step 2.
3. The AI's sheet names the AI in use: "Claude / OpenCode can work with your files" (`EmptyState.tsx`), "ChatGPT can work with your files" (Codex's own empty state). Checked live for Claude and ChatGPT; OpenCode by code (no key on the test profile). The composer's "Ask Codex…" is unchanged, from before this sprint.

Also from the qa-validator: the welcome now saves an OpenRouter key only with `opencode-integration` on, as Settings does.

The Experience lead approved all three, and asked for three more, done and checked live:
- Done carries experience 31's default-button ring (2 px of the sheet's colour, then the accent at 28%, 40% in Dark), since Enter in a key field presses it; keyboard focus shows the ring in the full accent.
- The composer reads "Ask ChatGPT… (type / for commands)" for Codex: visible words say ChatGPT.
- The feedback box says under its field "What you write here is sent with your feedback." (the usage-data switch promises never your documents, chats or names). VS Code's input box draws that line in its own ink, not muted, and appends its "(Press 'Enter' to confirm…)" hint; muting it would restyle every input box. The Experience lead accepted it as VS Code draws it.

The Experience lead's sign-off (18 October): the welcome, the keys sheet, the ring and focus ring on Done, "Ask ChatGPT…" and the feedback line are right; from the design side #453 is ready for Jarmo's merge word.

## The Windows round from main (19 October)

Round 3, run by the Development manager's Windows session on the signed build of main `eae1dedd` (run 39208269223). 7 of 9 checks passed:
- The first window opened at 1440 × 900, centred in a 1920 × 1032 work area; a copied profile kept its maximised size.
- The welcome alone: no tab row, no Getting Started.
- ChatGPT's sign-in: no question; Edge opened OpenAI's sign-in page; the card's Cancel ended it and freed 1455; `auth.json` was unchanged.
- S47 on a copy of Jarmo's profile: the update welcome once, with "On, as you chose in Ritemark 1"; Claude Signed in and ChatGPT's sign-in ended; "Open when you left" reopened the project with its tabs.
- Help: Getting started, Support, View License, Advanced, About; "Help: Welcome" in the palette opens the welcome.
- The empty desk's tiles, and Sprint 132's toast wrapping and Ctrl+Alt+I.
- `product.json` trusts the sign-in hosts; `commit` is still `""` (#463).

To settle:
- **The compact welcome below a 620 window: passes to spec.** Windows' frame takes 108 of the window (its 32 caption) and the Mac's 76, so a 620-tall window leaves a page of 512 on Windows and 544 on the Mac, and steps 1 and 2 scroll inside the sheet there. The Experience lead confirmed their 620 is the page's height: step 1 fits down to a page of 551, step 2 to 585 (607 on Windows), which covers a maximised 1366 × 768 Windows laptop (page about 620). No further tier.
- **The chosen tab's extension** was drawn in the name's ink. The Experience lead's call: a step quieter, in body (the kit's `.tb.on .ext`), on the chosen tab and the open row. Fixed in the closeout (patch 018's `ritemarkSurfaces.css`), checked in Light, Dark and Dark High Contrast (`s42-chosen-tab-body-extension.png`), and S42 reworded.
- The palette's "Developer: Reset Welcome Page Walkthrough Progress" goes with Sprint 134's palette filter.
- #401 on a fresh profile: extension host at +14.6 s, Ritemark activated +16.8 s, eager done +33.3 s, unresponsive 4.9 s and 0.7 s, MsMpEng 6.3% average (peak 19.2%): round 2's Defender pattern again.

## E7: the drift check (19 October)

`./scripts/check-vscode-drift.sh 1.142.0` at `eae1dedd`: 13 of 18 patches fail in 56 file patches. 006, 011, 012, 014 and 016 apply; the most are 018's (14 file patches), 002's (12) and 003's (8). Sprint 132's closeout measured 15 of 19 in 60; this sprint retired 017 and 001's and 016's Getting Started hunks. Recorded in the release plan's risk register.

## E5: the production build at the merge (19 October)

A clean-room release worktree from `./scripts/create-release-worktree.sh` at `origin/main` `eae1dedd`: HEAD exactly `origin/main`, detached, tracked sources clean, a physical pristine VS Code checkout at the gitlink `10c8e557`, physical dependency roots, empty build output. `release-preflight.sh` passed with one warning, the extension symlink, which the build creates. Then `build-prod.sh` (arm64 Node 22.22.1 from `vscode/.nvmrc`), unsigned: all 9 steps, VALIDATION PASSED, BUILD PROVENANCE VERIFIED, finished 09:25. The built app carries the sprint's last changes: the first-window size (`main.js`), Help's Getting started, `sendFeedback`, the compact rhythm in `webview.js`, and the trusted sign-in hosts in `product.json`, which, as expected, still has no `commit` (#463). The worktree is kept, unsigned, at `.worktrees/release-eae1dedd7114` (10 GB, the app 2.0 GB).

## The Windows overlay round (18 October)

Run by the Development manager's Windows session with overlay run 39159831343 (head 2149ecc8) on the installed round 2 build of main `f492948b`, fresh profiles, the installed app untouched.

Passed: step 1's cards, the card's Cancel and Escape; Open a folder… with Windows' picker; the sample project and "Leadership programme 2" (all files, 4 cards); Documents is the real folder (OneDrive exists but doesn't redirect it, so the moved case was not testable); the landing with Claude; Settings' tool rows with this computer's runtime; usage data off with no PostHog lookups; Privacy Policy and Terms of Use open in Edge with no question; the keys sheet's Done ring. As the spec has it: the new-project line reads "In Documents\Ritemark\<name>", and `\` and `:` are refused in place.

Four findings, fixed in this PR:
1. **ChatGPT sign-in.** VS Code asked "Do you want Ritemark to open the external website? https://auth.openai.com/…" while the card already said the browser had opened, and kept saying so after Cancel; Codex's listener on 127.0.0.1:1455 stayed until the window closed.
   - The sign-in hosts are trusted link domains, as ritemark.app is (`branding/product.json`: auth.openai.com, claude.com, platform.claude.com, claude.ai, console.anthropic.com). This takes effect with the 2.0 app build.
   - The card shows Checking… until the page has opened. If the question is answered with Cancel (or nothing opens it), the card returns to Sign in with "ChatGPT's sign-in page didn't open. Sign in again to open it."
   - Cancel stops Codex's listener. The bundled Codex has no call that cancels a login, so its app-server is stopped when no conversation has a thread on it, and the next use starts a fresh one.
   - A second click while a sign-in starts is ignored.
   - Checked on the Mac with the dev build, where auth.openai.com is not yet trusted, so VS Code asks; Codex was pointed at an empty `CODEX_HOME`, leaving the person's own sign-in untouched. With the question up, the card read Checking…; Cancel on the question gave the sentence and freed port 1455. Two quick clicks gave one question and one listener. The card's own Cancel after the page opened uses the same stop, and was not run here because it would open the real sign-in page.
2. **S46, an early click.** The check answered as the click arrived, the card's words grew to three lines, and the button moved 20 px down. The cards now keep three lines for their words, so the button stays where it was: every reason a check or sign-in can show fits, and the button stays at the same height through all of them. The cards are 160 high instead of 140 (`*-welcome-step-*.png` captured again).
3. **This computer's Codex said Signed in** with an ended sign-in, because it reports `auth.json` without testing it, and the landing then found it signed out. After Codex says ready, the welcome makes one request with the sign-in (the plan's usage). If that fails as a sign-in failure, or Codex then has no account, the card says the sign-in has ended. No token refresh is forced: refresh tokens rotate, and a forced refresh could sign out the person's other Codex apps. The failure test is unit-tested (`CodexRuntime.test.ts`, test 16); the case itself needs the Windows PC.
4. **Recents showed "c:\…".** A URI's path has a lowercase drive letter; the welcome now writes it "C:" (`recentProjects.test.ts`).

Noted, not this PR:
- The second Welcome tab with the old Getting Started page is the round 2 shell's: the overlay carries only the extension, and patch 001's retirement comes with the 2.0 app build.
- `window.autoDetectColorScheme` set to true on a fresh profile's first run is the first-run theme setup (`extension.ts`, Sprint 52, once per profile since Sprint 132), not the welcome. A theme set in settings.json before the first start is overridden by it; worth its own issue.

## The default first window (19 October)

Jarmo's test at `d726a382`: the first window on his 1728 × 1084 MacBook opened at 1208 × 765, and step 2 ran past the bottom (the usage line cut, the switch below the fold, a scrollbar). The welcome's page in that window is 689 tall: the frame takes the 44 strip and a 32 inset below. The Experience lead chose both remedies:

- **The first window** (patch 018, `windowsStateHandler.ts`): a fresh profile's first window opens at 1440 × 900, or 90% of the work area where that is smaller, centred (`ritemarkFirstWindowSize`, tested). Checked: a fresh profile opened at 1440 × 900 at (144, 125) in a 1728 × 1084 work area and kept it on its next start; a copy of a v1.14.0 profile opened at its saved 1200 × 800.
- **A compact rhythm** where the page is under 822. The Experience lead's line was a page under 860; but 1440 × 900 gives a page of 824, so 860 would have made the drawings' own size compact too. 822 is where the drawn rhythm stops fitting: the update sheet's three projects need 821. One more gap than the lead's list was tightened: the 24 under Your AI's box became 16, as the other gaps did, because without it the update sheet came to 694 in the 689 page. Measured at 1208 × 765, with nothing scrolling in either the page or the sheet:

  | Sheet | Needs (of 689) |
  |---|---|
  | Step 1 | 551 |
  | Step 2 | 585; 653 with Start a new project's field open |
  | The update sheet, two AIs, three projects | 681 |
  | The start sheet | 256 |

  Captured in Light and Dark in `qa-evidence/765/`. The Experience lead approved the compact rhythm and both departures; on their review the 72-high header's logo was set by its drawing, not its box: the SVG keeps about 20 of empty space under the drawn logo at 122 wide, so the box sits 2 below the foot and the drawn logo's foot is 18 from it, about 23 from the top.

## Feedback with usage data off (19 October)

Jarmo's decision on the parity list's G3 ("all recommendations ok"): Send Feedback works with usage data off, since pressing Send is the person's own choice. The gate's `sendFeedback` sends only the events given, from a client made for that one send. Unit-tested in `consent.test.ts`: off, with no answer yet, with a yes, with the kill switch on, and with no key. Checked live against a local stand-in for PostHog, on a fresh profile with usage data off:
- Escape on the text box sent nothing.
- Enter sent `reaction_submitted` and `feedback_sent`, carrying the reaction and the text, under one random id, with `$geoip_disable: true`. They carried no `build_channel` or `app_version`, and no session start or held `welcome_shown` went with them.
- Usage data stayed off, and no anonymous id was stored.

## The v1.14 parity list (PR #458, 18 October)

The Development manager's parity check found three gaps in the welcome's scope; two are fixed here:
- **G1:** 1.14's first page linked to Getting started and the Blog. Help now has Getting started beside Support (patch 015), opening `ritemark.app/en/support/getting-started`. Checked: the policy test lists it in Help's allowlist, and the palette offers "Help: Getting started". The native Mac menu was not read: it is installed only when the window has focus, and the test window stays in the background. The Blog link is not carried (ritemark.app links it).
- **G2:** Settings' "This computer's tools" shows Git whichever Claude runs (File changes needs it), and Node.js with this computer's runtime. Checked live: Git alone with Ritemark's own Claude, Git and Node.js with this computer's.
- **G8:** every walkthrough command opens the welcome, the accessibility one included. That walkthrough is VS Code's tour of its own tools (Accessibility Help, Accessible View, verbosity, signals, the palette, keyboard shortcuts, and code features: hover, Go to Symbol, folding, IntelliSense, VS Code's dictation). Every one of those commands stays available, and 1.14's first page did not link the walkthrough. Accepted for 2.0; a Ritemark page on accessibility in the user docs would be the place for it.

## Open findings

Outside this sprint's files, as issues:
- Flows' storage (`FlowStorage.ts:44`, a recursive `mkdir` of `.ritemark/flows`) brings back a project folder that was deleted while it was open: in Sprint 134 (R13).
- [#460](https://github.com/ProductoryHQ/ritemark-native/issues/460): Ritemark Settings doesn't redraw when the runtime choice changes outside the page (in `settings.json`); its own select does.
- [#461](https://github.com/ProductoryHQ/ritemark-native/issues/461): the first-run theme setup overwrites a theme set in `settings.json` before the first start (`window.autoDetectColorScheme`, seen in the Windows round).
- [#463](https://github.com/ProductoryHQ/ritemark-native/issues/463): `product.json` has no commit, so windows never keep a V8 code cache (the #401 audit's second lead).
- [#464](https://github.com/ProductoryHQ/ritemark-native/issues/464): the welcome's ChatGPT check reads Codex's error text (`isCodexSignInFailure`); a structured status from Codex would replace it.

## Privacy, for the website (E6)

For ritemark.app's privacy page, through the release's launch plan (Sprint 136's D5):
- Usage data is off until the person turns it on, with a switch on the welcome and in Ritemark Settings; nothing is sent before that yes. Ritemark 1's OK (or a notice closed without Opt Out) carries over as a yes; Opt Out or no answer is off.
- Every event carries `build_channel` (`dev` or `prod`), and no event carries a path, a name, a file, a message or an account.
- New in 2.0 with usage data on: four counts (the welcome shown, an AI signed in, a project opened, the first message sent), beside the app starts and features used.
- Send Feedback is the person's own choice and is sent even with usage data off: only the reaction and what they typed, under a one-off id that isn't kept, with no location. The box says "What you write here is sent with your feedback."
- With usage data on, PostHog derives country and city from the request's IP (`disableGeoip: false`).

## The frame baseline

`scripts/qa/frame-screenshots.mjs --compare docs/development/frame-baseline` on a fresh profile with the baseline's sample project: 0 of 18 scenes over the 0.5% line (0–0.34%), all of it the muted extensions in the tree and tabs. The same after main's #452 was merged in. The frame's 18 scenes are unchanged. The welcome's own ten scenes joined the baseline with Jarmo's approval on 19 October (`docs/development/frame-baseline/README.md`).

## Checks

- `npm test` in `extensions/ritemark`: pass (the welcome's six test files, consent, analytics and the healer included).
- Webview and extension TypeScript: clean. `compile-check-ts-native` on the patched VS Code: clean.
- Patches: 18 apply from pristine, a second run is clean, and the result is identical (Phase 3).
- After merging main (#452, the Sprint 132 closeout): patch 018's `ritemarkSurfaces.css` section rebuilt from a three-way merge of the CSS itself; all 18 patches apply to a pristine tree, which differs from before the merge in exactly #452's three VS Code files and the CSS. The stacking check, `compile-check-ts-native`, 102 VS Code tests (Ritemark, labels, Explorer, notifications), `npm test` and `validate-qa.sh` pass, and the welcome's scenes were captured again.

## A harness note

The background launcher first put the folder and file after Chromium's value-less switches (`--disable-background-timer-throttling` and its two partners), and argv parsing read the folder as that switch's value. Those first S38/S39 runs opened `note.md` in an empty window. They were rerun with the folder first; the results above are from the reruns.
