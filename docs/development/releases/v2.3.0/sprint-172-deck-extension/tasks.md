# Sprint 172 tasks

Nothing starts until Jarmo approves the plan in his own words (shell-tier, and it changes his decisions 1 and 10). Then the sprint branch, before the first edit.

## PR 1: the one rule, every deck place, the agents (extension-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940
- [ ] `deckFileName.ts`: `DECK_EXTENSION` `.rtms`, `LEGACY_DECK_EXTENSION`, `isDeckPath` for both, `deckNameOf`, `deckFileName`, `DECK_GLOB`, `splitFileName` (R1, R4, R5)
- [ ] Every file in the audit's first table moved to the rule; the grep in `technical-plan.md` Workstream 1 finds only `deckFileName.ts` and comments
- [ ] New → Deck, Home's Deck card, Make a copy and a new library topic make `.rtms` (R3)
- [ ] `deckPublish.ts`: the deck beside a page may be `.rtms` or `.deck.md` (R4)
- [ ] `package.json`: `*.rtms` in `ritemark.editor`'s selector, `.rtms` in the `markdown` language, the flag's words (R2, R6)
- [ ] The icon theme: `rtms` → the deck icon, light and dark (R5)
- [ ] The Markdown checks marked Yes in the audit's second table take `.rtms`; those marked No get a row that keeps it out (R7)
- [ ] DECKS instructions, the deck tools' path check and words, `themeAi.ts`, `themeProtocol.ts` (R8)
- [ ] Unit rows for each change; the old `.deck.md` tests unchanged and green
- [ ] The demo project: seven decks renamed with their `from:` lines; `Copilot at work.deck.md` kept
- [ ] Live proof in an isolated test window: scenarios 1–3, 5, 9–13 and 18–20; Claude and Codex with test keys only; shots under `proof/pr1/`
- [ ] Risk and How to revert in the PR; Review record; the Experience lead's look at the shots; release-notes line; architecture.md row

## PR 2: the Mac's file type (shell-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940
- [x] The badge: `branding/icons/deck-badge.svg` (Phosphor `presentation`, bold, #4338ca), compiled into the asset catalog `branding/icons/deck-badge.car` (the runner showed `.icns` gets no badge), and the command in `branding/README.md`
- [x] `scripts/stamp-deck-document-type.sh` and its test on a bare plist (`scripts/test-stamp-deck-document-type.sh`, in `validate-qa.sh`)
- [x] First commit: `.github/workflows/deck-type-proof.yml` and `scripts/qa/deck-type-proof.swift`; two runs; their artifacts (UTType, the opening app, the drawn icon, Quick Look, Spotlight) under `proof/pr2/`; the badge's form decided: an asset catalog
- [x] The script called in `build-prod.sh` and `build-macos-x64.yml` after the version stamp
- [x] The script added to CLAUDE.md's shell-tier list and to `release-extension-preflight.sh`'s `SHELL_TIER_PATHS`, in one commit
- [x] `validate-build-output.sh` checks the type and the badge (scenario 23), and so does the Intel workflow's Validate build
- [x] `branding/product.json`: `*.rtms` → `ritemark.editor`
- [x] A dev build's plist has no deck type (scenario 24): read from the rundev tree's `.build/electron` app, no `ai.productory.ritemark.deck`, no exported types, no `Assets.car`
- [x] TEST-CHECKLIST rows for the Mac (audit §4): 24t–24x
- [ ] Risk and How to revert; Review record (High)

## PR 3: Windows (shell-tier)
- [ ] Issue created in milestone v2.3.0, linked to #940; closes #940 with the last merge
- [ ] `branding/win32/deck.ico` to the Experience lead's design
- [ ] `ritemark.iss`: the icon file, `ChangesAssociations=yes`, the `.rtms` registry block with no task (R10)
- [ ] The CI round trip's registry probe checks `.rtms` after install and after uninstall (scenario 29)
- [ ] TEST-CHECKLIST row for Windows (audit §4)
- [ ] Risk and How to revert; Review record (High)

## Sprint end
- [ ] The full test chain once on each final head, output to a file
- [ ] `qa-validator` at the sprint's end
- [ ] Release plan row set to Done
- [ ] Gate 2 rows (scenarios 25–28, 30) handed to the 2.3 RC's checklist; they are checked by Jarmo on the RC, not in this sprint
