# New → Deck opens the deck: the proof (#749)

Run on 16 November 2026 after 18:00 EET, on macOS arm64, by the builder: one dev window of this branch (`scripts/qa/dev-launch-isolated.sh`: a fresh profile, throwaway AI homes, `--use-mock-keychain`), launched once and quit at once (`LEFT=0`). `ritemark.features.decks` was turned on in its settings. The project was a copy of Sprint 157's demo project, with two of its decks copied under other names (`Harbour Logistics/Working with data`, `Northwind/AI assistants`) so the card had more than three earlier decks to show. The window is 1440 × 900, the shots 2×. `new-deck.sh.txt` drives New → Deck; the CDP helper is `cdp.mjs.txt` (PR 1's, with a window size step).

Claude reads as signed in the way Sprint 160 PR A's proof did: the placeholder `sk-ant-test-placeholder-0000` (not a credential) saved in Settings → AI accounts → API keys → Anthropic, and `ANTHROPIC_BASE_URL` pointed at PR A's `capture-server.mjs` on 127.0.0.1, which answers every request with a 401. No real key, no sign-in, nothing left the machine.

- `new-deck-start-card-1440.png`: Harbour Logistics chosen in Documents, then New → Deck. No pick came first (the quick pick's widget was not shown); the tab `Untitled.deck.md` opened at once in Harbour Logistics, with the title slide's title selected ("The deck's title"). Under the first part is the start card: START THIS DECK, ×, Ask Claude to draft it with "What is it for?" and Draft, and Or copy an earlier deck with the three newest decks (name, then folder · date) and All decks…. The Slide library's two topics are not among them.
- `new-deck-after-draft-1440.png`: the AI column folded first, then words typed in the card's field and Enter pressed. The AI column opened, and its one message reads "Draft this deck: A half-day workshop on AI assistants for Harbour Logistics' dispatchers" with "Context: Untitled.deck.md" on it (the deck in front, attached as every message's is). The card went. The stand-in got Claude Code's requests with the placeholder key; the turn was stopped by hand, since the answer doesn't matter here.
- `new-deck-after-copy-1440.png`: Northwind chosen, New → Deck, then "AI assistants and agents" (Harbour Logistics) on the card. The deck now has its 13 slides, theme line and look line; the file is `Northwind/AI assistants and agents (copy).deck.md`, the tab followed the rename, and the bar says "This deck is now a copy of AI assistants and agents." The Draft deck of the first shot, whose card went with Draft, is listed on this card as "Untitled" (an earlier deck whose card is gone counts as a deck).

## What the run also showed

- With the notice in the bar, Present shows its icon alone: the bar's existing narrow-room rule (#566), not changed here.
- "Activating extension 'GitHub.copilot-chat' failed" showed at the start: the dev tree's built-in Copilot Chat extension, as in PR A's run; not Ritemark's.

## Not verified

- Claude actually drafting a deck (no real key).
- Windows: the copy's rename and the tab following it.
- With the flag off: covered by PR 7's run (`../pr7/new-menu-flag-off-1440.png`); this PR didn't change the New menu.
