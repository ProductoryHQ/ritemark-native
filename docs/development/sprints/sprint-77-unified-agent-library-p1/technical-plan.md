# Sprint 77 Technical Plan

## Architecture Overview

Sprint 77 touches three layers:

1. **Extension host — discovery layer** (`extensions/ritemark/src/agent/discovery.ts`): Fixes the Codex discovery bug, adds provenance tracking and deduplication, extends frontmatter parsing to handle YAML arrays and numbers, and adds a frontmatter validator. All data flows from here to the views.

2. **Extension host — views layer** (`extensions/ritemark/src/views/AgentLibraryViewProvider.ts`, `extensions/ritemark/src/views/AgentEditorProvider.ts`): The Agent Library gains a Flows section and provenance badge rendering. The new `AgentEditorProvider` registers as a custom text editor for `.claude/agents/*.md` files.

3. **Webview bundle** (`extensions/ritemark/webview/`): A new Vite entry (`agent-editor`) provides the React component tree for the agent editor — TipTap body on the left, Configurator panel on the right. This bundle is separate from the main `webview.js` bundle to keep the entry point clean.

4. **Extension entry** (`extensions/ritemark/src/extension.ts`, `extensions/ritemark/package.json`): The `ritemark-flows` activity bar container and `ritemark.flowsView` view registration are removed. The `ritemark.agentEditor` custom editor is registered.

Components that are NOT touched by this sprint: `ritemarkEditor.ts`, `FlowStorage.ts`, `FlowExecutor.ts`, `FlowScheduleState.ts`, the main `webview.js` bundle entry, and VS Code patches.

---

## Workstream 1: Discovery fix (R1 + R2)

### Files

- `extensions/ritemark/src/agent/discovery.ts` — primary change file

### R1 — Remove .agents agent scan

`discoverAgents()` at line ~230 calls:

```typescript
addAgents(discoverAgentsInRoot(path.join(workspacePath, '.agents'), 'project'));
```

This passes a `.agents`-rooted path to `discoverAgentsInRoot`, which then looks for `<root>/agents/*.md` — i.e. `.agents/agents/*.md`. Codex has no such convention. **Remove this one call.** The `.agents/skills/` scan (handled by `discoverCommands`) is correct and must not be touched.

After removal, `discoverAgents()` only scans `.claude/` (project) and `~/.claude/` (user).

### R2 — Provenance tracking and dedup

**Interface change — `DiscoveredCommand`:**

```typescript
export interface DiscoveredCommand {
  id: string;
  name: string;
  description: string;
  source: 'commands' | 'skills';
  filePath: string;
  scope: ItemScope;
  hasFrontmatter: boolean;
  modifiedAt: number;
  icon: IconName;
  color: ColorName;
  provenance?: 'claude' | 'codex' | 'shared'; // NEW — only set for source: 'skills'
}
```

**`discoverCommandsInRoot` signature change:**

```typescript
function discoverCommandsInRoot(
  claudeRoot: string,
  scope: ItemScope,
  framework: 'claude' | 'codex' = 'claude'   // NEW param, defaults to 'claude'
): DiscoveredCommand[]
```

Every skill item pushed inside `discoverCommandsInRoot` gets `provenance: framework`.

**`discoverCommands()` dedup logic:**

After collecting results from all roots, build a `Map<string, DiscoveredCommand>` keyed by skill folder name. For skills:

1. If the same folder name appears from both `claude` and `codex` frameworks, merge to one entry with `provenance: 'shared'`. The canonical `filePath` is the `.claude/skills/` copy.
2. Otherwise keep the single entry with its framework provenance.

Commands (source: `'commands'`) skip the dedup map — they have no Codex equivalent and no `provenance` field.

**Call-site updates in `discoverCommands()`:**

```typescript
// project .claude/ roots
addCommands(discoverCommandsInRoot(path.join(workspacePath, '.claude'), 'project', 'claude'));
// project .agents/ roots
addCommands(discoverCommandsInRoot(path.join(workspacePath, '.agents'), 'project', 'codex'));
```

The dedup map runs after both calls but before user-level scanning (user-level skills are always `'claude'` provenance — no user-level Codex root exists).

---

## Workstream 2: Frontmatter extension and validator (R4)

### Files

- `extensions/ritemark/src/agent/discovery.ts` — extend `parseFrontmatter`, extend `DiscoveredAgent`, add `validateAgentFrontmatter`

### Extended `parseFrontmatter`

Current return type is `Record<string, string>`. New return type:

```typescript
type FrontmatterValue = string | string[] | number | boolean;
type FrontmatterRecord = Record<string, FrontmatterValue>;
```

Parser additions:
- When a YAML value is `[a, b, c]` (inline array), parse it as `string[]`.
- When a value is an indented list of `- item` lines following a bare key, parse it as `string[]`.
- When a value is a bare number (e.g. `2.50`, `10`), parse it as `number`.
- When a value is `true` or `false`, parse it as `boolean`.
- All existing string parsing is preserved for all other cases.

The internal return type of `parseFrontmatter` broadens, but callers that only read string fields continue to work because TypeScript's type narrowing handles it and the existing string fields (`name`, `description`, etc.) still return strings.

### Extended `DiscoveredAgent`

```typescript
export interface DiscoveredAgent {
  // ... existing fields unchanged ...
  // NEW optional extended frontmatter fields
  runtime?: string;
  runtimeModel?: string;
  schedule?: string;
  routine?: string;
  skills?: string[];
  allowedTools?: string[];
  maxBudgetUsd?: number;
  worktree?: boolean;
}
```

Parsing these from the frontmatter record happens in `discoverAgentsInRoot` after `parseFrontmatter()` is called, before the agent is pushed to the results array.

### `validateAgentFrontmatter`

```typescript
export function validateAgentFrontmatter(agent: DiscoveredAgent): string[] {
  const errors: string[] = [];
  if (agent.schedule) {
    if (!agent.runtime) errors.push('schedule requires runtime to be set');
    if (!agent.routine) errors.push('schedule requires routine to be set');
  }
  if (agent.routine) {
    const resolvedPath = path.resolve(path.dirname(agent.filePath), agent.routine);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(`routine path does not exist: ${agent.routine}`);
    }
  }
  return errors;
}
```

### Badge rendering in `AgentLibraryViewProvider`

For each agent row in the HTML, call `validateAgentFrontmatter(agent)` and if the result is non-empty, append a `<span class="warning-chip" title="${errors[0]}">⚠</span>` inline after the agent name. CSS: yellow background, small text. The chip is purely cosmetic at this stage — no interactive flow from it.

---

## Workstream 3: Sidebar merge (R3 + R8)

### Files

- `extensions/ritemark/package.json` — remove container + view registration
- `extensions/ritemark/src/extension.ts` — remove `FlowsViewProvider` registration
- `extensions/ritemark/src/views/AgentLibraryViewProvider.ts` — add Flows section

### package.json changes

Remove from `contributes.viewsContainers.activitybar`:
```json
{ "id": "ritemark-flows", "title": "Flows", "icon": "media/flow-icon.svg" }
```

Remove from `contributes.views`:
```json
"ritemark-flows": [
  { "type": "webview", "id": "ritemark.flowsView", "name": "Flows" }
]
```

Remove from `activationEvents`:
```
"onView:ritemark.flowsView"
```

### extension.ts changes

Remove the `FlowsViewProvider` instantiation and `registerWebviewViewProvider` call. The `FlowsViewProvider` class file is kept; its constructor and `resolveWebviewView` method remain intact for future use as the flow editor target.

### AgentLibraryViewProvider — Flows section

Add a new section to the HTML template rendered by `getHtmlForWebview`. The section is positioned after Skills/Commands.

Data source: `FlowStorage` (already imported via `FlowExecutor`). Import `FlowStorage` directly in `AgentLibraryViewProvider`, instantiate once per `resolveWebviewView` call with the current workspace path.

**Attachment detection (R8):** Before rendering, build a `Map<string, string[]>` from flow filename stem to list of agent display names. Iterate `discoverAgents()` results; for each agent with a `routine` field, extract the basename without extension from the routine path, and push the agent's display name into the map entry.

**Flow row HTML shape:**
```html
<div class="flow-row" data-flow-id="${flowId}">
  <span class="flow-name">${flowName}</span>
  <span class="flow-attachment">${attachmentText}</span>  <!-- empty if standalone -->
</div>
```

**Message handler for `openFlow`:** When the webview sends `{ type: 'openFlow', flowId }`, the extension host calls:
```typescript
vscode.commands.executeCommand('vscode.open', vscode.Uri.file(flowFilePath));
```
This opens the `.flow.json` file via VS Code's default handler, which the existing `FlowsViewProvider`-backed editor will handle if it is still registered as a custom editor for that file type. If not, VS Code opens it as JSON — acceptable for Phase 1.

---

## Workstream 4: agentEditor custom editor (R5 + R6)

### Files

- `extensions/ritemark/src/views/AgentEditorProvider.ts` — NEW file
- `extensions/ritemark/package.json` — register custom editor
- `extensions/ritemark/webview/src/agent-editor/` — NEW React component tree
- `extensions/ritemark/webview/vite.config.ts` — add `agent-editor` entry
- `extensions/ritemark/webview/agent-editor.html` — NEW HTML entry point

### AgentEditorProvider (extension host)

Implements `vscode.CustomTextEditorProvider`:

```typescript
export class AgentEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ritemark.agentEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      AgentEditorProvider.viewType,
      new AgentEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    );
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> { ... }
}
```

On `resolveCustomTextEditor`:
1. Set `webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [this._context.extensionUri] }`.
2. Set `webviewPanel.webview.html` to the `agent-editor.html` contents with nonce and resource URIs injected.
3. Parse the document text using `parseFrontmatter` (re-exported from `discovery.ts`) and send an `init` message to the webview:

```typescript
type AgentEditorInitMessage = {
  type: 'init';
  frontmatter: Record<string, FrontmatterValue>;
  body: string;              // content below closing ---
  filePath: string;          // absolute path of the .md file
  flows: string[];           // list of .flow.json stems in .ritemark/flows/
  skills: DiscoveredCommand[]; // all discovered skills (with provenance)
  authStatus: Record<string, boolean>; // { claude_local: true, ... }
  modelConfig: ModelConfigMessage;     // same shape used by main webview
};
```

4. Register a `vscode.workspace.onDidChangeTextDocument` listener on the document to re-send `init` when the file changes externally (debounced 200 ms).
5. Handle incoming webview messages:
   - `{ type: 'applyEdit', frontmatter, body }` — reconstruct the full `.md` file text (frontmatter YAML + body) and apply via `vscode.workspace.applyEdit`.
   - `{ type: 'createFlow', name }` — scaffold a new `.flow.json`, send updated flows list back.
   - `{ type: 'checkAuthStatus' }` — re-check credential env vars and send updated `authStatus`.

**`applyEdit` frontmatter serialisation helper:**

```typescript
function serializeFrontmatter(fm: Record<string, FrontmatterValue>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      v.forEach(item => lines.push(`  - ${item}`));
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else {
      // string — quote if contains special chars
      const safe = /[:#\[\]{}&*!|>'",%@`]/.test(String(v)) || String(v).includes('\n')
        ? JSON.stringify(v) : v;
      lines.push(`${k}: ${safe}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
```

### package.json registration

Add to `contributes.customEditors`:

```json
{
  "viewType": "ritemark.agentEditor",
  "displayName": "Agent Editor",
  "selector": [{ "filenamePattern": "**/.claude/agents/*.md" }],
  "priority": "default"
}
```

### Vite entry (`webview/vite.config.ts`)

Add `'agent-editor': resolve(__dirname, 'agent-editor.html')` to the `rollupOptions.input` map alongside the existing `index` entry.

### Webview component tree

Directory: `extensions/ritemark/webview/src/agent-editor/`

Key files:
- `AgentEditorApp.tsx` — root component; receives `init` message, owns state, splits TipTap body (left) and Configurator (right)
- `AgentEditorBody.tsx` — TipTap editor initialised with `body` from `init`. Uses the same TipTap setup as the main editor (StarterKit + basic marks). On change, fires `onBodyChange(markdown: string)` to parent.
- `Configurator.tsx` — controlled form component. Props: `frontmatter`, `flows`, `skills`, `authStatus`, `modelConfig`. On any field change, fires `onFrontmatterChange(updated: Record<string, FrontmatterValue>)`. All changes are debounced 300 ms in `AgentEditorApp` before posting `applyEdit`.
- `ScheduleField.tsx` — handles schedule input + cron preview (calls `parseCronExpression` imported from the extension host via a webview-accessible copy or re-implemented in the webview; see note below) + K6 banner logic.
- `ProvenanceBadge.tsx` — reusable badge component (`claude` / `codex` / `shared`).

**Note on `cronUtils` in the webview:** `cron-parser` is a Node package that works in browsers with a bundler. Import it directly in the webview bundle. Do not call back to the extension host for cron preview — the latency would make the UI feel sluggish.

---

## Workstream 5: cronUtils and K6 banner (R7)

### Files

- `extensions/ritemark/package.json` — add `cron-parser` dependency
- `extensions/ritemark/src/agent/cronUtils.ts` — NEW file

### cronUtils.ts

```typescript
import { parseExpression } from 'cron-parser';

export function parseCronExpression(expr: string): string {
  try {
    parseExpression(expr);            // validates; throws on bad input
    return humanizeCron(expr);        // convert to plain English
  } catch {
    return 'Invalid cron expression';
  }
}

function humanizeCron(expr: string): string {
  // Hand-rolled for common patterns; extensible:
  const parts = expr.split(' ');
  // e.g. "0 */6 * * *" -> "Every 6 hours"
  // e.g. "0 9 * * 1-5"  -> "Weekdays at 9:00 AM"
  // e.g. "30 14 * * 0"  -> "At 2:30 PM on Sundays"
  // Fallback: return the validated expression as-is with a note
  return buildDescription(parts);
}
```

`cronUtils.ts` is also imported in the webview bundle (bundler resolves it from the source tree; no extension-host round-trip needed for preview).

### K6 banner state (`ScheduleField.tsx`)

The banner's per-file dismiss state is managed via a `workspaceState` key on the extension host side:

- **Extension host → webview**: the `init` message includes `k6Dismissed: boolean` (looked up by `context.workspaceState.get('agentEditor.k6Dismissed.' + filePath, false)`).
- **Webview → extension host**: when the user clicks Dismiss, the webview posts `{ type: 'dismissK6Banner', filePath }`. The extension host writes `context.workspaceState.update('agentEditor.k6Dismissed.' + filePath, true)`.
- Local React state in `ScheduleField` mirrors the `k6Dismissed` prop and updates on dismiss without waiting for a round-trip.

---

## Message Protocol Summary

### Extension host → webview (AgentEditorProvider)

| Message type | Payload | When sent |
|---|---|---|
| `init` | `AgentEditorInitMessage` | On open, on external file change |
| `flowsUpdated` | `{ flows: string[] }` | After `createFlow` succeeds |
| `authStatusUpdated` | `{ authStatus: Record<string, boolean> }` | After `checkAuthStatus` |

### Webview → extension host (AgentEditorProvider)

| Message type | Payload | Purpose |
|---|---|---|
| `applyEdit` | `{ frontmatter, body }` | Write updated file content |
| `createFlow` | `{ name: string }` | Scaffold new flow file |
| `checkAuthStatus` | `{}` | Refresh credential dots |
| `dismissK6Banner` | `{ filePath: string }` | Persist K6 dismiss |

---

## Tests and Validation

### Unit test candidates

- `discovery.ts` — `parseFrontmatter` with array values, numeric values, boolean values; existing string parsing (regression).
- `discovery.ts` — `discoverCommands` dedup: given two skills with the same name from different roots, verify single `shared` entry is returned.
- `discovery.ts` — `validateAgentFrontmatter`: all four error conditions + the valid case.
- `cronUtils.ts` — `parseCronExpression` with known patterns (`0 */6 * * *`, `0 9 * * 1-5`, `not-a-cron`).
- `AgentEditorProvider` — `serializeFrontmatter` round-trip: parse → serialize → re-parse produces identical record.

### Manual smoke tests

- Open `.claude/agents/sprint-manager.md` in Ritemark dev build → agent editor launches (not text editor).
- Edit name field → file on disk updates within ~300 ms.
- Add a `schedule:` with no `runtime:` → yellow chip appears in Agent Library.
- Skills list shows `[shared]` badge for a skill that exists in both roots.
- Flows section appears in Agent Library; clicking a flow opens the editor.
- Separate Flows activity bar icon is gone.

### Regression checks

- `.claude/skills/*/SKILL.md` still appears in Skills (WS1 must not break skills discovery).
- `.agents/skills/*/SKILL.md` still appears in Skills (already worked; R1 removal must not regress).
- All existing agent rows still appear after R1 removal (no regression to Claude-only workspaces).
- `npm run compile` passes in `extensions/ritemark`.
- `npm run build` passes in `extensions/ritemark/webview` (both `index` and `agent-editor` entries).
- `./scripts/validate-qa.sh` passes.
