# Bundle (E4, S64)

"Before" is the branch's base, `origin/main` at `d070059d` (1 November 2026, this sprint's plan; its bundles are Sprint 145's last merge's, `5d0f8517`), measured on the committed files. "After" is each PR's head, rebuilt with `npm run build` in `webview/`.

| File | Before | After | Change |
|---|---|---|---|
| `media/webview.js` | 8,749,976 bytes (SHA-256 `d26d4b7510a63bd3c32923370ff63f84e6b8bf77657a86267ad91b4ca10e908f`) | PR 1: 8,750,488 bytes | +512 bytes (`ui/close-focus.ts` and the two default `onCloseAutoFocus`) |
| `media/office-preview.js` | 2,620,152 bytes | PR 1: 2,620,705 bytes | +553 bytes (the same rule, through the viewers' shared menus) |

PR 1 carries #585's commit (`f370bb66`, now `d3ca6786`): `webview/src/components/ui/` and `header/ExportMenu.tsx` only. Its test (`closeFocus.test.ts`) is not in either bundle.
