# Sprint 149 Tasks

Nothing here starts before the plan's approval (sprint-plan.md, *Approval*). Tick a box only when the change is on its PR's branch. W numbers are workstreams and A numbers audits in [technical-plan.md](technical-plan.md); R and E numbers are in [spec.md](spec.md); S numbers in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [ ] The plan's approval is recorded (the manager, on Jarmo's 2.2 delegation)
- [ ] `git checkout -b sprint-149-publish` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-149-publish-shell`, `-gather`, `-cloudflare`, each from `origin/main` the same way
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] Asked: Jarmo for decisions 1–6; the Experience lead for questions 1–8; the "Ritemark on Windows" session for the overlay checks

## Phase 1: Audits (each in `research/`, before its code)

- [ ] A1 `research/page-bar.md`: `editor/title` + context key on a dev instance, two page tabs and a web tab; patch needed or not
- [ ] A2 `research/page-sandbox-live.md`: `page-sandbox.md`'s live steps with `hostile.html` and a decoy server; the session today (Global) and after W2
- [ ] A3 `research/gather-corpus.md`: ten real pages and what each references; R3 changed in `spec.md` first if needed
- [ ] A4 `research/cloudflare-measurements.md`: M1–M11 (needs decision 1), M12–M14 (needs decision 6's private client); R6/R7 changed in `spec.md` first if needed

## Phase 2: PR 1, the vault script and the bar (W0, W1; R2, E3)

- [ ] `scripts/qa/with-test-keys.sh`: names only, refuses without the test channel and a test profile; its test
- [ ] `ritemark.page.openInSystemBrowser` and the `ritemark.publish.pageInProject` key (inside the project by `realpath`); S2–S4
- [ ] If A1 says no patch: the `editor/title` contribution; screenshots Light and Dark to the lead
- [ ] Review (Standard), Windows overlay, merge

## Phase 3: PR 2, the shell (W1, W2; R1, R2), only if A1 or decision 4 needs it

- [ ] `./scripts/create-patch.sh` on patch 010: the two actions in `MenuId.BrowserActionsToolbar`, the workbench context key, Ephemeral for project pages
- [ ] A2 again on the branch (S5, S6); the frame check; `CLAUDE.md`'s patch table row for 010 updated
- [ ] Review (High, `/security-review`), merge; Windows at Gate 2

## Phase 4: PR 3, what goes and the guard (W3; R3, R4, R5, R8)

- [ ] Boundary and exclusion tests first, failing (S8–S13, Windows path cases included)
- [ ] `src/publish/gather.ts`, `secretScan.ts` (fixtures assembled at run time), `publishRecords.ts`
- [ ] `webview/components/publish/PublishSheet.tsx` on `ui/dialog.tsx`; every button the shared Button with a tooltip; screenshots to the lead
- [ ] `REVIEW.md`: `src/publish/` in the High row
- [ ] Review (High, `/security-review`), Windows overlay, merge

## Phase 5: PR 4, Cloudflare (W4, W5, W6; R6, R7, R9)

- [ ] `setApiKey` allowlist with its failing-first test (`RitemarkSettingsProvider.ts:382–389`)
- [ ] `src/publish/host.ts`; `cloudflare/client.ts` against a fake server; `redact()` on every error
- [ ] `cloudflare/oauth.ts`, `config.ts` (the esbuild define), `account.ts` (SecretStorage, refresh, Disconnect); the token path through the host's password box
- [ ] Settings ▸ Sharing ▸ Web pages; the bar's states; `web-page-publishing` flag
- [ ] **After A4:** `scripts/qa/cloudflare-contract.mjs` green; S17–S29 live on the Mac; S21's log search
- [ ] Review (High, `/security-review`), Windows overlay (offline scenarios; live when the Windows vault exists), merge

## Phase 6: QA and closeout

- [ ] Every scenario S1–S32 in `qa-evidence.md` with its result, or why it couldn't run
- [ ] Every Worker the runs created is deleted (the contract script's list is empty)
- [ ] `docs/user/` page; `docs/development/architecture.md`'s publish subsystem; release-notes line (the `release-notes` skill)
- [ ] The release plan's tracker rows; ritemark-dev `governance/test-keys.md` row 6 (the manager)
