# Sprint 177 tasks

Work from `sprint-177-quick-look` after approval. Settle the cache contract and run the native proof on the combined branch before merging the shipping paths. Each PR records its requirements, changed paths, tiers and evidence.

| PR | Work | Review / release tier | Proof |
| --- | --- | --- | --- |
| 1 | Plan (#953). Add the five artifacts and update the 2.4 release plan. | Light / extension by path (docs) | Trace R1–R6 to S1–S10 and review the open proof checks. |
| 2 | App-side cache (R1–R5). Reuse the Slides PDF drawing in `deckPdf.ts`, add cache and job owners, wire save, watcher, project open and removal, and add the Mac flag. | High by substance / extension if no shell paths change | S1–S2 for PDF fidelity and S3–S8 for freshness, lifecycle and failures. Check the ordinary Save as PDF path as well. |
| 3 | The two native extensions (R1–R3, R5). Add Swift providers, shared cache reader, plists, entitlements and icon reply. | High / shell | S1–S4 on a seeded entry, S6 for interrupted writes, S8 for access and S9 for runner integration. Land shell path classification with the first shipping native paths. |
| 4 | Build, sign and ship (R5, R6). Add the Swift build script, production and Intel CI wiring, nested signing, provenance and output validation. | High / shell | S9–S10. Add the build helper to both shell path lists in the same commit as its introduction. |
| 5 | Proof and docs (R1–R6). Adapt the runner workflow and fixture probes, record results, document verified Settings steps, and update architecture, changelog and 2.4 notes. | High / shell when changing `macos/quicklook/Proof/`. Docs alone are Light / extension by path. | S1–S10. Run the proof on the combined implementation early enough for its findings to change PRs 2–4. Record OS and CPU, signatures and any coverage gaps. |

## Before the implementation PRs merge

- [ ] Agree the drawing and icon states with Experience. Agree the schema, ownership, bounds and OS proof with the manager.
- [ ] Prove the Slides-as-PDF render, direct provider replies, real Finder cache behaviour and election. Bring any failure in the agreed plain case or 26 Intel availability back to the manager.
- [ ] Exercise overlapping windows, interrupted cache writes, disk replacement and removals with the shared fixture. Confirm only the Mac starts the service.
- [ ] Run the focused checks and `./scripts/validate-qa.sh`, plus the invariant hook before any commit. Rebuild and include generated webview output if its source changes. Follow the review tier, including security review for High, and record the reviewed head and proof in the PR.

## Closing

- [ ] Run S1–S10 from [scenarios](scenarios.md) on the applicable builds and record remaining coverage and Experience’s acceptance.
- [ ] Update `docs/development/architecture.md` for the cache module and flag, with a date at least as recent as the sprint branch. Update `docs/CHANGELOG.md` and `docs/releases/v2.4.0/release-notes.md`.
- [ ] Run sprint QA and worktree hygiene. Coordinate release preflight, clean release worktrees, Gate 1 and Gate 2, notarization and publication through the full 2.4 app release.
