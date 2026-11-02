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
- Not run here: the other D rows, the L rows by their openers, and Windows (the overlay, before the merge).
