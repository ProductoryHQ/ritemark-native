# XFO Fallback Panel Design

---

## Problem Statement

When a site sends `X-Frame-Options: DENY` or `X-Frame-Options: SAMEORIGIN`, the browser engine silently refuses to render the iframe content. The iframe `load` event still fires (the browser considers the navigation complete — it just shows nothing), but `iframe.contentDocument` is inaccessible. There is no `error` event for XFO refusals.

This means the user sees a blank iframe with no explanation, which looks like a Ritemark bug.

---

## Detection Mechanism

### Why Header Sniffing Is Not Available

A VS Code webview is a sandboxed Electron `BrowserView`. The host page cannot use `fetch()` to inspect response headers for an arbitrary external URL:
- `fetch()` from the webview host page is subject to normal CORS restrictions.
- For cross-origin URLs (e.g. `google.com`), a preflight will fail or the response headers will be opaque.
- Even if headers were accessible, `X-Frame-Options` is not exposed via CORS — it is a browser-engine enforcement header, not a CORS header.

**Conclusion:** Header sniffing via `fetch` is not available cross-origin in a VS Code webview. This is consistent with the sprint plan's locked assumption.

### Confirmed Detection Approach: Load Timeout Heuristic

The correct mechanism is:

1. Extension host sets `iframe.src` to the requested URL and simultaneously starts a timer (recommended: 5 seconds).
2. The webview sends a `load` message to the extension host when `iframe.load` fires. This fires whether the iframe loaded content or silently refused it (XFO).
3. If the `load` event fires but the timer has not yet elapsed, we cannot distinguish success from XFO refusal purely from timing.

**Refined approach (two-signal):**

- Signal A — `iframe.load` fires: navigation completed (content rendered or XFO refused).
- Signal B — `iframe.error` event: fires for network errors (DNS failure, connection refused) but NOT for XFO. This is a distinct failure mode.
- Signal C — postMessage from iframe: an XFO-blocked iframe cannot communicate back to the host page (it is not rendered). If the iframe successfully loads a page that sends a `postMessage`, we know it is not XFO-blocked — but arbitrary third-party pages will not send postMessages to us.

**Practical implementation:**

After setting `iframe.src`:
1. Start a 5-second timer in the extension host (or in the webview via `setTimeout`).
2. Listen for `iframe.load`. When it fires, immediately attempt to access `iframe.contentDocument`. If the iframe is XFO-blocked, `contentDocument` will be `null` (cross-origin restriction) or throw.
3. If `contentDocument` is `null` / inaccessible AND the origin is not `localhost` / `file://` (which always work), treat as XFO-blocked.
4. For `localhost` and `file://` origins: assume success on `load` event (these schemes cannot have XFO headers).

**Why `contentDocument` access works as the signal:** The browser sets `iframe.contentDocument` to `null` when the iframe is cross-origin (whether blocked by XFO or not). For XFO-blocked iframes the iframe URL is cross-origin by definition. For successfully loaded same-origin iframes the document is accessible.

**Caveat:** For cross-origin iframes that load successfully (but are cross-origin), `contentDocument` is also `null`. We cannot distinguish "loaded cross-origin successfully" from "XFO-blocked" via `contentDocument`. Therefore:

- If the `load` event fires within 5 seconds: assume success. Most real sites that allow embedding load well within 5 seconds.
- If the `load` event does NOT fire within 5 seconds: show timeout fallback ("Site did not respond or blocked embedding").
- Complement with a heuristic: if the iframe `src` is set but after `load` the `iframe.contentWindow.location` throws (cross-origin), show a soft "Did this load correctly?" secondary message — but do not force the fallback panel for sites that legitimately embed cross-origin.

**Simplified production decision:** Given that XFO-blocked iframes load instantly (browser refuses immediately, fires `load` right away with an empty/error document), the 5-second timeout is overkill for the XFO case specifically. The better approach:

- On `iframe.load`, immediately try `iframe.contentWindow.location.href`. If it throws `SecurityError`, the iframe is cross-origin (either XFO-blocked or successfully embedded cross-origin). Since we cannot distinguish these cases, show only a soft inline hint: "If this site isn't displaying, it may block embedding." with an "Open in System Browser" button. Do not force the full error state.
- If the `load` event does not fire within 8 seconds (network timeout / server not responding), show the timeout fallback panel.

This approach is conservative and avoids false positives.

---

## Fallback Panel Design

### When Shown

The fallback panel replaces the iframe content area when:
1. The load timer (8 seconds) expires without a `load` event — network timeout or server unreachable.
2. Explicitly triggered by the user clicking "Didn't load?" (soft mode, not forced).

For the XFO-blocked case (load fires instantly, cross-origin), a softer inline banner is shown below the URL bar rather than replacing the full iframe.

### Full Fallback Panel (Timeout / Network Error)

```
[Connection icon or globe-x icon]

This site didn't load.

The page at {URL} could not be reached. It may be down, 
or the address may be incorrect.

[Open in System Browser]  [Try Again]
```

- Background: `bg-surface-muted` (matches VS Code's editor background)
- Icon: 40px, `text-ink-muted`
- Heading: `text-base font-medium text-ink-strong`
- Body: `text-sm text-ink-muted`, max-width ~360px, centered
- Buttons: standard Ritemark Button components, `size="lg"`
  - "Open in System Browser" → primary → sends `openExternal` postMessage
  - "Try Again" → secondary → sends `reload` postMessage

### Soft Inline Banner (XFO / Cross-Origin)

A slim banner below the URL bar chrome, not replacing the iframe:

```
[info-icon] This site may block embedding.  [Open in System Browser]
```

- Height: 32px, padding `px-4`
- Background: `bg-surface border-b border-hairline`
- Text: `text-xs text-ink-muted`
- Button: inline text-style `text-xs text-accent-deep hover:underline`
- Dismissible: yes, `×` button on right edge
- The banner disappears when the user navigates to a new URL

---

## Integration into the React Component Tree

```
BrowserChrome.tsx
├── URLBar (always visible)
│   ├── BackButton
│   ├── ForwardButton
│   ├── RefreshButton
│   ├── URLInput
│   └── OpenExternalButton
├── XFOBanner (conditionally visible — soft mode)
│   └── inline warning + "Open in System Browser" + dismiss
└── ContentArea
    ├── <iframe> (default, visible when content loading or loaded)
    └── TimeoutFallbackPanel (replaces iframe on timeout)
        ├── ErrorIcon
        ├── Heading
        ├── Body
        ├── OpenExternalButton (primary)
        └── RetryButton (secondary)
```

State management:
```typescript
type LoadState = 'loading' | 'loaded' | 'timeout' | 'network-error';
type XFOHint = 'none' | 'possible-xfo';
```

Both `xfoHint` and `loadState` are managed in `BrowserChrome` state, updated via `window.addEventListener('message', ...)` receiving messages from the extension host.

---

## Extension Host Message Protocol (XFO-related)

From extension host to webview:

| Message type | Payload | Meaning |
|---|---|---|
| `browser:navigate` | `{ url: string }` | Set iframe src, reset state to `loading` |
| `browser:loadTimeout` | `{ url: string }` | Timer elapsed, no load event received |
| `browser:xfoHint` | `{ url: string }` | Extension detected possible XFO (heuristic) |

From webview to extension host:

| Message type | Payload | Meaning |
|---|---|---|
| `browser:loaded` | `{ url: string }` | iframe `load` event fired |
| `browser:error` | `{ url: string, code?: string }` | iframe `error` event fired |
| `browser:openExternal` | `{ url: string }` | User clicked "Open in System Browser" |
| `browser:retry` | `{ url: string }` | User clicked "Try Again" |

---

## "Open in System Browser" Button

The button calls `vscode.env.openExternal(vscode.Uri.parse(url))` in the extension host, exactly as Simple Browser does (`simpleBrowserView.ts` lines 77–82). The webview sends a `browser:openExternal` postMessage; the extension host handles it.

This covers both the full fallback panel's primary button and the soft banner's inline link. Both send the same `browser:openExternal` message type.

---

## Light/Dark Theme Compatibility

All colors use VS Code CSS variables (`--vscode-editor-background`, `--vscode-editor-foreground`) via Ritemark's Tailwind token aliases (`bg-surface-muted`, `text-ink-muted`, etc.). No hardcoded colors. Both light and dark Ritemark themes are covered by the token system.
