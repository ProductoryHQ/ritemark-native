# Bundles (E4)

Measured in bytes on the sprint branch against its base, `08761e71` (main after #540), after the Experience lead's build check and QA's fixes (26 October).

| Bundle | Before | After | Change |
|---|---|---|---|
| `extensions/ritemark/media/webview.js` | 8,611,995 | 8,644,137 | +32,142 (+0.4%) |
| `extensions/ritemark/media/office-preview.js` | 2,576,131 | 2,592,428 | +16,297 (+0.6%) |
| `extensions/ritemark/out/extension.js` | 5,650,663 | 5,707,245 | +56,582 (+1.0%) |

No new dependency in any bundle: R1a (Mammoth on the host) is not built, so nothing moved from the webview to the host. The growth is the guidance and feedback modules, the starting points, the Home cards and five Phosphor icons; `office-preview.js` is built from the same webview sources and grew with them (in `685770cd`).
