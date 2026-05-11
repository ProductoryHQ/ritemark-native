# Terminal Link Integration

---

## Goal

Make `localhost:PORT` URLs in the integrated terminal clickable. Clicking one opens the URL in a Ritemark browser tab via `BrowserManager.openUrl()`.

---

## The Right API: `vscode.window.registerTerminalLinkProvider`

Confirmed API from `vscode/src/vscode-dts/vscode.d.ts` line 11816:

```typescript
export function registerTerminalLinkProvider(provider: TerminalLinkProvider): Disposable;
```

Interface (`vscode.d.ts` lines 8162–8178):

```typescript
export interface TerminalLinkProvider<T extends TerminalLink = TerminalLink> {
    provideTerminalLinks(context: TerminalLinkContext, token: CancellationToken): ProviderResult<T[]>;
    handleTerminalLink(link: T): ProviderResult<void>;
}
```

`TerminalLinkContext` (`vscode.d.ts` lines 8147–8157):

```typescript
export interface TerminalLinkContext {
    line: string;   // full text of the terminal line being scanned
    terminal: Terminal;
}
```

`TerminalLink` (`vscode.d.ts` lines 8183–8213):

```typescript
export class TerminalLink {
    startIndex: number;  // start position in context.line
    length: number;      // length of the matched text
    tooltip?: string;    // hover tooltip
    constructor(startIndex: number, length: number, tooltip?: string);
}
```

This is a standard public extension API. No VS Code core patch needed.

---

## How It Works

VS Code calls `provideTerminalLinks` for every line of terminal output. The provider scans each line for matching patterns and returns an array of `TerminalLink` objects with position and length. When the user Ctrl+clicks (or Cmd+clicks on macOS) a detected link, VS Code calls `handleTerminalLink` with the matched link object.

The `TerminalLink` base class only carries position + tooltip. To pass the matched URL through to `handleTerminalLink`, we subclass it:

```typescript
class LocalhostTerminalLink extends vscode.TerminalLink {
    constructor(
        startIndex: number,
        length: number,
        public readonly url: string,
    ) {
        super(startIndex, length, `Open ${url} in Ritemark Browser`);
    }
}
```

---

## Regex Pattern and Edge Cases

### Primary Pattern

```typescript
const LOCALHOST_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::]):\d+(?:\/[^\s]*)? /g;
```

Breakdown:
- `https?://` — matches `http://` and `https://`.
- `(?:localhost|127.0.0.1|0.0.0.0|[::1]|[::])` — all standard loopback aliases.
- `:\d+` — port number (mandatory in the pattern to avoid matching bare `localhost` text).
- `(?:/[^\s]*)?` — optional path (greedy, stops at whitespace).

### Edge Cases

| Pattern | Handling |
|---|---|
| `http://localhost:5173` | Matched |
| `https://localhost:5173` | Matched |
| `http://localhost:5173/path?query=1` | Matched (path + query captured) |
| `http://127.0.0.1:3000` | Matched |
| `http://0.0.0.0:8080` | Matched |
| `http://[::1]:3000` | Matched (IPv6 loopback) |
| `http://[::]:3000` | Matched (IPv6 all-interfaces loopback) |
| `localhost:5173` (no scheme) | Not matched by default — bare `hostname:port` without scheme is ambiguous (could be a file path component). VS Code's built-in link detection already handles these as clickable links. Do not shadow the built-in. |
| Port > 65535 | Not filtered at regex level — practically irrelevant; `\d+` captures it, and any invalid URL will fail at `BrowserManager.openUrl()` gracefully. |
| URL at end of line (no trailing space) | Pattern includes optional path `(?:/[^\s]*)?` which also matches end-of-line. The `?` at the end handles zero-length paths. |
| Terminal ANSI escape codes | `context.line` is the visible text after ANSI stripping. VS Code strips escape codes before calling the provider. Confirmed by `extHostTerminalService.ts` behavior. |

### Custom Port Schemes

Some dev servers print bare `localhost:PORT` without scheme (e.g. Vite prints `Local: http://localhost:5173/`). The Vite output includes `http://` explicitly, so the pattern matches. For servers that print bare `localhost:3000`, VS Code's built-in `TerminalLinkOpener` already makes those clickable — we do not need to shadow it.

---

## Route to `BrowserManager.openUrl()`

In `handleTerminalLink`:

```typescript
handleTerminalLink(link: LocalhostTerminalLink): void {
    BrowserManager.openUrl(link.url);
}
```

`BrowserManager.openUrl(url)` creates a new browser tab (Custom Editor Provider) for the given URL. For terminal links, since localhost URLs have no corresponding workspace file, the editor provider is opened via `vscode.commands.executeCommand('ritemark.openBrowser', url)` which triggers the command registered in Phase B.

---

## Conflict with VS Code Built-in Link Detection

VS Code has a built-in terminal link provider that handles `http://` and `https://` URLs by offering "Open Link" in the system browser. Our provider coexists with it — VS Code shows links from all registered providers. When a user clicks a matched link, VS Code picks the provider that matched it.

**Potential duplicate:** If both our provider and the built-in both match `http://localhost:5173`, the user would see two link handlers offered. To avoid this, use a specific `TerminalLinkProvider` that returns the link only when it is a localhost/loopback URL — the built-in will still match it, but the user can choose. Alternatively, check VS Code's built-in behavior: in practice the built-in uses a different `startIndex`/`length` and our tooltip (`"Open in Ritemark Browser"`) makes the intent clear. Accept the dual-match in Sprint 65 — it is a minor UX annoyance, not a bug.

---

## Registration

```typescript
context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider(new LocalhostTerminalLinkProvider(browserManager))
);
```

Registered in `extension.ts` `activate()` alongside other providers. No core patch needed.

---

## Feasibility Confirmation

`registerTerminalLinkProvider` is a public API available since VS Code 1.44. It is used by built-in extensions (Copilot uses it for CLI links — confirmed in `vscode/extensions/copilot/src/extension/chatSessions/vscode-node/test/copilotCLITerminalIntegration.spec.ts`). No VS Code core patch is required for Ritemark to use it.

The `localhost:*` interception is entirely feasible within the extension boundary.
