# Sprint 147: QA evidence

The result of each inventory row's check (spec R1), PR by PR. T: `settingsInventory.test.ts`; R: a render test from a
recorded payload (`settingsPage.test.ts`); D: on a dev instance with CDP input; L: a way in.

## PR 1: the frame and five sections

### E1: the inventory test fails first

- `settingsInventory.test.ts` was committed first (e08ed943), against the page as it was on `main` at `2106e01c`: it
  passed (28 messages, Google Docs' 5, 8 settings, 5 keys).
- With one message removed from the real page (`'testApiKey'` renamed in `RitemarkSettings.tsx`), it failed
  ("every message, setting and key of the inventory has its sender and its handler"); restored, it passed again. The
  test also checks itself: a message removed from the page, a case from the host, one key card's Save and one setting
  each fail it.
- `settingsPage.test.ts` draws the page from recorded payloads. On `main` it can't pass: the old page has no sections and
  no first state to draw from (it shows its spinner until the host answers).

### The rows

| Rows | New place | Check | Result |
|---|---|---|---|
| I1, I2 | Appearance: the theme pictures; Text size in chats, 12/13/15, a size set in All settings shown as it is | T; R (16 px: no step chosen, "16 px, set in All settings") | Pass |
| I3–I6 | Advanced: Where the AI runs from, its "Now:" line, Git and Node, the fallback | T; R | Pass |
| I7–I27, I30, I32–I38 | AI accounts: today's Claude, ChatGPT, OpenCode and five key cards, moved whole; the eye stays (decision 2, Jarmo, 2 November) | T; R (each card, five eyes) | Pass |
| I17, I56, I57 | Advanced: Ritemark's parts, Check and Repair… (today's three readiness cards in a sheet) | T; R | Pass |
| I28, I29, I31 | Advanced: ChatGPT asks before, Where ChatGPT may write, OpenCode changes files without asking | T; R, and hidden with their flags off | Pass |
| I39, I40 | Sharing: Your Google account, Template for new Google Docs | T; R, and hidden with `google-docs-publishing` off | Pass |
| I41, I42 | Advanced: When the AI goes quiet (a stored 22 is offered as it is), Keep a detailed log | T; R | Pass |
| I43, I44 | Usage data: the switch in the welcome's words, Privacy policy, Terms of use | T; R | Pass |
| I45–I55 | Updates: the lede, the update card, skipped and paused with Turn reminders back on, reload, blocked and failed, the startup check, Check now, Version | T; R (each state) | Pass |
| I58 | Advanced: Transcripts' working files | T; R, hidden with `transcription-workbench` off | Pass |
| I59, I60 | AI accounts' foot: AI information; Advanced's More tools: All settings | T; R; `advancedSettings.test.ts` | Pass |
| I61 | The five names land on their new places | the mapping's unit test, each landing's row drawn | Pass |
| I62, I63 | No section, or a restored tab: AI accounts | R | Pass |

The D and L rows, and Windows, are checked on the dev instance and through the overlay before the merge
(the PR says what ran).

### On a dev instance (2 November, one launch, isolated AI homes, mock keychain)

- ⌘, opened Settings at AI accounts (I62); every section drew in Light and Dark, at a 1440 window and at a narrow desk
  (620 wide: the list becomes the Select, answer 8). Captures: `$TMPDIR/rm147-1` on the build machine (not committed).
- I1 (D): choosing Dark's picture turned the window dark.
- `control-states.mjs --only segmented-control,tabs`: the horizontal Tabs' 12 states match their approved images; the
  36 new states (Tabs vertical, Segmented control default and picture, both themes) have no approved image yet and wait
  for the Experience lead.
- Not run in that launch: the other D and L rows (run in the second launch, below), and Windows.

### Second launch (2 November, the lead's fixes on the branch, same isolated environment)

The profile's settings were seeded with `ritemark.ai.agentTimeout: 22` and `ritemark.chat.fontSize: 16`; each check read the
profile's `settings.json` back.

| Row | Check | Result |
|---|---|---|
| Tab | reads Settings with the gear; Sharing's icon share-network, Usage data's chart-bar (`rm147-2/light-tab-and-sections.png`) | Pass |
| I63 | after Reload Window the restored tab opens at AI accounts | Pass |
| I41 | a stored 22 shows as "22 minutes", and opening Settings wrote nothing; choosing 20 minutes writes 20 | Pass |
| I2 | a stored 16 shows as no step, "16 px, set in All settings"; Larger writes 15 | Pass |
| I3 | This computer's writes `system`, Ritemark's own writes `bundled` back | Pass |
| I4, I5, I6 | the Now line and this computer's tools ("Now: Claude and ChatGPT from this computer's. This computer has Git. This computer has Node.js.") | Pass |
| I28, I29 | ChatGPT asks before: Only when something fails writes `on-failure`; Where ChatGPT may write: Nowhere writes `read-only` | Pass |
| I31, I42 | the OpenCode and detailed-log switches write `true` | Pass |
| I17 | Check sends the two status checks; the row stays drawn | Pass |
| I56, I57 | Repair… opens Ritemark's parts with the voice model, Claude and ChatGPT | Pass |
| I60 | All settings opens VS Code's settings. The scripted check first reported FAIL: it looked for a new tab, but `workbench.action.openSettings` (the same command on `main`) opens VS Code's settings as a dialog over the window. The check was wrong, not the page (`rm147-2/i60.png`) | Pass |
| I45 | the startup check's switch writes `false`, and back | Pass |
| I47, I48 | Check now runs; "Last check worked today at …. None failed." | Pass |
| I43 | The scripted check first reported FAIL: it assumed the switch started On, but this profile's usage data was Off. The page's path is `main`'s: the same `usageData:set` message with the new value, the same host handler (`setUsageData` writes `ritemark.analytics.enabled`), and the same words. Re-checked in a third launch, reading the profile back: Off/`false` → click → "On. Never your documents, chats or names.", checked, `true` → click → Off, `false` (`rm147-2/i43.txt`). `settingsPage.test.ts` now pins the words in each state and the message | Pass |
| I39 | Sharing draws Your Google account (the dev build's "isn't available in this version" state) | Pass |
| I1 | the Dark picture turns the window dark (first launch) | Pass |
| L: I62 | ⌘, opens Settings at AI accounts | Pass |
| L: `transcription` | Transcribe's gear, with Settings open at AI accounts, lands on Advanced | Pass |

**Checked at Gate 1** (they need a signed-in AI, a real key, a browser or a feature this dev build lacks): the sign-in rows
I10, I13, I15, I16, I22, I26 and I39's Connect; the key rows I11 and I32–I38 (the key round trip, PR 2); the links I12,
I19, I27 and I44 (each opens the browser); I40 (a connected Google account); I58's Clear (no transcripts here); the ways
in `google-docs` (Share, with Google Docs publishing on), `google-ai-key` and `openai-api-key` (a flow step with no key),
`usage-data` (no opener passes it). Their landings are held by `settingsPage.test.ts`.

## PR 2: AI accounts (W4; R3, R9)

AI accounts draws Claude, ChatGPT and OpenCode as rows (answer 9's words, one button each, no amber or red), API keys
under Other ways to connect with Open…, and AI information at the foot. Details… opens `AiDetailsSheet.tsx` (Claude,
ChatGPT, and OpenCode's from answer 1); Open… and OpenCode's Set up open `ApiKeysSheet.tsx` (frame 9, answers 2 and 6).
Every action sends today's message; no host, `src/settings/` key or sign-in code changed. The saved-key eye stays
(decision 2, Jarmo, 2 November): Change opens the field filled with the saved key, hidden until its eye is pressed. The
Repair sheet's amber dots are gone: a state that needs the person reads in words, with no dot (the lead's note).

### The inventory test, extended

`settingsInventory.test.ts` now holds each copy of a sign-in or repair message by its owner (the rows, the Details
sheets, Ritemark's parts), the page's `setApiKey` and `testApiKey`, and each key row's Save, Remove key (`setApiKey` with
an empty value, I37), Test, Get a key and eye (I38). Each was checked by removing it: a row's `codex:startLogin`, the
sheet's `claude:enterApiKey` and `claude:repair`, the page's `testApiKey`, a row's Remove key, Test and eye, and the
ElevenLabs row each fail it.

### The rows

| Rows | New place | Check | Result |
|---|---|---|---|
| I7–I10, I13 | Claude's row: Ready, Install, Repair, Reload window, Sign in, Cancel; Details… on every state | T; R (each state) | Pass |
| I11, I12, I14–I19 | Claude's Details: Signed in (how, who is billed), Use an API key instead, Use Claude.ai sign-in, Get one at Anthropic, Version with Check again, Used for with Learn more, Technical details, Sign out, Repair Claude | T; R | Pass |
| I20–I24 | ChatGPT's row: Ready, Sign in, Cancel, the sign-in error, Install, Repair | T; R | Pass |
| I24–I27 | ChatGPT's Details: e-mail, plan, credits; the repair command, Reload window; Sign out; Learn more | T; R | Pass |
| I30 | OpenCode's row: Set up, or Ready with the key it uses; its Details with Keys… | R | Pass |
| I32–I38 | The API keys sheet: five rows in the drawing's order, Not added with Get a key and Add, Saved · it works, Test, Change, Remove key, the eye; the flags hide OpenRouter and ElevenLabs as before | T; R | Pass |
| I59 | AI information at the foot | T; R | Pass |
| I61 | `google-ai-key` and `openai-api-key` open the API keys sheet at their rows | R | Pass |

**Not run here (Gate 1):** the dev-instance launch (the brief allows it only before 08:00 EET; this was built after
22:00), so the key round trip (K) for the five keys, the sign-in rows' start and cancel (I10, I13, I22), the links
(I12, I19, I27) and the captures wait for Gate 1 or a morning launch. Windows: through the overlay.
