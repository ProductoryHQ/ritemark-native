# Sprint 163 PR 1: the code block on the slide (proof)

One isolated dev window of this branch (`scripts/qa/dev-launch-isolated.sh`, a fresh profile, throwaway AI homes, `--use-mock-keychain`, `ritemark.features.decks` on in that profile only), on 18 November 2026 at about 22:50 EET, on a copy of Sprint 157's demo project with a `Workbook.deck.md` and a `Prompts.md` added. The page was held at 1440 × 900 by a device-metrics override, so the window's shots are 1440 × 900 at 2×. It was launched once and stopped at once (`LEFT=0`). Nothing was signed in to, and no Open in link was followed.

Retaken at about 23:30 the same night after the Experience lead's update (ritemark-dev a58b6e4, `code-block-line.png`): Copy and a round ↗ on a line of their own at the block's top right, the words under them at the block's full width; one round, translucent ↗ everywhere; a Text document's places marked.

1. `1-slide-editor-prompt-1440x900.png`: the slide in the editor, the caret in the prompt's code block: Copy and the round ↗ on their own line at its top right, the words under them, and the two places to fill in marked.
2. `2-open-in-menu-1440x900.png`: the ↗ pressed: Open in Claude and Open in ChatGPT. Esc and a click elsewhere close it (checked).
3. `3-wall-prompt-1440x900.png`: the same slide on the wall (Present). `3b-wall-open-in-menu-1440x900.png`: the wall's ↗ menu; the wall stayed on 2 of 2, and Esc closed the menu and left Present running.
4. `4-text-document-copy-1440x900.png`: a Text document's code block (no language) with the same Copy on its own line (its tooltip, "Copy the whole block") and its places to fill in marked.
5. `5-page-slide-720x860.png` and `6-page-open-in-menu-720x860.png`: the published page's slide, from the page built locally from the same deck (`pageHtml`, no publish), served from 127.0.0.1: Copy took the whole block (clipboard stubbed), the ↗ opened its two links (new tab, `noopener noreferrer`), and a click elsewhere and Esc closed it, under the page's own Content Security Policy.

Copy in the editor and on the wall put the whole prompt on the clipboard (read back with `pbpaste`). Opening the deck and the document wrote nothing to either file (their modification times stayed those of their writing).
