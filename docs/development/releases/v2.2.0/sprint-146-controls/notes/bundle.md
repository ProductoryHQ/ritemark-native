# Bundle (E4, S64)

"Before" is the branch's base, `origin/main` at `d070059d` (1 November 2026, this sprint's plan; its bundles are Sprint 145's last merge's, `5d0f8517`), measured on the committed files. "After" is each PR's head, rebuilt with `npm run build` in `webview/`.

| File | Before | After | Change |
|---|---|---|---|
| `media/webview.js` | 8,749,976 bytes (SHA-256 `d26d4b7510a63bd3c32923370ff63f84e6b8bf77657a86267ad91b4ca10e908f`) | PR 1: 8,751,229 bytes | +1,253 bytes (`ui/close-focus.ts`, the two contents' `onCloseAutoFocus` and the link menu's use of the rule; +512 before the review's two rounds) |
| `media/office-preview.js` | 2,620,152 bytes | PR 1: 2,621,425 bytes | +1,273 bytes (the same rule, through the viewers' shared menus) |

PR 2 (on PR 1's branch, measured at its head): `media/webview.js` 8,778,567 bytes, +27,338 on PR 1 (+28,591 on `main`): the control catalogue's page and rows, about 20.7 KB of it, the input-mode tracker, and about 4.6 KB of CSS for the variant's second selector (a field matches `focus-visible:` in both modes). `media/office-preview.js` 2,627,307 bytes, +5,882 on PR 1: the tracker, started in the Office previews' entry, and the same CSS. The catalogue is in the one bundle like every page; its stylesheet reaches only its own page (`body.rm-catalogue-page`, `.rm-cat-*`).

PR 1 carries #585's commit (`f370bb66`, now `2f691d92`): `webview/src/components/ui/` and `header/ExportMenu.tsx` only. Its test (`closeFocus.test.ts`) is not in either bundle.
