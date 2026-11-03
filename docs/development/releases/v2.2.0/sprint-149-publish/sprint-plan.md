# Sprint 149: Publish a web page

Track: SDD (auto-detected: a new subsystem that sends the person's files to the internet, an OAuth connection and a stored token, a third-party API proven only on paper, and a possible shell change)
Override with: "use plain full track"
Branch: `sprint-149-publish`, made from `origin/main` at Phase 3, after approval. Each later PR has its own branch that starts with the same name (*Pull requests* below). This plan was written on `plan/v2.2.0-sprint-149`.
Release tier: **shell, if A1 or decision 4 needs patch 010** (PR 2); everything else is extension-tier. 2.2 is a shell release ([release-plan.md](../release-plan.md)), so this adds no release step.
Status: **To approve.** Jarmo has delegated 2.2's plan approvals to the Development manager until the release candidate (ritemark-dev `decisions/log.md`, c45d69c). The release plan holds 149's approval until the live measurements decide the upload and the connection: this plan asks the manager to approve it now with **PR 4's merge gated on A4** (*Pre-Implementation Gate*). The code named under *What reading the code added* was read for the plan, not run.

## SDD Artifacts

- [spec.md](spec.md): R1–R9 and E1–E5, the principles and the engineering decisions.
- [scenarios.md](scenarios.md): S1–S32, the QA list, with the negative cases for the boundary, the guard and the token.
- [technical-plan.md](technical-plan.md): what exists today with `file:line`, the four audits (A4 holds **the 14 live measurements**), workstreams W0–W6, risks.
- [tasks.md](tasks.md): the checklist by phase.
- This file: intent, PRs, cut order, decisions, and the questions at the end.
- `research/` is not created yet. Phase 1 writes one file per audit there.

## Goal

2.2's story, and it can't be cut: an `.html` file in the project is the page on the desk, with Open in browser and Publish. Publish puts it, and only the files it uses, on the person's own Cloudflare, kept out of search, after a sheet that shows exactly what will be public. Afterwards: Copy link, Update the page, Unpublish, and Unpublish really takes it down. Connect Cloudflare is two clicks by OAuth with PKCE, or a pasted token.

## Linked Issues

| Issue | What | Req | Seen so far |
|---|---|---|---|
| [#590](https://github.com/ProductoryHQ/ritemark-native/issues/590) | The epic: a page on the desk; Publish to the person's own Cloudflare; Copy link, Update, Unpublish; noindex | R1–R9 | The drawing (experience 39, 28 October); the spikes (29 October); no live call yet |

## What reading the code added

- **The page already opens safely, but in the shared session.** Patch 010's resolver sends every `file://` `.html` to Ritemark's browser (`010-…patch:179–187`), in its own sandboxed process. But its session is `workbench.browser.dataStorage`'s Global one, since Ritemark turns workspace trust off (`vscode/…/browserView/common/browserView.ts:350–361`). A local page would share cookies with every site the person signed in to in Ritemark's browser. Decision 4 proposes Ephemeral for project pages: a small patch 010 change.
- **The bar isn't open to extensions.** The browser's toolbar is `MenuId.BrowserActionsToolbar` (`actions.ts:305`), which `menusExtensionPoint.ts` doesn't expose, and the page tab's resource is `vscode-browser:`, not the file (`browserEditorInput.ts:161–162`), so no `when` clause sees `.html`. A1 tries `editor/title` with an extension context key first; if Publish can't sit on the bar that way, PR 2 adds it in patch 010 (shell-tier).
- **"Open in browser" already exists and means the other browser.** `ritemark.browser.openInBrowser` opens Ritemark's *integrated* browser (`extension.ts:1046–1062`), offered in the Explorer and text-editor menus. The drawing's Open in browser is the system browser: a new command, the old one unchanged.
- **The Settings page can write any secret.** `setApiKey` stores whatever `message.key` names (`RitemarkSettingsProvider.ts:382–389`). Once the Cloudflare token is in SecretStorage, the page could overwrite it. PR 4 adds an allowlist of today's five key names, with a failing-first test: an adjacent defect in the file the PR changes.
- **Google's sign-in is the pattern, nearly whole.** Loopback on `127.0.0.1:0`, S256 PKCE, a checked `state`, a deadline, the listener closed on every exit (`googleDocs/oauth.ts:135`, `:178–179`, `:207`, `:260`); the client ID as public build configuration through esbuild's `define` (`esbuild.config.mjs:91–93`, `googleDocs/config.ts`); one SecretStorage entry with a single-flight refresh (`GoogleAccountService.ts:228–243`). Cloudflare needs no client secret at all (auth `none`).
- **Records go where Google's go:** the extension's global storage (`GoogleDocsBindingStore.ts:29–30`), not the project.
- **Settings ▸ Sharing is ready for the row** (`settingsSections.ts:25`, "Where your copies and pages go when you share them"), beside the Google Docs card.
- **The vault script doesn't exist yet** (`scripts/qa/` has none; `governance/test-keys.md` *Next* 2). PR 1 writes it, since the live measurements must run through it.
- **The spike's prototype uploads a whole folder** (`cf-publish-spike.mjs`). The product uploads only the page and what it references (R3); that gather is new code and the sprint's main safety work.

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| The page on the desk, isolated | R1 | A2 live on a dev instance (S5, S6) |
| Open in browser and Publish on the bar | R2 | S1–S4, screenshots to the lead |
| Only the page and its files, inside the project | R3 | Boundary tests first (S7–S13), A3's corpus |
| Things that look like keys hold Publish | R4 | Scanner tests (S14) |
| The sheet shows what will be public | R5 | S7, S16, S27 |
| Connect: OAuth with PKCE, the token link | R6 | S17–S23, M1, M10, M12–M14 |
| Publish, Copy link, Update, Unpublish; noindex | R7 | S24–S29, M2–M9 |
| Records on this computer | R8 | S30, S32 |
| Settings ▸ Sharing ▸ Web pages | R9 | S22, S30 |

**Not in this sprint:** a link from a document to its page; editing the page on the desk; invited-only pages, view counts, custom domains; other hosts; several pages as one site; blocking a page's reach to the person's own local servers (decision 5).

## Pull requests

Four. The High paths sit in PRs 3 and 4; the two that need no account come first. Each PR's Risk section names its tier and the paths that set it. Findings are answered and the merge is at the reviewed head (`REVIEW.md`, *Before the merge*).

| PR | Branch | Holds | Before the account? | Release tier | Review tier |
|---|---|---|---|---|---|
| 1 | `sprint-149-publish` | The vault script (W0); Open in browser (system) and the context key (W1); A1, A2, A3's research | **Yes** | extension | Standard (`src/browser/`, `scripts/qa/`). Screenshots of the bar to the lead |
| 2 | `sprint-149-publish-shell` | Only if A1 or decision 4 needs it: Open in browser and Publish in `MenuId.BrowserActionsToolbar`; the Ephemeral session for project pages (W1, W2) | **Yes** | **shell** (`patches/vscode/010-…`) | **High** (shell-tier list). `/code-review` at high + `/security-review`; proof: A2 before and after, the frame check, Windows at Gate 2 |
| 3 | `sprint-149-publish-gather` | What goes and the guard: the gather, the boundary, the exclusions, the key scan, the Publish sheet, the records (W3). No network; Publish isn't reachable from any menu until PR 4 | **Yes** | extension | **High** by content: it decides what becomes public. `src/publish/` joins `REVIEW.md`'s High row in this PR. `/code-review` at high + `/security-review` |
| 4 | `sprint-149-publish-cloudflare` | The Cloudflare client, the connection (OAuth + token), SecretStorage, Settings ▸ Sharing ▸ Web pages, the `setApiKey` allowlist, the states, the flag (W4–W6) | Code yes; **merge no**: it waits on A4's measurements | extension | **High**: token storage and OAuth, the key handling in `src/settings/`, the upload. `/code-review` at high + `/security-review`; proof: S17–S29 live, S21's search |

**Order:** PR 1 first (A1–A3 run on it). PR 2 once A1 and A2 answer, if needed. PR 3 alongside, after A3. PR 4's code from the start against a fake server; its live runs and merge after A4, and after PR 3.

**Between merges `main` stays releasable:** PRs 1–3 add nothing a person can press that doesn't work. PR 1's Open in browser works on its own; PR 3's sheet has no way in until PR 4.

## Cut order

The item can't be cut; parts of it can, the first first:

1. **OAuth** (M12–M14, the client registration). If Cloudflare's client is late, 2.2 ships with the token link alone, and Connect by OAuth follows in an extension release.
2. **Settings' list of published pages** (R9's second half): the row keeps Connect and Disconnect; Unpublish stays on each page's tab.
3. **"Published · changed"** (R7): Update the page stays live always.

Not cut: the page on the desk, the gather and its boundary, the key scan, the sheet, noindex, Unpublish that really removes, the token kept on the host.

## Windows

- **PRs 1, 3 and 4 are extension-tier,** so each goes through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`) by the "Ritemark on Windows" session, at 100% and 150%, Light and Dark.
- **The gather on Windows:** drive letters, backslashes, UNC paths, case-insensitive project boundaries, OneDrive folders (S11).
- **The loopback sign-in on Windows:** whether the firewall asks on the `127.0.0.1` listener (Google's flow was never checked on Windows: `governance/test-keys.md`).
- **PR 2, if built,** at Gate 2 with the release.
- **The live runs need the Windows vault** (`test-keys.ps1`, not written). Until then Windows runs the offline scenarios, and the live ones run on the Mac only; the plan says so in QA evidence.

## Product Decisions

- **2026-10-28 (Jarmo):** a local HTML page, then the published page; not tied to a document.
- **2026-10-29 (Jarmo):** publishing is in 2.2; the spikes' answers (Ritemark's browser, Workers static assets, OAuth with a token fallback).
- **2026-10-31 (the release plan):** item 1 can't be cut; 149 waits on the Cloudflare test account and its measurements.
- **Engineering, in this plan (approved with it):**
  - One page per publish; links to other pages are named as not working.
  - Only files inside the project, never dot folders, `node_modules` or Git-ignored files.
  - The token goes in through the host's own password box, never through a webview.
  - No AI tool, Flow or schedule can publish, update or unpublish.
  - "Unpublished" shows only after the address stops answering.
  - The system-browser Open in browser is a new command; the integrated one keeps its meaning.
  - The Settings page's `setApiKey` takes only today's five key names.

## Decisions for Jarmo

Six. Each says what you'd do, and what's recommended.

1. **The Cloudflare test account and its token.** Make a Cloudflare account for testing (free plan, not your own), then a token from Cloudflare's "Edit Cloudflare Workers" template limited to that account, and put the token in the Mac vault yourself, once: `security add-generic-password -U -s ritemark-test-keys -a cloudflare -w` (it asks for the value and doesn't show it). The account ID goes in the same way as `cloudflare-account-id`. No session ever types or sees either. The manager adds row 6 to the test keys registry. **This unlocks M1–M11.**
2. **Things that look like keys:** when the scan finds one, does Publish stop until it's removed, or can you go on? **Recommended:** it stops, with "Publish anyway" behind a second, explicit press, since a false alarm in a page about API keys shouldn't trap you, but a real key mustn't go by a single click.
3. **The address carries a random part,** for example `harbour-programme-7f3a2c.<your-name>.workers.dev`, so a guessed name doesn't find a page. **Recommended: yes**, editable in the sheet. (The drawing has the file's name alone; the spike recommends the random part.)
4. **Pages from the project open in a private session** that keeps no cookies from your browsing in Ritemark. **Recommended: yes.** What changes: a page that saves something in the browser (a checklist's ticks) forgets it when the tab closes. It needs a small change to patch 010.
5. **A page's scripts can still reach servers on your own computer** (for example Ollama), as in any browser. Ritemark's own servers aren't reachable that way. **Recommended: leave it in 2.2** and note it; blocking it needs a network rule on the browser's session and would break pages that use a local server on purpose.
6. **Cloudflare's OAuth client,** made once in Productory's Cloudflare account:
   - **First, a private test client** (no public step), so M12–M14 can be measured. **Recommended: now**, with the test account.
   - **Then the public client:** a name, a logo, `https://ritemark.app`, the scopes from M13, and a DNS TXT record on ritemark.app; going public can't be undone, and the verified app shows a blue shield. **Recommended:** after M12–M14, before 2.2's RC. If it isn't ready by then, 2.2 ships with the token link (cut order 1).

**The 14 live measurements** are in [technical-plan.md](technical-plan.md#the-14-live-measurements). M1–M11 need only decision 1's account and token; M12–M14 need decision 6's private client; none needs the public client. The page-in-a-dev-instance check (A2) needs neither.

## Feature Flag Check

One new flag, `web-page-publishing`, ON by default (HARD RULE #2), registered in `src/features/flags.ts` beside `google-docs-publishing`. It gates the Publish entry on the bar, the commands `ritemark.page.publish`, `…update`, `…unpublish`, the Connect flow and Settings ▸ Sharing ▸ Web pages, so a change in Cloudflare's API can be switched off by an extension release without touching the page on the desk. With it off, already-published pages stay listed in Settings with Unpublish (taking a page down must stay possible). Open in browser and the page itself need no flag. HARD RULE #1 holds: nothing is removed; today's `ritemark.browser.openInBrowser` stays.

## Testing

- **The Mac, here:** `npm test` (the gather's boundary and exclusion cases, the scanner with fixtures assembled at run time, the records, the OAuth attempt with a fake browser and clock, the client against a local fake server, the allowlist, "no token in any webview message"), webview tests, `tsc --noEmit`.
- **Live, against the test account:** `scripts/qa/cloudflare-contract.mjs` through `with-test-keys.sh` (A4, and before each release), and S17–S29 on a hidden dev instance (`open -n -g -j`, `--use-mock-keychain`, a short profile under `/private/tmp`, a free port, CDP input only). Every Worker a run creates, it deletes; the run's log is searched for the token (S21).
- **Isolated AI homes** for every launch; no launch while Jarmo is at the keyboard in the day.
- **Not here:** Windows (the overlay session); the public OAuth client (decision 6).

## Success Criteria

- [ ] An `.html` file in the project opens as the page, and `hostile.html` escapes nothing (S1–S6).
- [ ] Open in browser and Publish sit where frame 1 draws them, only for project pages (S1–S4).
- [ ] The sheet lists exactly what goes, and every boundary and exclusion case is left out and named (S7–S13).
- [ ] A key-shaped string holds Publish (S14).
- [ ] A page published live answers with `X-Robots-Tag: noindex`; Update keeps the address; Unpublish takes it down (S24–S28).
- [ ] Connect works by token, and by OAuth if decision 6's client exists (S17–S23).
- [ ] No token appears in any webview message, log, setting or project file (S21).
- [ ] Each check failed first, or the plan says why it couldn't (E1).

## Risks

| Risk | Retirement |
|---|---|
| Something goes public by accident | The gather's tests first, A3's corpus, the sheet's full list, High review (PR 3) |
| The upload API isn't as documented | A4 before PR 4's merge; the contract script before each release |
| The OAuth client is late | The token path alone (cut order 1) |
| The test account comes late | PRs 1–3 need none; PR 4's code runs on a fake server meanwhile |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Jarmo** for decision 1 (the test account and token) and decision 6 (the private OAuth client); the plan can be approved before either.
- **Sprint 147** merged (Settings ▸ Sharing exists on `main`: yes, `settingsSections.ts:25`).
- **The Experience lead** for the answers below, and screenshots before each UI merge.
- **The "Ritemark on Windows" session** for the overlay checks.

## Pre-Implementation Gate

- The plan is approved (*Approval* below), under Jarmo's delegation of 2.2's plan approvals (ritemark-dev `decisions/log.md`, c45d69c). A message from the manager carries it only by quoting the log's row (ritemark-dev `CLAUDE.md`, rule 7).
- **PR 4 merges only after A4:** M1–M11 measured, and `spec.md` changed first where a measurement says so. OAuth merges only after M12–M14; until then PR 4 ships the token path.
- Decisions 2–5 are asked of Jarmo; until he answers, the recommended answers are built, and each is one small change if he says otherwise.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [x] Plan approved on 3 November 2026 by the Development manager, on Jarmo's 2.2 delegation ("võta nii et kõik sprindid on 2.2 osas approved until RC - ei vaja heakskiitu", ritemark-dev `decisions/log.md`, 1 Nov).
- [ ] Decision 1: the test account and token in the vault (Jarmo). Asked on 3 Nov.
- [x] Decisions 2–5, answered by Jarmo on 3 November 2026:
  - 2: as recommended. A key-shaped hit stops Publish, and "Publish anyway" needs a second, explicit press.
  - 3: as recommended. The address carries a random part, editable in the sheet.
  - 4: **no.** Project pages keep the browser's shared session, as today. No patch 010 change is made for a private session, and PR 2 shrinks to what the Publish buttons need.
  - 5: as recommended. A page can still reach local servers in 2.2, and that is noted.
- [ ] Decision 6: the private OAuth client (Jarmo); the public one before the RC.
- [x] Sprint start: PR 1 and the audits now; PRs 2–3 after the lead's answers; PR 4's merge after M1–M14.
## Questions

**For the Experience lead:**

1. **Where do Open in browser and Publish sit?** The README's build notes say "a webview", but the page is Ritemark's browser tab, whose bar holds the address and the browser's buttons. Recommended: on the browser's bar, right of the address, as frame 1, which may need a patch (A1). If they go in the tab row's actions instead, no patch: is that acceptable?
2. **The address row on a page tab:** today it shows `file:///Users/…/Harbour programme.html`. Recommended: keep it (it's honest about where the page is), unless the lead wants the file's name there.
3. **What goes, with more than one file:** frame 3 says "this page, one file, and nothing else"; the build notes say "This page and its 2 pictures". Recommended: "This page and 4 files" with the list folded under it, and "Left out" as a second folded list with each reason in a few words (outside this project, a hidden file, a link to another page).
4. **The key warning** (not drawn): its words and place in the sheet. Recommended: "This looks like a key or password: script.js, line 12. Anyone with the link could read it." with Publish replaced by "Publish anyway" (decision 2).
5. **The account has no workers.dev name yet** (M2): the sheet's step to choose one isn't drawn. Recommended: one field in the first-time sheet, "Your pages' address will end in …workers.dev", pre-filled with a neutral name, not the person's.
6. **Settings ▸ Sharing ▸ Web pages:** the row and the list of published pages aren't drawn. Recommended: a card like Google Docs', with the account and Disconnect, then the pages, each with Open and Unpublish.
7. **Unpublish's question and "Taking the page down…":** words for the confirmation. Recommended: "Unpublish Harbour programme? The link will stop working. The file stays on this computer." with Unpublish and Cancel.
8. **The token path's words:** "Use a token instead" opens Cloudflare and then a password box in Ritemark. Recommended: the box says "Paste the token Cloudflare showed you", and nothing names permissions.

**For Jarmo:** decisions 1–6 above.
