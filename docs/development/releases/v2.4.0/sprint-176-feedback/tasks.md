# Sprint 176 tasks

PR 2 split into 2a and 2b. PR 3 split into 3 and 3b. The implementation PRs are merged, with evidence in each PR’s **Review record** and the [closing proof](research/closing-proof.md).

| PR | Work | Review / release tier | Proof |
| --- | --- | --- | --- |
| [x] 1 (#1068) | Saved days across releases and local Home eligibility (R3, R6). | High / extension | S6, S7, S11. |
| [x] 2a (#1135) | Feedback sheet quote, prefill, chosen answer, drafts per context, Escape and outside dismissal (R2). | High / shell (patch 018) | S3–S5, S12. |
| [x] 2b (#1136) | Window picture by e-mail, native clipboard PNG, Copy words and Copy picture (R4). | High / shell (patch 018) | S5, S8, S9, S12. |
| [x] 3 (#1137) | Thumbs, inline words, selected answer and AI failure-card feedback (R1, R2). | High / extension | S1–S5, S12. |
| [x] 4 (#1139) | Home open-source invitation and Help’s GitHub and Discussions links (R3, R5). | High / shell (patch 015) | S6, S7, S10, S12. |
| [x] 3b (#1140) | Feedback on Publish failures and unreadable Word and PowerPoint files (R2). | High / extension | S4. |
| [x] 5 | Docs and closing proof (R1–R6). | Light / docs | S1–S12 recorded with Gate 2 checks. |

## Per-PR checklist

- [x] Record the landed implementation PRs and their review and release tiers.
- [x] Record focused tests and Rundev evidence for the implementation PRs. Review records hold the PR-level checks and reviewed heads.
- [x] Record Experience lead approval for every visible PR.
- [x] Record the High review rounds and clean security reviews in each implementation PR’s **Review record**.
- [x] Preserve existing features and use no new flag. Patches 015 and 018 are recorded in `docs/development/vscode-patches.md`.

## Closing

- [x] Check the landed changes and record S1–S12 with the remaining evidence in [closing proof](research/closing-proof.md).
- [ ] Complete the outstanding app and platform checks at Gate 2 on the release candidate.
- [ ] Growth’s privacy wording awaits Jarmo’s yes before publication. The shell changes ship in the full 2.4 app build.
