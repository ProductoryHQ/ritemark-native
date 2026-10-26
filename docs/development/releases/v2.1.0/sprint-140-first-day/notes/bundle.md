# Bundles (E4)

Measured in bytes on the sprint branch against its base, `08761e71` (main after #540).

| Bundle | Before | After | Change |
|---|---|---|---|
| `extensions/ritemark/media/webview.js` | 8,611,995 | 8,643,815 | +31,820 (+0.4%) |
| `extensions/ritemark/out/extension.js` | 5,650,663 | 5,702,895 | +52,232 (+0.9%) |

No new dependency in either bundle: R1a (Mammoth on the host) is not built, so nothing moved from the webview to the host. The growth is the guidance and feedback modules, the starting points, the Home cards and five Phosphor icons.
