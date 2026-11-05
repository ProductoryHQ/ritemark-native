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
- **The page can't reach Ritemark.** It stays in Ritemark's own browser: its own process, no VS Code API, no node (`page-sandbox.md`). No custom webview.
- **Cloudflare is the first place, not the only one.** The code has one host interface; the words say "your Cloudflare" only where they name the place.
- **Plain words** (the lead's principle 5): Publish, Copy link, Update the page, Unpublish. Never "HTML", "deploy", "Worker" or "host" on screen.

## Requirements

### R1: An .html file opens on the desk as the page, safely

- Any `.html`/`.htm` file opens as a desk tab in Ritemark's own browser, as today (patch 010's resolver). No new viewer.
- The page's scripts run and CDN scripts load; the page can't reach the extension, the VS Code API, the workbench, `file://` reads by `fetch`, or open pop-ups (the spike's escape table, run live: A2).
- **The session stays the browser's shared one** (Jarmo, decision 4: no private session). A page shares `workbench.browser.dataStorage`'s session with other tabs, as today; A2 records what that means, and nothing in 2.2 changes it.
- **No address row for a local page** (the lead, answer 2): its bar is frame 1's, with the page's buttons at the right and nothing else. The tab's name says which file it is; `file:///…` is never shown.
- **No back or forward:** a link to a website opens a new tab of Ritemark's browser; a link to another page in the project opens that page in its own tab. A page's tab always shows its file.
- **The page reloads when its file changes** (for example after Claude changed it), as a document does. If that can't be built in this sprint, the reload button stays at the bar's left until it can.
- The text view stays reachable (`ritemark.browser.openAsText`, today's Explorer menu).
- The browser's control consent and the share-with-AI question stay as they are.
- Lands in **PR 2** (patch 010); A2 runs on PR 1.

### R2: The page's bar: Open in browser and Publish

- **On the page's own bar, at its right end, as frame 1 draws them, never in the tab row** (the lead, answer 1). Patch 010 adds them to `MenuId.BrowserActionsToolbar` (PR 2).
- **Open in browser** is an icon button (`arrow-square-out`), tooltip "Open in your browser". It opens the file in the system's default browser (`vscode.env.openExternal`) and shows for **every local `.html` page, inside the project or not**. Today's `ritemark.browser.openInBrowser` opens the *integrated* browser; its title and behaviour stay, and the new command is separate.
- **Publish** is the outline button with the globe, and shows **only for a page inside the open project**: publishing is for project files. Once published, frame 4's chip "Published ⌄" and Copy link take its place.
- Two workbench context keys, set from the tab's URL in patch 010: `ritemarkBrowserLocalPage` (`file:` and `.html?`) gates Open in browser; `ritemarkBrowserProjectPage` (also inside a workspace folder) gates Publish. The host checks the project boundary again by `realpath` before any publish.
- A web address keeps today's bar.

### R3: What goes up (the gather)

- Ritemark reads the page and lists the **local files it points to**: `src`, `href` on `link`/`a` to a local file the page uses (stylesheet, icon, picture, script, font, video), `srcset`, `poster`, CSS `url()` and `@import` in `<style>`, `style=""` and linked stylesheets (recursively through linked CSS), and `<script type="module">` static imports of local files.
- **Inside the project only.** Each reference is resolved against the page's folder, decoded, normalised and `realpath`ed; anything that lands outside the project folder (by `..`, an absolute path, a `file://` URL, a drive letter, a UNC path or a symlink) is **left out and named** in the sheet.
- **Never:** any path with a segment that starts with `.` (`.env`, `.git`, `.ritemark`, `.claude`, `.vscode`…), `node_modules`, and files Git ignores in the project (when Git is there). A reference to one is left out and named.
- **Not followed:** links to other `.html` pages don't go up (one page per publish, *Decisions* below); they are named as left out.
- Remote references (`https:`, `//cdn…`, `data:`) stay where they are and go nowhere.
- **A `../` that stays inside the project goes up** (A3, finding 1: `../tokens.css` from `slides/index.html`). The published tree is rooted at the deepest folder that holds the page and every gathered file, so each file keeps its path relative to the page. A reference that leaves the project as written is outside even when a symlink brings it back in.
- `<base href>` is honoured as the browser honours it; a remote base makes every relative reference remote. `//cdn…` is a web address and stays one.
- References the gather can't see (built by a script at run time) are not guessed; the sheet says so in one line (R5).
- **Git fails closed:** when the project is in a Git repository and Ritemark can't ask Git what it ignores, nothing is gathered and nothing goes.
- Free-plan limits are checked before anything goes: 25 MiB a file, 20,000 files. Over a limit: one plain line, nothing sent.
- Lands in **PR 3**.

### R4: The guard: things that look like keys

- Every text file that would go up is scanned for things that look like keys or passwords: private-key blocks, the common key prefixes (Anthropic, OpenAI, Google, AWS, GitHub, Slack, Stripe, Cloudflare), `Bearer` headers, JWTs, and `password=`/`api_key=`-style assignments with long values.
- **A hit holds Publish** (Jarmo, decision 2; the lead, answer 4). A line in the sheet, above the "Anyone with the link" note, in ink with `shield-warning` (no amber, no red): "This looks like a key or password: script.js, line 12. Anyone with the link could read it and use it." With more than one: "3 things look like keys or passwords:", up to three places, then "and 2 more". The value itself is never shown.
- **Open script.js** after the line opens the file at that line. Publishing again rescans.
- **Cancel becomes the sheet's main button; Publish reads "Publish anyway"**, the quiet button. Bar → Publish → Publish anyway is the second explicit press.
- The scan runs again on every Update the page.
- Lands in **PR 3**.

### R5: The Publish sheet: what will be public, before the first publish

Frame 3, one small sheet over the page:
- **Where:** your Cloudflare (the account's name), with Change.
- **The workers.dev name, once** (the lead, answer 5): in the first sheet after connecting, when the account has none (M2), one row above Address: "Your pages' addresses end in" `[ pages-4821 ].workers.dev`, pre-filled with "pages" and four digits, never the person's or company's name. Under it, muted: "The same for all your pages. You can change it in Cloudflare later." Taken or not allowed: "This name is taken. Try another.", and Publish waits. The row doesn't come back afterwards.
- **The address**, editable, made web-safe, shown as typed: `harbour-programme-7f3a2c.pages-4821.workers.dev`. The random part ends the page's part (Jarmo, decision 3), and the whole page part stays editable.
- **What goes** (the lead, answer 3):
  - The line: "This page and its 2 pictures" when every file is one kind (pictures, styles, scripts, fonts); "This page and 4 files" when they're mixed; "This page, one file" when it uses nothing else. Under it, muted: "Nothing else from the project."
  - **See the files**, folded at first: each file's name and folder, as Search's rows show them (`harbour.jpg` · Pictures), the page first.
  - **Left out**, in the same fold, only when something is: "2 left out", each with its reason: "outside this project", "a hidden file", "a tool's folder" (`node_modules`), "Git ignores it", "another page, so its link won't work".
  - Several other pages fold into one Left out row: "7 other pages, so their links won't work" (A3, finding 3).
  - When the page builds file names in its script, one muted line under the count: "This page loads some files from its script. Ritemark can't see which, so they won't go." (A3, finding 2).
  - Nothing can be ticked or unticked: what goes follows from the page.
- **Who can see it:** anyone with the link; it isn't listed or searchable; you can unpublish it any time.
- **Publish** and **Cancel.** Cancel sends nothing.
- The sheet shows every time the list of files that goes changes from the last publish. Otherwise Update the page goes straight up.
- Lands in **PR 3** (the sheet), wired in **PR 4** (the account and the name row).

### R6: Connect Cloudflare

- **The first time** (frame 2): "Where should your web pages go?", with Cloudflare. Connect opens the system browser at Cloudflare's consent page: **OAuth Authorization Code with PKCE (S256)**, a random `state`, no client secret, the narrowest scope that publishes (M13). The callback is a one-shot `127.0.0.1` listener on an OS-assigned port, or `ritemark://`, whichever Cloudflare accepts (M12), on the pattern of `src/googleDocs/oauth.ts`.
- **The client ID is public build configuration** (`RITEMARK_CLOUDFLARE_CLIENT_ID`, injected by esbuild's `define` as Google's is). A build without it offers the token path only and says nothing about OAuth.
- **The fallback, a token** (the lead, answer 8). "Use a token instead" opens Cloudflare's token page, filled in where Cloudflare allows (the name "Ritemark" and the permissions publishing needs), **and at the same time the host's own password box, never a webview:** `vscode.window.showInputBox({ password: true })`, title "Cloudflare token", prompt "Paste the token Cloudflare showed you. Ritemark keeps it on this computer." Ritemark checks it at once (M1, M10):
  - it works: connected, and the Settings row shows Connected;
  - Cloudflare refuses it: "Cloudflare didn't accept this token. Copy it again from Cloudflare's page.";
  - it can't publish: "This token can't publish pages. Make a new one on the page Ritemark opened.";
  - on either failure the box stays open with the words under it. Nothing in Ritemark names a permission; "API", "Worker" and "scope" stay off screen.
- **Storage:** one SecretStorage entry, `ritemark.publish.cloudflare.v1` (kind, account ID and name, tokens, expiry), written only by the host. Refreshes share one request; a refused refresh turns into "Connect again".
- **Disconnect** (Settings ▸ Sharing ▸ Web pages) asks once (R9), deletes the entry and revokes the OAuth grant where Cloudflare offers it (M14). Published pages stay published and say "Connect again to update or unpublish".
- Ritemark never makes a Cloudflare account for the person.
- Lands in **PR 4**.

### R7: Publish, Copy link, Update the page, Unpublish

- **Publish** uploads the gathered files as one assets-only Worker named from the address, with `X-Robots-Tag: noindex` on `/*` (no `robots.txt` block) and `previews_enabled: false` (the spike's six calls, plain `fetch`, no new dependency). "Publishing…" while it runs; nothing else waits.
- **Published:** the bar says Published with Copy link beside it; its menu holds Open the page (with its address), Update the page and Unpublish (frame 4).
- **Changed since publishing:** "Published · changed" when the hash of what would go differs from the last publish; Update the page is live, otherwise muted with "Up to date". Updating keeps the address; a file no longer used is gone from the page.
- **Unpublish** (the lead, answer 7) asks once: title "Unpublish Harbour programme?", body "The link stops working for everyone who has it. The file stays in this project.", **Cancel** and **Unpublish** (destructive red). While it goes, the chip reads "Unpublishing…" with the kit's turning mark and nothing else on the bar can be pressed; after 10 s one line under the bar: "Cloudflare is still taking the page down." When the address has stopped answering (M9), the bar shows Publish again, with no toast; publishing again offers the old address first. If it fails: "Ritemark couldn't reach Cloudflare. The page is still online." with Try again. It never says the page is down until it is.
- **Failed publish or update:** one line under the bar: "Ritemark couldn't reach Cloudflare. The page is still on this computer.", with Try again. Cloudflare's own error text is shown only with the token and account ID redacted.
- **Signed out:** the chip stays; Update and Unpublish ask to connect first.
- Lands in **PR 4**.

### R8: Where it was published is remembered on this computer

- Per file, in the extension's global storage (`publish/v1/`), never in the project: the account ID, the Worker's name, the address, the files and their hashes at the last publish, the date. A shared folder carries nobody's account.
- A moved or renamed file loses its record (it shows Publish again); the old page stays up until unpublished from Settings ▸ Sharing ▸ Web pages (R9).
- Lands in **PR 3** (the store), used in **PR 4**.

### R9: Settings ▸ Sharing ▸ Web pages

A card like Google Docs', in Sprint 147's Sharing section, under Web pages (the lead, answer 6):

| State | The row | Buttons |
| --- | --- | --- |
| Not set up | Where your web pages go. Not set up. The first Publish asks; Cloudflare is free. A muted line: "Have a Cloudflare token? Use it instead" | Set up |
| Connected | Your Cloudflare. Connected as <the account's name>. Your pages end in pages-4821.workers.dev. | Disconnect |

- **Published pages,** under the connected row, only when there are some: the file's name with its address muted under it, **Open** (the published page, in the system browser) and **Unpublish** (R7's question), including pages whose file has moved or gone.
- **Disconnect asks once:** "Disconnect Cloudflare? Your published pages stay online. To take one down, unpublish it first." with Cancel and Disconnect.
- **The token never passes through the webview** (the principle above). The page sends only `publish:connect`, `publish:startTokenEntry` (the host then opens Cloudflare's page and its own password box, R6), `publish:disconnect`, `publish:open` and `publish:unpublish`. No message from the page carries a token value, and no message to the page does.
- **With the flag off** (sprint-plan.md, *Feature Flag Check*): the published-page list with Open and Unpublish stays; the row offers no Set up, Use a token or Connect.
- Lands in **PR 4**.

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
- Blocking a page's reach to the person's own `127.0.0.1` servers (Jarmo, decision 5: noted, not built).
- A private session for local pages (Jarmo, decision 4: no).
- Publishing several pages as one site.

## Decisions

The engineering choices are approved with the plan; Jarmo's, with his answers, are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo).

- **One page per publish:** a Worker holds one page and the files it uses. Links to other pages in the project are named as not working.
- **The page stays in Ritemark's browser** (spike, 29 October). No custom webview.
- **No agent tool publishes.** `src/runtime/ritemarkTools.ts` gains nothing.
- **Records on this computer, token in SecretStorage,** both outside the project.
- **The integrated-browser `Open in browser` command keeps its meaning;** the system-browser action is a new command.
