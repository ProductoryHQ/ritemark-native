# Sprint 149 Scenarios

Behaviour examples for [spec.md](spec.md). They are the manual QA list; `tasks.md` Phase 6 points here. S numbers are stable. "Live" means against the Cloudflare test account, launched through `scripts/qa/with-test-keys.sh` on a hidden dev instance with a test profile.

## The page on the desk (R1, R2)

- **S1.** Given `Harbour programme.html` in the project, when the person opens it from Documents, then it opens as a desk tab showing the page, with Open in browser and Publish on its bar.
- **S2.** Given that tab, when the person presses Open in browser, then the file opens in the system's default browser and the tab stays.
- **S3.** Given a web address open in Ritemark's browser, then the bar shows neither Open in browser nor Publish.
- **S4.** Given an `.html` file outside the project (dragged from Downloads), then it opens as the page with Open in browser and no Publish.
- **S5 (negative, A2).** Given `hostile.html` from the spike in the project, when it opens, then the CDN script loads, and `acquireVsCodeApi`, `window.browserViewAPI`, `fetch('file:///etc/hostname')`, `window.open`, top navigation and reading another tab's storage all fail; the workbench is a different CDP target.
- **S6 (negative, decision 4).** Given the person is signed in to a site in Ritemark's browser, when a project page makes a credentialed request to that site, then no cookie of that site goes with it (Ephemeral session).

## What goes (R3, R4, R5)

- **S7.** Given a page using `img/a.png`, `img/b.png` and `style.css` (which uses `fonts/x.woff2`), when Publish's sheet opens, then it reads "This page and 4 files" and the list names all four.
- **S8 (negative).** Given `<img src="../../secrets/scan.png">` reaching outside the project, then that file is left out and named "outside this project".
- **S9 (negative).** Given `<link href=".env">` or `<script src=".git/config">`, then each is left out and named "a hidden file".
- **S10 (negative).** Given `img/logo.png` that is a symlink to `~/Pictures/logo.png`, then it is left out as outside the project.
- **S11 (negative).** Given `src="%2e%2e/%2e%2e/x.png"`, `src="file:///Users/me/x.png"`, `src="C:\\Users\\me\\x.png"` or `src="\\\\server\\share\\x.png"`, then each is left out as outside the project (Windows cases on Windows).
- **S12.** Given a CDN script and a `data:` picture, then neither is in the list and both work on the published page.
- **S13.** Given `<a href="appendix.html">`, then the sheet names it under "links that won't work" and `appendix.html` doesn't go.
- **S14 (negative).** Given a script in the page holding a string that looks like an Anthropic key, then Publish is held, the sheet names the file and line with the value masked, and nothing is sent.
- **S15 (negative).** Given a 30 MiB video the page uses, then the sheet says it is too big to publish and nothing is sent.
- **S16.** Given the sheet is open, when the person presses Cancel, then no network request to Cloudflare is made (checked in the host's request log of the test run).

## Connect (R6, R9)

- **S17 (live, M12–M14).** Given no connection, when the person presses Publish, then "Where should your web pages go?" shows; Connect opens the system browser at Cloudflare's consent page; after Authorize, Ritemark shows the account's name and the Publish sheet.
- **S18 (negative).** Given a sign-in callback with a different `state`, then it is ignored and the attempt keeps waiting until its deadline.
- **S19 (negative).** Given the person closes the browser without authorising, then after the deadline the sheet says the connection didn't finish, and the listener is closed.
- **S20 (live, M1, M10).** Given "Use a token instead", when the person pastes a valid token, then Ritemark checks it, finds the account and saves it; an invalid token is refused with one plain line and not saved.
- **S21 (negative).** Given a connection, then no webview message, log line, setting, project file or error text contains the token (searched in the test run's logs and the Settings page's received messages).
- **S22.** Given Settings ▸ Sharing ▸ Web pages, when the person presses Disconnect, then the entry is gone from SecretStorage, published pages stay up, and their tabs say "Connect again to update or unpublish".
- **S23.** Given a build without `RITEMARK_CLOUDFLARE_CLIENT_ID`, then only the token path is offered.

## Publish, Update, Unpublish (R7, R8)

- **S24 (live, M2–M7).** Given the sheet, when the person presses Publish, then "Publishing…" shows, then Published with Copy link; the address answers with the page within M6's time; the response carries `X-Robots-Tag: noindex` on `/`, on a picture and on a 404.
- **S25.** Given Published, when the person presses Copy link, then the address is on the clipboard.
- **S26 (live, M8).** Given the person changes the page, then the chip reads "Published · changed"; Update the page sends only the changed files and keeps the address; a picture no longer used is gone from the page.
- **S27.** Given the page has a new local picture since the last publish, when the person presses Update the page, then the sheet shows again with the new file named.
- **S28 (live, M9).** Given Published, when the person presses Unpublish and confirms, then the address stops answering with the page, and only then the bar says Unpublished and shows Publish, offering the old address.
- **S29 (negative).** Given the network is off, when the person presses Publish, then the line reads "Ritemark couldn't reach Cloudflare. The page is still on this computer." with Try again, and the file is unchanged.
- **S30.** Given a published file renamed in Documents, then its tab shows Publish; Settings ▸ Sharing ▸ Web pages still lists the old page with Unpublish.
- **S31 (negative).** Given an AI chat asks the AI to publish the page, then no tool exists for it; the AI can only tell the person to press Publish.
- **S32.** Given the project is shared (copied to another computer), then no publish record or account is in the project folder.
