# Sprint 149 Scenarios

Behaviour examples for [spec.md](spec.md). They are the manual QA list; `tasks.md` Phase 6 points here. S numbers are stable. "Live" means against the Cloudflare test account, launched through `scripts/qa/with-test-keys.sh` on a hidden dev instance with a test profile.

## The page on the desk (R1, R2)

- **S1.** Given `Harbour programme.html` in the project, when the person opens it from Documents, then it opens as a desk tab showing the page, with the browser's bar (back, forward, reload, the `file:///` address), and Open in browser (icon) and Publish right of the address, not in the tab row (4 November, 14e0d03).
- **S2.** Given that tab, when the person presses Open in browser, then the file opens in the system's default browser and the tab stays.
- **S3.** Given a web address open in Ritemark's browser, then the bar shows neither Open in browser nor Publish.
- **S4.** Given an `.html` file outside the project (dragged from Downloads), then it opens as the page with Open in browser on its bar and no Publish (publishing is for project files).
- **S4a.** Given a project page with a link to a website and a link to `appendix.html`, when the person clicks each, then each opens in the same tab, as in a browser, and back returns to the page; on the website the bar has neither button, back on the page both are there again (4 November, 14e0d03).
- **S4b.** Given a project page open on the desk, when Claude changes the file, then the page reloads by itself (upstream's auto-reload), and the reload button stays on the bar.
- **S5 (negative, A2).** Given `hostile.html` from the spike in the project, when it opens, then the CDN script loads, and `acquireVsCodeApi`, `window.browserViewAPI`, `fetch('file:///etc/hostname')`, `window.open`, top navigation and reading another tab's storage all fail; the workbench is a different CDP target.

## What goes (R3, R4, R5)

- **S7.** Given a page using `img/a.png`, `img/b.png` and `style.css` (which uses `fonts/x.woff2`), when Publish's sheet opens, then it reads "This page and 4 files" with "Nothing else from the project." under it, and See the files lists all four, the page first. A page using only two pictures reads "This page and its 2 pictures"; a page using nothing reads "This page, one file".
- **S7a.** Given `slides/index.html` using `../tokens.css` (still in the project), then `tokens.css` goes, and the published tree keeps `slides/index.html` beside it (A3, finding 1).
- **S7b.** Given a page that builds picture names in its script, then the sheet says "This page loads some files from its script. Ritemark can't see which, so they won't go." (A3, finding 2).
- **S8 (negative).** Given `<img src="../../secrets/scan.png">` reaching outside the project, then that file is left out and named "outside this project".
- **S9 (negative).** Given `<link href=".env">` or `<script src=".git/config">`, then each is left out and named "a hidden file".
- **S10 (negative).** Given `img/logo.png` that is a symlink to `~/Pictures/logo.png`, then it is left out as outside the project.
- **S11 (negative).** Given `src="%2e%2e/%2e%2e/x.png"`, `src="file:///Users/me/x.png"`, `src="C:\\Users\\me\\x.png"` or `src="\\\\server\\share\\x.png"`, then each is left out as outside the project (Windows cases on Windows).
- **S12.** Given a CDN script and a `data:` picture, then neither is in the list and both work on the published page.
- **S13.** Given `<a href="appendix.html">`, then Left out names it "another page, so its link won't work" and `appendix.html` doesn't go.
- **S14 (negative).** Given a script in the page holding a string that looks like an Anthropic key, then the sheet shows "This looks like a key or password: script.js, line 12. Anyone with the link could read it and use it." in ink, Cancel is the main button, Publish reads "Publish anyway", the value is never shown, and nothing is sent until Publish anyway is pressed. Open script.js opens the file at line 12.
- **S15 (negative).** Given a 30 MiB video the page uses, then the sheet says it is too big to publish and nothing is sent.
- **S16.** Given the sheet is open, when the person presses Cancel, then no network request to Cloudflare is made (checked in the host's request log of the test run).

## Connect (R6, R9)

- **S17 (live, M12–M14).** Given no connection, when the person presses Publish, then "Where should your web pages go?" shows; Connect opens the system browser at Cloudflare's consent page; after Authorize, Ritemark shows the account's name and the Publish sheet.
- **S18 (negative).** Given a sign-in callback with a different `state`, then it is ignored and the attempt keeps waiting until its deadline.
- **S19 (negative).** Given the person closes the browser without authorising, then after the deadline the sheet says the connection didn't finish, and the listener is closed.
- **S20 (live, M1, M10).** Given "Use a token instead", then Cloudflare's token page opens and so does the host's own password box ("Cloudflare token", hidden text, no webview). A valid token connects and Settings shows Connected; a refused token gets "Cloudflare didn't accept this token. Copy it again from Cloudflare's page."; a token that can't publish gets "This token can't publish pages. Make a new one on the page Ritemark opened."; on a failure the box stays open and nothing is saved.
- **S20a (negative).** Given the Settings page, then none of its messages to the host carries a token value: `publish:startTokenEntry` carries none, and the generic `setApiKey` refuses `ritemark.publish.cloudflare.v1` (allowlist).
- **S21 (negative).** Given a connection, then no webview message, log line, setting, project file or error text contains the token (searched in the test run's logs and the Settings page's received messages).
- **S22.** Given Settings ▸ Sharing ▸ Web pages, when the person presses Disconnect, then "Disconnect Cloudflare? Your published pages stay online. To take one down, unpublish it first." asks once; after Disconnect the entry is gone from SecretStorage, published pages stay up, and their tabs say "Connect again to update or unpublish".
- **S23.** Given a build without `RITEMARK_CLOUDFLARE_CLIENT_ID`, then only the token path is offered.

## Publish, Update, Unpublish (R7, R8)

- **S24 (live, M2–M7).** Given the sheet, when the person presses Publish, then "Publishing…" shows, then Published with Copy link; the address answers with the page within M6's time (on a new workers.dev name, "Your address is new. It can take a couple of minutes before the page opens." shows while Publishing… waits, and closes when the page answers); the response carries `X-Robots-Tag: noindex` on `/`, on a picture and on a 404.
- **S25.** Given Published, when the person presses Copy link, then the address is on the clipboard.
- **S26 (live, M8).** Given the person changes the page, then the chip reads "Published · changed"; Update the page sends only the changed files and keeps the address; a picture no longer used is gone from the page.
- **S27.** Given the page has a new local picture since the last publish, when the person presses Update the page, then the sheet shows again with the new file named.
- **S28 (live, M9).** Given Published, when the person presses Unpublish, then "Unpublish Harbour programme?" asks with Cancel and a red Unpublish; after Unpublish the chip reads "Unpublishing…" and the bar can't be pressed, "Cloudflare is still taking the page down." follows after 10 s, and only when the address has stopped answering does the bar show Publish again (no toast), offering the old address. A failure reads "Ritemark couldn't reach Cloudflare. The page is still online."
- **S28a (live, M2).** Given an account with no workers.dev name, then the first sheet shows "Your pages' addresses end in [ pages-4821 ].workers.dev"; a taken name gets "This name is taken. Try another." and Publish waits; the Address row shows the result as typed.
- **S28b (flag off).** Given `web-page-publishing` off, then no Publish, Set up, Connect or Use a token shows, and Settings ▸ Sharing ▸ Web pages still lists every published page with Open and Unpublish, and Unpublish works.
- **S29 (negative).** Given the network is off, when the person presses Publish, then the line reads "Ritemark couldn't reach Cloudflare. The page is still on this computer." with Try again, and the file is unchanged.
- **S30.** Given a published file renamed in Documents, then its tab shows Publish; Settings ▸ Sharing ▸ Web pages still lists the old page with Unpublish.
- **S31 (negative).** Given an AI chat asks the AI to publish the page, then no tool exists for it; the AI can only tell the person to press Publish.
- **S32.** Given the project is shared (copied to another computer), then no publish record or account is in the project folder.
