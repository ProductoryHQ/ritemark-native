# Sprint 149 Tasks

Nothing here starts before the plan's approval (sprint-plan.md, *Approval*). Tick a box only when the change is on its PR's branch. W numbers are workstreams and A numbers audits in [technical-plan.md](technical-plan.md); R and E numbers are in [spec.md](spec.md); S numbers in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] The plan's approval is recorded (the manager, on Jarmo's 2.2 delegation)
- [x] `git checkout -b sprint-149-publish` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-149-publish-shell`, `-gather`, `-cloudflare`, each from `origin/main` the same way
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] Asked: Jarmo for decisions 1 and 6 (2–5 answered 3 Nov); the lead's answers 1–8 are in (ae618e8); the "Ritemark on Windows" session for the overlay checks

## Phase 1: Audits (each in `research/`, before its code)

- [x] A1 `research/page-bar.md`: what patch 010 needs for the lead's bar (the right end of `MenuId.BrowserActionsToolbar`, hiding the address row and back/forward, links into new tabs, reload on a file change)
- [ ] A2 `research/page-sandbox-live.md` (code side written in PR 1; the live run still to do): `page-sandbox.md`'s live steps with `hostile.html` and a decoy server; the session today (Global) and after W2
- [x] A3 `research/gather-corpus.md` (R3 and R5 changes proposed there, for `spec.md` before PR 3): ten real pages and what each references; R3 changed in `spec.md` first if needed
- [ ] A4 `research/cloudflare-measurements.md`: M1–M11 (needs decision 1), M12–M14 (needs decision 6's private client); R6/R7 changed in `spec.md` first if needed

## Phase 2: PR 1, the vault script and the bar (W0, W1; R2, E3)

- [x] `scripts/qa/with-test-keys.sh`: names only, refuses without the test channel and a test profile; its test
- [x] `ritemark.page.openInSystemBrowser` (any local `.html`) and `ritemark.page.publish` (refuses a file outside the project by `realpath`), reachable from no menu yet
- [x] `web-page-publishing` registered (ON) and gating `ritemark.page.publish`'s handler, brought forward from PR 4 (Codex on #654)
- [ ] Review (Standard), Windows overlay, merge

## Phase 3: PR 2, the page's bar in patch 010 (W2; R1, R2; the lead's answers 1 and 2)

- [ ] `./scripts/create-patch.sh` on patch 010: Open in browser (icon, `arrow-square-out`, "Open in your browser") and Publish (outline, globe) at the right end of `MenuId.BrowserActionsToolbar`; `ritemarkBrowserLocalPage` gates Open in browser, `ritemarkBrowserProjectPage` gates Publish (S1, S3, S4). No session change (Jarmo's decision 4, 3 Nov)
- [ ] Local pages: no address row, no back or forward; website links open a new browser tab, project pages their own tab (S4a); reload on a file change, or the reload button kept at the bar's left (S4b)
- [ ] A2 again on the branch (S5); screenshots Light and Dark to the lead; the frame check; `CLAUDE.md`'s patch table row for 010 updated
- [ ] Review (High, `/security-review`), merge; Windows at Gate 2

## Phase 4: PR 3, what goes and the guard (W3; R3, R4, R5, R8)

- [ ] Boundary and exclusion tests first, failing (S8–S13, Windows path cases included)
- [ ] `src/publish/gather.ts`, `secretScan.ts` (fixtures assembled at run time), `publishRecords.ts`
- [ ] `webview/components/publish/PublishSheet.tsx` on `ui/dialog.tsx`: the what-goes line, See the files, Left out with its five reasons (R5, S7–S13); the key warning in ink, Cancel main, Publish anyway, Open file at line (R4, S14); every button the shared Button with a tooltip; screenshots to the lead
- [ ] `REVIEW.md`: `src/publish/` in the High row
- [ ] Review (High, `/security-review`), Windows overlay, merge

## Phase 5: PR 4, Cloudflare (W4, W5, W6; R6, R7, R9)

- [ ] `setApiKey` allowlist with its failing-first test (`RitemarkSettingsProvider.ts:382–389`)
- [ ] `src/publish/host.ts`; `cloudflare/client.ts` against a fake server; `redact()` on every error
- [ ] `cloudflare/oauth.ts`, `config.ts` (the esbuild define), `account.ts` (SecretStorage, refresh, Disconnect); the token path: `publish:startTokenEntry` (no value) → Cloudflare's page + the host's password box with the lead's words and three outcomes (R6, S20, S20a)
- [ ] The workers.dev name row in the first sheet (R5, S28a)
- [ ] Settings ▸ Sharing ▸ Web pages: the card's two states, the published pages with Open and Unpublish, Disconnect's question (R9, S22, S30)
- [ ] The bar's states, Unpublish's question, "Unpublishing…", the 10 s line, the failure line (R7, S24–S29)
- [ ] `web-page-publishing` (registered in PR 1): gates creating, connecting, publishing and updating; the list, Unpublish and Disconnect stay with it off (S28b)
- [ ] **After A4:** `scripts/qa/cloudflare-contract.mjs` green; S17–S28b live on the Mac; S21's log search
- [ ] Review (High, `/security-review`), Windows overlay (offline scenarios; live when the Windows vault exists), merge

## Phase 6: QA and closeout

- [ ] Every scenario S1–S32 in `qa-evidence.md` with its result, or why it couldn't run
- [ ] Every Worker the runs created is deleted (the contract script's list is empty)
- [ ] `docs/user/` page; `docs/development/architecture.md`'s publish subsystem; release-notes line (the `release-notes` skill)
- [ ] The release plan's tracker rows; ritemark-dev `governance/test-keys.md` row 6 (the manager)
