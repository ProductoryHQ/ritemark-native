# Audit A1: math through the real editor, before and after

Run on 26 October 2026 on a dev instance of the sprint branch (its own profile under `$TMPDIR`, CDP port 9233, the mock keychain, analytics off), with the fixtures in `extensions/ritemark/webview/src/extensions/math/fixtures/` copied into a test project. [today.md](today.md)'s probe ran outside TipTap; this one goes through the editor a person uses.

## Before: the editor at the branch's base (`b5ae122f`)

`analyst-report.md` opened in the Ritemark editor, one word typed at the end of the first paragraph, saved. Every equation in the file changed, not only the edited paragraph's:

| In the file | After the one-word save |
|---|---|
| `$\bar{x}_1 = 3.1$` | `$\\bar{x}\_1 = 3.1$`: backslashes doubled, `_` escaped |
| `$$` / `A = \frac{…}{\tfrac{1}{2}\,(…)} \times 100\%` / `$$` | `$$  ` / `A = \\frac{…}{\\tfrac{1}{2},(…)} \\times 100%  ` / `$$`, moved: hard breaks with trailing spaces, `\,` and `\%` lost their backslashes |
| `\$12,000` in a quote | `$12,000`: the escape that kept it text is gone, so the next save pairs it |
| `$n_1 = 9$` in a table cell | `$n\_1 = 9$` |

The whole diff is 13 changed lines for a one-word edit. No other tool reads the saved formulas as the same formulas.

## After: the sprint branch

**Through the test chain** (`mathRoundTrip.test.ts`: the editor's own `marked` instance and extensions, TipTap's schema rules, `createTurndownService()`):

| Fixture | Result |
|---|---|
| `forms.md` (every delimiter form: `$…$`, `$$…$$` on one line and on three, `\(…\)`, `\[…\]`, `\$`) | byte for byte |
| `prose-dollars.md` (prices, `$5 and $10`, `US$`, a lone `$`) | byte for byte; no dollar became math |
| `analyst-report.md` (13 inline equations, 2 blocks, 2 literal dollars) | every equation and dollar byte for byte; 6 list lines differ in list spacing, the #270 class Sprint 137 fixes |
| `edge-cases.md` | every equation byte for byte; 2 list lines wait for Sprint 137 in the same way |

The test ignores only lines that match the list-and-blank-line pattern 137 owns (`WAITS_FOR_137`); any other difference fails it.

**In the dev instance:**

- A changed block equation saved only its own lines; the rest of the file was untouched.
- One ⌘Z after the change, then a save, gave the original file byte for byte.
- An equation typed with `$…$` saved exactly as typed, with its dollars.
- The status bar counts equations ("116 words · 15 equations" for the analyst report, the drawing's line).

## Timing: does the view type hold?

`math200.md` (200 inline equations and 20 blocks in 40 paragraphs) against `plain200.md` (the same paragraphs without math), each put back into an emptied editor three times, timed over two animation frames:

| Document | Mount and typeset |
|---|---|
| `plain200.md` | 33 ms |
| `math200.md` | 169–197 ms |

Under 200 ms for 220 equations, on a document far heavier than an analyst's report, so the React node views stay (the plan's view type decision).

## What this could not cover

- List items and soft breaks around math are Sprint 137's: their bytes are checked once 137 merges (the test then loses `WAITS_FOR_137`).
- Windows: not run here.
