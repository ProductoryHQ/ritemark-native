# Sprint 172 tasks

Nothing starts until Jarmo approves the plan in his own words (shell-tier, and it changes his decisions 1 and 10). Then the sprint branch, before the first edit.

## PR 1: the one rule, every deck place, the agents (extension-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940 (PR 1 refers to #940 itself, as the brief asked; no issue of its own)
- [x] `deckFileName.ts`: `DECK_EXTENSION` `.rtms`, `LEGACY_DECK_EXTENSION`, `isDeckPath` for both, `deckNameOf`, `deckFileName`, `DECK_GLOB`, `splitFileName` (R1, R4, R5)
- [x] Every file in the audit's first table moved to the rule; the grep in `technical-plan.md` Workstream 1 finds only `deckFileName.ts` and comments
- [x] New → Deck, Home's Deck card, Make a copy and a new library topic make `.rtms` (R3)
- [x] `deckPublish.ts`: the deck beside a page may be `.rtms` or `.deck.md` (R4)
- [x] `package.json`: `*.rtms` in `ritemark.editor`'s selector, `.rtms` in the `markdown` language, the flag's words (R2, R6)
- [x] The icon theme: `rtms` → the deck icon, light and dark (R5)
- [x] The Markdown checks marked Yes in the audit's second table take `.rtms` (and Home's Last changed, which the audit missed: its file search is `RECENT_EXTENSIONS`); of those marked No, the task board has a row that keeps it out (R7)
- [x] DECKS instructions, the deck tools' path check and words, `themeAi.ts`, `themeProtocol.ts` (R8)
- [x] Unit rows for each change; the old `.deck.md` tests green, changed only where a new name is now `.rtms`
- [x] The demo project: its decks renamed with their `from:` lines (six: the folder held seven decks, not eight); `Copilot at work.deck.md` kept
- [ ] Live proof in an isolated test window: scenarios 1, 4, 5, 9, 12 and 14 (a writer's change to an open `.rtms`, the sync path an AI's write takes) done, shots under `proof/pr1/`; 18–20 (Claude and Codex) not run: the vault has no Anthropic or OpenAI test key (`governance/test-keys.md`: "Not made"), and a test window is never signed in
- [ ] Risk and How to revert in the PR; Review record; the Experience lead's look at the shots; release-notes line; architecture.md row

## PR 2: the Mac's file type (shell-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940
- [ ] `branding/icons/deck-badge.icns`, its source and the command in `branding/README.md` (after the Experience lead's answer on the glyph)
- [ ] `scripts/stamp-deck-document-type.sh` and its test on a bare plist
- [ ] First commit: `.github/workflows/deck-type-proof.yml` and `scripts/qa/deck-type-proof.swift`; one run; its artifact (UTType, the opening app, the drawn icon, Quick Look, Spotlight) under `proof/pr2/`; the badge's form decided (`.icns` or an asset catalog)
- [ ] The script called in `build-prod.sh` and `build-macos-x64.yml` after the version stamp
- [ ] The script added to CLAUDE.md's shell-tier list and to `release-extension-preflight.sh`'s `SHELL_TIER_PATHS`, in one commit
- [ ] `validate-build-output.sh` checks the type and the badge (scenario 23)
- [ ] `branding/product.json`: `*.rtms` → `ritemark.editor`
- [ ] A dev build's plist has no deck type (scenario 24)
- [ ] TEST-CHECKLIST rows for the Mac (audit §4)
- [ ] Risk and How to revert; Review record (High)

## PR 3: Windows (shell-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940; closes #940 with the last merge (PR 3 refers to #940 itself; the manager sets Closes at merge time if it merges last)
- [x] `branding/win32/deck.ico` to the Experience lead's design: her six drawn sizes (16, 24, 32, 48, 64, 256), pixel for pixel, made with `branding/win32/make-deck-ico.py`; Windows scales 20 and 40 from them
- [x] `ritemark.iss`: the icon file, `ChangesAssociations=yes`, the `.rtms` registry block with no task (R10)
- [x] The CI round trip's registry probe checks `.rtms` after install and after uninstall (scenario 29)
- [x] TEST-CHECKLIST rows for Windows (audit §4): 24w, the CI round trip; 24x, Explorer's icon and a double-click
- [ ] Risk and How to revert; Review record (High)

## Sprint end
- [ ] The full test chain once on each final head, output to a file
- [ ] `qa-validator` at the sprint's end
- [ ] Release plan row set to Done
- [ ] Gate 2 rows (scenarios 25–28, 30) handed to the 2.3 RC's checklist; they are checked by Jarmo on the RC, not in this sprint
