# A3: ⌘⇧P on Home (#507)

**Decision: no code for #507.** A person tries S27–S32 with a real keyboard at Gate 2, on the Mac and on Windows. Without a reproduction, #507 moves to 2.2 with this evidence.

## How the films sent the keys (the Social manager, 27 October)

The launch films' ⌘⇧P was synthetic, never a real keyboard:
- Playwright `connectOverCDP` on RC1's port (2.0.0, `c04eabf2`);
- then `page.keyboard.press('Meta+Shift+p')` on the main workbench page, which is CDP `Input.dispatchKeyEvent` to the top-level window target;
- on Home (a webview), usually just after a click inside Home's webview;
- Go to File (⌘P) failed the same way;
- a click on the window chrome first made it work every time.

The capture code is in ritemark-web `docs/programs/social-video/capture/take.cjs`, around lines 470–481. The Social manager reads it as a capture artifact: CDP key events don't route into a focused webview guest.

## That exact method, tried here

`repro/repro-507c.mjs` does it with Playwright's own `connectOverCDP` (`playwright-core` 1.61 from the VS Code tree): a click inside Home with `page.mouse.click` on the workbench page, then at once `page.keyboard.press`, ten times each for ⌘⇧P and ⌘P, then a control with the click on the tab row.

| Build | ⌘⇧P after a click in Home | ⌘P after a click in Home | Control (click on the window chrome) |
|---|---|---|---|
| This branch's dev build (`84ea15db` and Sprint 143; nothing in the key path changed) | 10 of 10 opened | 10 of 10 opened | opened |
| The installed, signed 2.0.1, on its own short profile | 10 of 10 opened | 10 of 10 opened | opened |

With the planning session's 24 tries (raw CDP keys after six ways of putting the focus on Home, and agent-browser's `press`), that is 64 synthetic presses on Home, all of which opened the palette.

## What this leaves

- **The artifact is likely but not confirmed.** The films' failures were on RC1, in a visible window, with the capture's own timing. This Mac's hidden instances, on the dev build and on 2.0.1, never failed. The difference may be RC1 itself, the window being in front, or the capture's timing; none was tried, because the method that failed for the films did not fail here.
- **The code gives no reason to fail.** Home's page stops no key; VS Code's webview host forwards every keydown, and the workbench takes it when the key carries the host's token and Home's frame is the document's active element (`webviewElement.ts:744–770`). In every try here, the workbench's active element was Home's frame.
- **A person's keyboard is the open check.** Real keystrokes go through macOS's menu shortcuts before the page, which no synthetic method covers.
