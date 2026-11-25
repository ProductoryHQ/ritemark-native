# Sprint 176 tasks

Merge in order on the approved `sprint-176-feedback` branch. Each PR carries its requirement IDs, paths, review tier and release tier. PR 2 lands before PR 3 so the sidebar and failure doors can reuse the reviewed feedback contract. Keep checklist results in the PR’s Review record.

| PR | Work | Review / release tier | Proof |
| --- | --- | --- | --- |
| 1 | Saved days and local Home eligibility (R3, R6). Extend GuidanceStore and its tests, move qualifying save and local session ownership into activation. | Standard / extension | S11 plus the local eligibility cases in S6 and S7. Show a save across an upgrade and the concurrent-window check. |
| 2 | Existing feedback sheet (R2, R4). Extend feedbackSheet, feedbackRoute, feedbackCopy and patch 018 with the quote, preview and handoff. Extend the existing consent/event files for the new source fields and the thumb event. | High / shell (patch 018 and analytics) | S4, S5, S8, S9 and S12. Show the baseline and the new results with a two-window fixture and intercepted clipboard and network calls. Experience lead checks the quote, preview, failure and handoff states. |
| 3 | Sidebar thumbs and failure actions (R1, R2). Wire the shared turn footer, TurnFailureCard, RecoveryNotice and the approved Publish and file-read surfaces to PR 2. | High / extension (sensitive feedback content by substance, and `src/publish/` if its owned failure UI changes). Re-rate release tier if an approved surface needs a patch. | S1–S5 and S12. Show no send on opening, exact outbound fields and behaviour across runtime and consent states. Experience lead checks each visible variant, including the narrow sidebar. |
| 4 | Home and Help links (R3, R5). Replace the Home question in GuidanceCards and its protocol. Register shared link commands and add Help actions in patch 015. | High / shell (patch 015) | S6, S7, S10 and S12. Show the existing menu and the new links in branded Help on both platforms, plus Home priority and caps. Experience lead checks the card and menu grouping. |
| 5 | Docs and closing proof (R1–R6). Update user docs, architecture for changed bridge contracts, changelog and release notes. | Light / extension by path | Scenario results with exceptions stated, and the release-note lines checked against the final build. |

## Per-PR checklist

- [ ] Check the branch and list the paths that set both tiers.
- [ ] Prove the baseline and the change at the PR’s tier. Run focused checks while working, then the applicable full chain once on the final head and keep its output. Rebuild and include the generated webview bundle when its source changes. Run the invariant hook and `./scripts/validate-qa.sh`.
- [ ] Run the frame check for a patch or frame change and the controls catalogue for controls changed. Send the named proof to the Experience lead on visible PRs.
- [ ] The merging session runs the tier’s review on the PR head. High adds security review. Mark ready once for Codex, answer findings, and record the reviewed SHA, rounds and outcomes in **Review record**. Merge at that SHA after required approval.
- [ ] Preserve existing features and use no new flag. Update `docs/development/vscode-patches.md` for PRs that change patches and check the other PRs leave it alone.

## Closing

- [ ] Run S1–S12 against the final build. Windows before merge covers native Help, window capture, clipboard and 150% scaling in short tasks. Common behaviour is checked on the release candidate at Gate 2.
- [ ] Verify checked boxes against landed changes, run sprint QA and worktree hygiene, and record any pending evidence in the closeout.
- [ ] Give Growth the final event and transport descriptions for Jarmo’s legal-page approval. Coordinate the full 2.4 app build for the shell changes.
