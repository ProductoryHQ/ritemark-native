# Sprint 149 Spec: Publish a web page

## Purpose

People who share ideas for a living need a link anyone can open. Today an `.html` file in a Ritemark project already opens on the desk as a page, in Ritemark's own browser (patch 010), but it can't reach anyone. This sprint gives that page tab **Open in browser** and **Publish**: the page and the files it uses go to the person's own Cloudflare account, kept out of search, and afterwards the page has **Copy link**, **Update the page** and **Unpublish**. Connect Cloudflare is OAuth with PKCE, with a token link as the fallback (#590).

The drawing: ritemark-dev `product/design/experience/experiences/publish/` (experience 39: README, frames 1–4 in Light and Dark, `publish.html`). The facts: ritemark-dev `releases/v2.2.0/analysis/2026-10-29-spikes/` (`web-page-publish.md`, `page-sandbox.md`, `cf-publish-spike.mjs`, `hostile.html`).

## Principles

- **The page is the person's.** Nothing leaves the computer until the person presses Publish (or Update the page) themselves. No AI tool, Flow, schedule or start-up path publishes, updates or unpublishes.
- **They see exactly what goes before it goes.** The sheet lists every file that will be public, and says that anyone with the link can open it.
- **Only what they chose.** The page and the local files it points to inside the project, never anything else: no dot folders, no other files from the folder, nothing outside the project.
- **Out of search by default,** and **Unpublish really removes it.**
- **A key never leaves the part of Ritemark that stores it.** The Cloudflare token lives in VS Code SecretStorage on the extension host. It never goes to a webview, a log, the project, a setting or a message.
- **The page can't reach Ritemark.** It stays in Ritemark's own browser: its own process and session, no VS Code API, no node (`page-sandbox.md`). No custom webview.
- **Cloudflare is the first place, not the only one.** The code has one host interface; the words say "your Cloudflare" only where they name the place.
- **Plain words** (the lead's principle 5): Publish, Copy link, Update the page, Unpublish. Never "HTML", "deploy", "Worker" or "host" on screen.

## Requirements

### R1: An .html file opens on the desk as the page, safely

- Any `.html`/`.htm` file in the project opens as a desk tab in Ritemark's own browser, as today (patch 010's resolver). No new viewer.
- The page's scripts run and CDN scripts load; the page can't reach the extension, the VS Code API, the workbench, `file://` reads by `fetch`, other tabs' storage, or open pop-ups (the spike's escape table, run live: A2).
- **A page from the project gets an Ephemeral session** (recommended, decision 4): today every browser tab uses `workbench.browser.dataStorage`'s Global session, because Ritemark turns workspace trust off, so a local page would share cookies and storage with every site the person signed in to in Ritemark's browser.
- The text view stays reachable (`ritemark.browser.openAsText`, today's Explorer menu).
- The browser's control consent and the share-with-AI question stay as they are; a page tab is never shared with the AI without the existing question.

### R2: The page's bar: Open in browser and Publish

- A page tab whose address is a `file://` `.html` inside the open project shows **Open in browser** (the system browser) and **Publish** on its bar, where frame 1 draws them (A1 decides how they get there; question 1).
- Open in browser opens the file in the person's default browser (`vscode.env.openExternal` on the file URI). Today's `ritemark.browser.openInBrowser` opens the *integrated* browser; its title and behaviour stay, and the new command is separate.
- A page outside the project, or a web address, shows neither.

### R3: What goes up (the gather)

- Ritemark reads the page and lists the **local files it points to**: `src`, `href` on `link`/`a` to a local file the page uses (stylesheet, icon, picture, script, font, video), `srcset`, `poster`, CSS `url()` and `@import` in `<style>`, `style=""` and linked stylesheets (one level deep and recursively through linked CSS), and `<script type="module">` static imports of local files.
- **Inside the project only.** Each reference is resolved against the page's folder, decoded, normalised and `realpath`ed; anything that lands outside the project folder (by `..`, an absolute path, a `file://` URL, a drive letter, a UNC path or a symlink) is **left out and named** in the sheet.
- **Never:** any path with a segment that starts with `.` (`.env`, `.git`, `.ritemark`, `.claude`, `.vscode`…), `node_modules`, and files Git ignores in the project (when Git is there). A reference to one is left out and named.
- **Not followed:** links to other `.html` pages (`<a href="other.html">`) don't go up (one page per publish, *Decisions* below); they are named as "links that won't work".
- Remote references (`https:`, `//cdn…`, `data:`) stay where they are and go nowhere.
- References the gather can't see (built by a script at run time) are not guessed. The sheet doesn't promise they work; Update the page fixes a missed file once the person adds it to the page.
- Free-plan limits are checked before anything goes: 25 MiB a file, 20,000 files. Over a limit: one plain line, nothing sent.

### R4: The guard: things that look like keys

- Every text file that would go up is scanned for things that look like keys or passwords: private-key blocks, the common key prefixes (Anthropic, OpenAI, Google, AWS, GitHub, Slack, Stripe, Cloudflare), `Bearer` headers, JWTs, and `password=`/`api_key=`-style assignments with long values.
- A hit **holds Publish**: the sheet names the file and line (the value itself is masked) and says it looks like a key. What the person can then do is decision 2 (recommended: remove it and try again, or "Publish anyway" behind a second, explicit press).
- The scan runs again on every Update the page.

### R5: The Publish sheet: what will be public, before the first publish

Frame 3, one small sheet over the page:
- **Where:** your Cloudflare (the account's name), with Change.
- **The address**, editable, made web-safe: `https://<page-name>.<account>.workers.dev/`. Its default carries a random part (decision 3).
- **What goes:** "This page and its 2 pictures", the full list one click away; what was left out and why (outside the project, a hidden file, a link to another page).
- **Who can see it:** anyone with the link; it isn't listed or searchable; you can unpublish it any time.
- **Publish** and **Cancel.** Cancel sends nothing.
- The sheet shows every time the list of files that goes changes from the last publish (a new file, a file left out). Otherwise Update the page goes straight up.

### R6: Connect Cloudflare

- **The first time** (frame 2): "Where should your web pages go?", with Cloudflare. Connect opens the system browser at Cloudflare's consent page: **OAuth Authorization Code with PKCE (S256)**, a random `state`, no client secret, the narrowest scope that publishes (M13). The callback is a one-shot `127.0.0.1` listener on an OS-assigned port, or `ritemark://`, whichever Cloudflare accepts (M12), on the pattern of `src/googleDocs/oauth.ts`.
- **The client ID is public build configuration** (`RITEMARK_CLOUDFLARE_CLIENT_ID`, injected by esbuild's `define` as Google's is). A build without it offers the token path only and says nothing about OAuth.
- **The fallback, a token link:** "Use a token instead" opens Cloudflare's pre-filled account-token form with Workers Scripts Edit only; the person creates it, copies it, and pastes it into one field in Ritemark. Ritemark checks it (M1, M10) before saving it.
- **Storage:** one SecretStorage entry, `ritemark.publish.cloudflare.v1` (kind, account ID and name, tokens, expiry). Refreshes share one request; a refused refresh turns into "Connect again".
- **Disconnect** (Settings ▸ Sharing ▸ Web pages) deletes the entry and revokes the OAuth grant where Cloudflare offers it (M14). Published pages stay published and say "Connect again to update or unpublish".
- Ritemark never makes a Cloudflare account for the person.

### R7: Publish, Copy link, Update the page, Unpublish

- **Publish** uploads the gathered files as one assets-only Worker named from the address, with `X-Robots-Tag: noindex` on `/*` (no `robots.txt` block) and `previews_enabled: false` (the spike's six calls, plain `fetch`, no new dependency). "Publishing…" while it runs; nothing else waits.
- **Published:** the bar says Published with Copy link beside it; its menu holds Open the page (with its address), Update the page and Unpublish (frame 4).
- **Changed since publishing:** "Published · changed" when the hash of what would go differs from the last publish; Update the page is live, otherwise muted with "Up to date". Updating keeps the address; a file no longer used is gone from the page.
- **Unpublish** asks once, then deletes the Worker. Ritemark checks the address stops answering with the page (M9) before it says "Unpublished"; until then it says "Taking the page down…". Publishing again offers the old address first.
- **Failed:** one line under the bar: "Ritemark couldn't reach Cloudflare. The page is still on this computer.", with Try again. Cloudflare's own error text is shown only with the token and account ID redacted.
- **Signed out:** the chip stays; Update and Unpublish ask to connect first.

### R8: Where it was published is remembered on this computer

- Per file, in the extension's global storage (`publish/v1/`), never in the project: the account ID, the Worker's name, the address, the files and their hashes at the last publish, the date. A shared folder carries nobody's account.
- A moved or renamed file loses its record (it shows Publish again); the old page stays up until unpublished from Settings ▸ Sharing ▸ Web pages, which lists every published page with Unpublish (R9).

### R9: Settings ▸ Sharing ▸ Web pages

- Sprint 147's Sharing section gains one row: Web pages, with the connected account and Disconnect, or Connect Cloudflare and Use a token instead.
- The pages published from this computer, each with Open and Unpublish, including those whose file has moved or gone.
- The page never receives the token: it sends "connect", "save this token" (the value goes once, to the host, and is never sent back) and "disconnect".

## Engineering requirements

### E1: Each check fails first

Each fix or guard has a test that fails without it: the boundary cases (R3), the scanner (R4), the token never in a webview message (R6), the noindex header in the deploy body (R7). Live checks run against the test account through the vault script, on the branch, before the merge.

### E2: Tiers

PRs 3 and 4 are **High** by content, not by path: they decide what goes public and they hold the token and OAuth (`REVIEW.md` lists `src/settings/` key handling and OAuth files; PR 3 adds `src/publish/` to its High row). PR 2 is shell-tier, so High. `/security-review` on every High PR.

### E3: No secret in the repo or the bundle

No client secret exists (PKCE, auth `none`). The client ID is public. Test keys reach a test process only through `scripts/qa/with-test-keys.sh` (written in PR 1, per ritemark-dev `governance/test-keys.md`); no session types, prints or sees a key.

### E4: Bundle

No new npm dependency. `media/webview.js` size recorded before and after (`notes/bundle.md`).

### E5: Docs

`docs/user/` gains "Publish a web page" (what goes, who can see it, Unpublish); `docs/development/architecture.md` gains the publish subsystem; the release-notes line at Phase 4.

## Non-requirements

- A link between a document and its page, or Update from a document (the lead's "Not on it").
- Editing the page on the desk; Ritemark's own renderer; experience 37's `:::` elements.
- Invited-only pages (Cloudflare Access), view counts, custom domains, other hosts (Netlify is the noted fallback, not built).
- Making the page: the AIs already write HTML files when asked; Ritemark adds no instructions.
- Blocking a page's reach to the person's own `127.0.0.1` servers (decision 5).
- Publishing several pages as one site.

## Decisions

The engineering choices are approved with the plan; the six for Jarmo are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo).

- **One page per publish:** a Worker holds one page and the files it uses. Links to other pages in the project are named as not working.
- **The page stays in Ritemark's browser** (spike, 29 October). No custom webview.
- **No agent tool publishes.** `src/runtime/ritemarkTools.ts` gains nothing.
- **Records on this computer, token in SecretStorage,** both outside the project.
- **The integrated-browser `Open in browser` command keeps its meaning;** the system-browser action is a new command.
