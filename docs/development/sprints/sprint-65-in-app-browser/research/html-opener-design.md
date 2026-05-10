# HTML Workspace File Opener Design

---

## Overview

When a user opens a `.html` file from the Explorer, the default behavior is to show it in the Ritemark browser tab (locked decision Q2). The user must also be able to open it as plain text for editing HTML source (R3 mitigation). A Settings key (`ritemark.browser.htmlDefaultOpener`) allows changing the global default.

---

## Custom Editor Provider Registration

The browser tab is implemented as a Custom Editor Provider registered for two file patterns:

1. The `ritemark-browser` virtual scheme — for URL-based tabs (opens via command, not file).
2. `.html` workspace files — for the file opener.

For `.html` files, the provider is registered in `package.json` under `customEditors`:

```json
{
  "viewType": "ritemark.browser",
  "displayName": "Ritemark Browser",
  "selector": [
    { "filenamePattern": "*.html" }
  ],
  "priority": "default"
}
```

`"priority": "default"` makes this the default editor for `.html` files (overrides VS Code's text editor default). VS Code uses the first registered `"priority": "default"` custom editor for a file type. Since there is no other Ritemark custom editor for `.html`, this takes effect immediately.

The TypeScript registration in `extension.ts`:

```typescript
context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
        'ritemark.browser',
        new BrowserEditorProvider(context, browserManager),
        { webviewOptions: { retainContextWhenHidden: true } }
    )
);
```

---

## Priority vs Default Text Editor

VS Code's editor priority system (from `vscode.d.ts` line 11792):

| Priority | Meaning |
|---|---|
| `"default"` | Used as the default for the file type. User can override per-file. |
| `"option"` | Shown as an option but not the default. |
| `"builtin"` | Reserved for VS Code built-ins. |

Setting `"priority": "default"` means `.html` files open in the Ritemark browser by default. VS Code still allows the user to right-click and select "Open With..." to pick the text editor.

**The `ritemark.browser.htmlDefaultOpener` setting gates this at the extension level:**

In `BrowserEditorProvider.resolveCustomEditor`, if the setting is `"editor"`, the provider immediately executes:

```typescript
vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
```

This re-routes to VS Code's default text editor for the file, effectively making the custom editor a passthrough. If the setting is `"prompt"`, a quick-pick dialog is shown.

This approach keeps `"priority": "default"` in `package.json` (making the browser the registered default) while letting the setting override behavior at runtime.

---

## Right-Click Context Menu: "Open as Text"

Two context menu items in `package.json` `contributes.menus`:

```json
{
  "command": "ritemark.browser.openAsText",
  "when": "resourceLangId == html",
  "group": "navigation"
},
{
  "command": "ritemark.browser.openInBrowser",
  "when": "resourceLangId == html",
  "group": "navigation"
}
```

**"Open as Text" command** (`ritemark.browser.openAsText`):

```typescript
vscode.commands.executeCommand('vscode.openWith', uri, 'default');
```

This uses the built-in `vscode.openWith` command to open the file with VS Code's default text editor, bypassing the custom editor. `'default'` is the text editor's built-in view type identifier.

**"Open in Ritemark Browser" command** (`ritemark.browser.openInBrowser`):

```typescript
vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.browser');
```

This forces the browser tab even if the setting is `"editor"` or `"prompt"`. Useful for users who have the setting on `"editor"` but occasionally want the browser for a specific file.

Both commands are also available from the editor title context menu (the `...` or right-click in the tab strip), not just the Explorer context menu.

---

## `ritemark.browser.htmlDefaultOpener` Setting

### package.json Contribution

```json
{
  "ritemark.browser.htmlDefaultOpener": {
    "type": "string",
    "enum": ["browser", "editor", "prompt"],
    "default": "browser",
    "description": "Controls how .html workspace files open by default.",
    "enumDescriptions": [
      "Open .html files in the Ritemark browser tab (default).",
      "Open .html files in the text editor.",
      "Ask each time which editor to use."
    ]
  }
}
```

### Reading the Setting in the Provider

```typescript
const config = vscode.workspace.getConfiguration('ritemark.browser');
const opener = config.get<'browser' | 'editor' | 'prompt'>('htmlDefaultOpener', 'browser');
```

Called at the top of `resolveCustomEditor` before any other logic.

---

## RitemarkSettings.tsx Integration

Pattern to follow: the Codex Approval Policy and Sandbox Mode dropdowns (lines 662–700 in `RitemarkSettings.tsx`). These use:

1. A `<label>` + `<select>` + `<p>` (description) pattern.
2. `handleSettingChange(key, value)` on `onChange` — sends `{ type: 'setSetting', key, value }` postMessage to the extension host.
3. The `SettingsData` interface has a typed field for the setting.
4. The `RitemarkSettingsProvider` reads/writes the VS Code configuration on `setSetting` messages.

**New section to add in `RitemarkSettings.tsx`:**

Place in a new "Browser" section after the API Keys section (or append to an appropriate existing section). Following the exact Codex dropdown pattern:

```tsx
{/* Browser Section */}
<section className="mb-8">
  <div className="flex items-center gap-2 mb-4">
    <Icon name="globe" size={20} className="text-ink-strong" />
    <h2 className="text-lg font-semibold text-ink-strong">Browser</h2>
  </div>
  <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
    <label className="text-sm font-medium text-ink-strong block mb-1">
      HTML File Default
    </label>
    <select
      value={settings.htmlDefaultOpener}
      onChange={(e) => handleSettingChange('browser.htmlDefaultOpener', e.target.value)}
      className="w-full px-3 py-2 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
    >
      <option value="browser">Open in Ritemark Browser (default)</option>
      <option value="editor">Open as Text</option>
      <option value="prompt">Ask each time</option>
    </select>
    <p className="text-xs text-ink-muted mt-1">
      Controls how .html workspace files open when clicked in the Explorer.
      You can always right-click a file to choose a specific editor.
    </p>
  </div>
</section>
```

**`SettingsData` interface addition:**

```typescript
htmlDefaultOpener: 'browser' | 'editor' | 'prompt';
```

**`RitemarkSettingsProvider` `setSetting` handler addition:**

```typescript
case 'browser.htmlDefaultOpener':
    await config.update('ritemark.browser.htmlDefaultOpener', value, vscode.ConfigurationTarget.Global);
    break;
```

**Settings data push addition** (in the method that builds the settings object sent to the webview):

```typescript
htmlDefaultOpener: config.get<string>('ritemark.browser.htmlDefaultOpener', 'browser'),
```

---

## No Custom Component

The entire Settings page entry uses:
- Standard `<section>` + `<label>` + `<select>` + `<p>` pattern — matches existing Codex settings.
- `handleSettingChange` — existing shared handler.
- No new component file, no new hook, no new utility.

This satisfies Q3's "use existing `RitemarkSettings.tsx` patterns — no custom component" constraint.
