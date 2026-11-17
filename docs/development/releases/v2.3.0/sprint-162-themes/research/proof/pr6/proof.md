# PR 6 proof: a published deck keeps its theme until Update the page

Nothing was sent anywhere. One isolated dev window (`scripts/qa/dev-launch-isolated.sh`: its own profile, AI homes and mock keychain), on a synthetic project: one deck, `Training/Intro.deck.md`, using a project theme `Fern` (Fraunces headings, Inter text, a logo top right). Decks was turned on in the run's own settings. No Cloudflare account was connected.

How the page came to be "published": the page was written beside the deck the way the deck bar's Publish writes it (`buildDeckPage`, `writePageFonts`, `writeDeckPage`), and a stand-in publish record for it was written into the run's own profile, from 2.2's real gather of that page (`gatherPage`, `recordFor`), as an upload would write it. The upload itself is covered by the fake Cloudflare host in `PublishController.test.ts`.

| Shot | Shows |
| --- | --- |
| `pr6-published-1440.png` | The deck in Fern, the chip "Published". |
| `pr6-theme-saved-changed-1440.png` | In Fern's tab, Background typed as `#DCE8F2`. While it was Not saved, the chip still read "Published" (read from the deck view). After Save, the deck's chip reads "Published · changed" and the stage shows the new background. The page file beside the deck still had none of `#DCE8F2`. |
| `pr6-updated-published-1440.png` | Update the page pressed: the page file was written with the new theme first, then 2.2's flow showed its Set up sheet (no account), which was cancelled; the page stays, as for any update. The stand-in record was then written again from the new page, as the upload would, and the deck reopened: "Published". |

The page after Update the page carries the new theme: its `--slidebg` is `#DCE8F2`, and Fern's old `#F4F1E8` is gone from it. Its fonts (`fonts/Fraunces-1.000-*`, `fonts/Inter-4.001-*`) and its logo (`logos/logo-e7b6e01965d42fc7.svg`) are the same files as before.

Not shown: the page itself in a browser. The dev window crashed (SIGSEGV in the main process) when the integrated browser's New page opened, after about 9,800 "ResizeObserver loop" lines while the screenshots' 1440 × 900 size was forced over CDP. That is outside this PR's code; its cause is not proven. The run folder was removed (`LEFT=0`).
