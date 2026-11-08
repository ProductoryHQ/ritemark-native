# Sprint 156: with no AI ready, Home's first card signs in (experience 35)

Track: Lightweight (one card's behaviour, two stacked PRs, no new surface)<br>
Release tier: extension. Everything is under `src/` and `webview/src/`, so it ships in `out/**/*.js` and `media/webview.js`; the sign-in icon is already in the bundle. No patches, no `vscode`, no `product.json`, no binaries.<br>
**Status:** Approved. PR A merged (#694); PR B in review.<br>
**Approval:** the Development manager (shape, tier and risk) and the Experience lead (looks and feel), under Jarmo's 8 November 2026 delegation; recorded in ritemark-dev `decisions/log.md` (bfcdf0b). The Experience lead's nine answers (ritemark-dev 7cb2f5e, experience 35, "With no AI ready") amend the plan and are merged in below. Release approval stays Jarmo's.<br>
**Release:** [v2.2.0](../release-plan.md), 2.2's new release candidate (the Experience lead placed it there on 8 November, on Jarmo's word "las experience lead otsustab", ritemark-dev d7c6fa1).<br>
**Plan and answers:** [#690](https://github.com/ProductoryHQ/ritemark-native/issues/690).<br>
**Spec:** experience 35, the bullet "With no AI ready, the card's first press signs in" (ritemark-dev `product/design/experience/experiences/firstday/README.md`).

## Why

In the first 2.0 week, 6 of 11 fresh installs opened a project with no AI ready, and 1 of 11 sent a first message. Until now the card kept the request's words ("Ask Claude what is here"), naming an AI that needs a paid plan, and its press only opened Ask with, so a first message took three steps.

## What a person sees

- **Home's first card, with no AI ready.** The heading and body are the card's own, and the body names the AI. The main part says **Sign in with ChatGPT**, with the sign-in icon and the tooltip "Opens ChatGPT's sign-in in your browser"; the note under it says "Any plan works, free included."
- **Which AI leads.** ChatGPT, because any plan works. When another AI was the last one ready and its sign-in has lapsed, that AI leads: **Sign in with Claude** (not Claude.ai), with "Needs a paid plan, such as Pro or Max." and Claude's tooltip. In practice only Claude can change the lead, because OpenCode is set up, not signed in. If ChatGPT can't sign in here (a build without it, its runtime set to the computer's own, its flag off), Claude leads. If neither can, **Set up OpenCode** leads, with "Open models, with an API key of your own.", and its press opens the key sheet, as Ask with does.
- **What Ritemark remembers.** Only which AI was last seen ready, per profile. A sign-out pressed in Ritemark clears it; any other sign-out counts as lapsed, because Ritemark can't tell them apart.
- **The caret** keeps Ask with as it is: every AI in today's order, the leading one too, each with its state (Sign in, Set up).
- **The sign-in** runs the welcome's own flows.
- **While it runs,** the card borrows the welcome's frame 2 in its own parts. The whole button waits with the spinner and "Signing in…", the caret too, so a second press can't start another. A small quiet **Cancel** follows it ("Stop waiting for ChatGPT's sign-in"); the note reads "Your browser opened ChatGPT's sign-in page."; the line under the row reads "Did nothing open? Open the page again" and opens the page again.
- **After Cancel** (the card's, or "No" at the computer's own "open the website?" question), the card is back as it was, with no line. **After a failure or a timeout,** it is back as it was, with the welcome's reason on the card's problem line. Pressing again is the retry; there is no Try again button.
- **When the sign-in finishes,** the same card becomes the ready request ("Ask ChatGPT what it can do here", with its note). Nothing is sent until the person presses it. That AI becomes the AI for new chats, as the welcome's choice does, so the status bar names it; a chat that is open keeps its AI.
- **A sign-in made elsewhere** (the AI's sheet, Settings) redraws Home's card too, so it never offers a second sign-in.

## PRs

### PR A, High tier: the card (branch `sprint-156-no-ai-card`, #694)

High, not Standard as first planned: it changes `src/settings/RitemarkSettingsProvider.ts` (the Claude and ChatGPT sign-outs clear the AI last seen ready), and that path is High (review round 1, finding 9).

- `src/guidance/readyRequest.ts`: `leadAi` (the lead rule) and `canSignInHere` (which AI can be signed in to here); `cardAi` returns the lead when no AI is ready; `readyRequestWords` takes a `ready` flag, and with no AI ready changes only the button (`signInWords`) and the note (the host's copy of the welcome's `PLAN_LINES`, kept equal by a test).
- `src/guidance/guidanceStore.ts`: the last ready AI in its own global-state key, `ritemark.guidance.lastReadyAi` (only an AI's id), apart from `ritemark.guidance.v1` so one window can't undo another's record; `noteLastReadyAi`, `clearLastReadyAi` (only when it is the AI signed out), `readLastReadyAi` (bad values ignored), and the test seed.
- `src/guidance/GuidanceHost.ts`: the card's press signs in through the existing `signIn` (the welcome's `beginClaudeLogin` and `startCodexSignIn`); a readiness check before ChatGPT's sign-in starts; one sign-in per AI, its phase (`starting` until the page is open, then `waiting`), Cancel and "Open the page again" through the welcome's own paths; the welcome's reasons (`welcome/words.ts`) on the problem line; Home redraws on Claude's and ChatGPT's status changes and on the AI keys' changes; a sign-in (or OpenCode's set up) from Home makes that AI the last ready one and the AI for new chats, through the welcome's own save (`saveAiForNewChats`).
- Set where an AI is seen usable: the status bar's AI (`ai/aiStatusItem.ts`, the AI in question only), Home's sign-in, and the welcome's `providerReadyFromWelcome`. Cleared only after a successful sign-out pressed in Ritemark: Settings' Claude and ChatGPT sign-outs, and the AI sheet's ChatGPT sign-out.
- `src/projects/protocol.ts`: the card's `aiName` and `signingIn`; `home/cancel-sign-in` and `home/reopen-sign-in`. `src/views/HomePanel.ts` routes them.
- `webview/src/components/home/GuidanceCards.tsx`: the main part always sends `home/ready-request` (Set up OpenCode opens the key sheet), with the sign-in icon and its tooltip; the name from the host; the waiting state from the card's own parts and the welcome's words (`welcomeCopy.ts`: `browserOpened`, `COPY.reopen`, `COPY.cancel`, and the frame 2 tooltips `stopWaitingTip` and `reopenTip`, which the welcome now shares). `SplitButton` is unchanged.
- **Review round 1's fixes** (#694):
  - **A ChatGPT sign-in from Home settles however the news comes.** The AI sheet's `login-started` listener restarts the login's poll with its own callback, and a finished login stops the poll, so the first caller's callback never heard the end. `CodexRuntime.listenToLoginPoll` keeps a sign-in's listeners across a restart until the poll stops (the welcome's ChatGPT timeout line, lost the same way, comes back); Home also settles from Claude's and ChatGPT's status events when the AI reads usable, as the welcome's recheck does, and gives up on its own after the welcome's 2 minutes (`CODEX_LOGIN_TIMEOUT_MS`).
  - **The failure line** stays until the next press, which is the retry and takes it away (the Experience lead, ritemark-dev f85e188); it shows only while the card names the AI that failed and asks it to sign in, and a sign-in that makes it ready clears it.
  - **The waiting card** applies only with no AI ready; with one ready, Ask with's sign-ins run as before and the ready request stays usable.
  - **Claude:** a login that can't start says "couldn't start"; a Claude login Home joins gives it the page's address (`claudeLogin.ts` keeps it), and "Open the page again" with no page to open says so in the welcome's words.
  - **OpenCode** leads only when it is on; otherwise ChatGPT, whose press opens AI Settings.
  - **Key changes** redraw Home only for the AI keys.
  - **Review round 2's Nits and two pre-existing welcome faults** (#694): a card naming a ready AI drops an old sign-in failure line; the sample's line shows only on the ready request, and a sign-in start clears it; Cancel and "Open the page again" act on the AI the card names; a ChatGPT login Codex reports as failed says "didn't finish" at once; the Claude page's address is replayed only to Home, which asks (Settings and the sheet show one toast, as before). One wait, `waitForCodexSignIn`, serves Home and the welcome: the welcome no longer stays on "Signing in…" when the poll is stopped (a failed login, a Cancel, a sign-out) and gives up after the same 2 minutes; its "Open the page again" with no page says so, in Home's words.
  - **`ui/button` gains a 28 px size, `compact`,** for the card's Cancel and "Open the page again" and the feedback card's buttons; Home's two local restyles of the button are gone, and the controls catalogue has the new size's row.
- **The test seed** (approved by the Experience lead): `RITEMARK_TEST_LAST_READY_AI`, read only in the test channel (`RITEMARK_BUILD_CHANNEL=test`, as #681's test keys), so a lapsed Claude can be staged for screenshots.
- Docs: `architecture.md`, the CHANGELOG, the 2.2 test checklist, and the release notes' line in the Experience lead's words.

### PR B, High tier: the three counts (`src/analytics/`), stacked on PR A

| Count | Fields | When |
| --- | --- | --- |
| `welcome_ai_skipped` | `how: button \| new_project`, `ai_ready` | The welcome's Skip for now, or a new project with no AI. Held until the person answers usage data, like the welcome's other events. |
| `ai_signin_started` | `provider: claude \| chatgpt \| opencode`, `from: home_card \| home_menu` | Claude's login starts, ChatGPT's page opens, or OpenCode's keys are saved. |
| `ai_signin_finished` | `provider`, `from` | That AI becomes ready. A failure shows as started minus finished. |

Every field is a fixed choice or a yes/no: no words, names, paths or models. The review is `/code-review` at high plus `/security-review`. Before 2.2 publishes, ritemark.app's privacy page lists the three counts (a ritemark-web change for Jarmo's publish gate).

As built (branch `sprint-156-signin-counts`):

- `src/analytics/events.ts`: the three events; `SIGN_IN_FROM` (`home_card`, `home_menu`) and `WELCOME_SKIP_HOW` (`button`, `new_project`) as lists and types; `SignInCountsAreClosed`, an allow-list that fails `npm run compile` unless every field of the three is a `boolean`, `WelcomeProvider`, `SignInFrom` or `WelcomeSkipHow` (a string, number, array, object or template literal fails). The provider is the existing `WelcomeProvider`, mapped from the AI's id by `GuidanceHost`'s `PROVIDER`.
- `src/analytics/consent.ts`: `welcome_ai_skipped` joins the held events (`HELD_EVENT_NAMES`, a list as well as a type), and the gate holds nothing else: any other name given to `trackWelcome` is dropped, so Home's counts can only go through `track`, after a yes.
- `src/welcome/welcomeHost.ts`: Skip for now on the fresh welcome's step 1 (`how: button`) and Start a new project while the welcome shows step 1 (`how: new_project`, S25), once per skip; from a window where the welcome isn't open it opens on the project form and nothing is counted. `ai_ready` is the welcome's own answer (`welcomeState.aiFoundReady`): a skip made while a check still runs waits for it, a recheck of an AI that had answered too (#697), each answering within 20 s; leaving for a project counts it at once, before the yes; the welcome closing drops it with its other held events.
- `src/guidance/GuidanceHost.ts`: `signIn(folderUri, ai, from)`, `home_card` from the card's press and `home_menu` from Ask with (`HomePanel`); `ai_signin_started` when Claude's login starts (or Home joins one running), ChatGPT's page opened (a declined "open the website?" isn't a start), or OpenCode's keys are saved (`saveKeys(…, from)`; a Save that stores no key isn't a start); `ai_signin_finished` once, from the sign-in's own `ready` settle (`countFinished`), only for a sign-in that sent its start; OpenCode, with no login to settle, finishes when it reads ready after the save. An AI found ready before anything started sends neither.
- `src/projects/protocol.ts`: `home/save-keys` carries `from` (checked against `SIGN_IN_FROM`); `GuidanceCards.tsx` remembers where OpenCode's key sheet was opened, the only webview change.

## Proof

- **Unit tests first, each failing on `main`:**
  - the lead rule, and which AI can be signed in to here (`src/guidance/signInCard.test.ts`);
  - `cardAi` with no AI ready (S19 flips: it named Claude);
  - the card's words for three cards × the leads, the note equal to the welcome's `PLAN_LINES`;
  - the last ready AI: its own key, cleared only when it matches, bad stored values ignored; the seed ignored outside the test channel;
  - the status item storing only a usable AI (`src/ai/aiStatusItem.test.ts`);
  - the sign-in's life on the host (`src/guidance/GuidanceHost.test.ts`): the press signs in; it settles on success through the AI sheet's restart of the poll and from a status event alone, and nothing is sent; Home's own give-up and its line, taken away by the next press; Cancel; the readiness check; Claude's failure, its "couldn't start" and "Open the page again" with no page; the waiting card only with no AI ready; Ask with as the host builds it;
  - the poll's listeners surviving the sheet's restart, hearing ready and the give-up, and going with a stopped poll (`src/codex/CodexRuntime.test.ts`, test 20);
  - Home drawing the sign-in with no AI ready, its press sending `home/ready-request`, the waiting state (Signing in…, Cancel, the line under the row) and a failure's line (`webview/src/components/home/home.test.ts`);
  - PR B: the three counts and their fields, and the held skip event (sent on yes, dropped on no) (`src/analytics/analytics.test.ts`, `consent.test.ts`); the counts on the host (`GuidanceHost.test.ts`: from the card and from Ask with, finished once, finished on the sign-in's own ready settle, nothing finished after a failure, a timeout or a Cancel, no start for a declined "open the website?" or a login that can't start, OpenCode's keys); the skip (new `src/welcome/welcomeSkip.test.ts`: once per skip, each `how` (`new_project` only with the welcome open), `ai_ready` waiting for the checks, dropped when the welcome closes, counted before the yes); `home/save-keys`'s `from` (`src/projects/protocol.test.ts`). Each fails on `main`'s sources; eleven mutations of the fire points are each caught (review round 1).
- **Live, in an isolated test window** (the Development manager), with throwaway AI homes and no real accounts:
  - **No AI:** the card on a folder with files, on an empty project and on the sample, in Light and Dark, with the caret open.
  - **Signing in,** and **a failure line**.
  - **The ready request after a sign-in:** press the card, then write ChatGPT's sign-in into the run's own `CODEX_HOME` with the test key. The card becomes the ready request and nothing is sent.
  - **Claude leading,** staged with `RITEMARK_TEST_LAST_READY_AI=claude-code` in the test channel.
- **The Experience lead approves from these screenshots,** in Light and Dark (answer 9); no frame is drawn first.

## The Experience lead's answers (8 November), merged above

1. While a sign-in runs, the card uses the welcome's frame 2, built from the card's own parts.
2. Cancel puts the card back as it was; a failure or timeout puts it back with the welcome's reason on the problem line; pressing again retries.
3. The sign-in icon, with "Opens ChatGPT's sign-in in your browser" (Claude's when Claude leads).
4. "Sign in with Claude", not Claude.ai.
5. Ask with keeps every AI, in today's order, each with its state. The plan's "Ask with leaves out the leading AI" test is dropped.
6. If ChatGPT can't sign in here, Claude leads; if neither can, Set up OpenCode leads.
7. A second press during a sign-in can't happen: the button waits.
8. A sign-in from Home makes that AI the AI for new chats; an open chat keeps its AI.
9. Approval from the build's screenshots, Light and Dark.
