# Sprint 77 Technical Plan

## Architecture Overview

Sprint 77 touches three layers:

1. **Extension host — discovery layer** (`extensions/ritemark/src/agent/discovery.ts`): Fixes the Codex discovery bug, adds provenance tracking and deduplication, extends frontmatter parsing to handle YAML arrays and numbers, and adds a frontmatter validator. All data flows from here to the views.

2. **Extension host — views layer** (`extensions/ritemark/src/views/AgentLibraryViewProvider.ts`): The Agent Library gains a Flows section and provenance badge rendering. No new view provider is created.

3. **Existing webview bundle** (`extensions/ritemark/webview/`): The **existing** `webview.js` bundle gains the `AgentConfiguratorPanel` component. No new Vite entry, no new HTML entry point. `App.tsx` gains `'agent'` in the `activePanel` union, which renders the 220px left panel when `isAgentMode` is true. The existing `ritemark.editor` (`RitemarkEditorProvider`) sends `isAgentMode: boolean` in the `init` message — true when the file path matches `**/.claude/agents/*.md`.

4. **Extension entry** (`extensions/ritemark/src/extension.ts`, `extensions/ritemark/package.json`): The `ritemark-flows` activity bar container and `ritemark.flowsView` view registration are removed. No new custom editor registration.

Components that are NOT touched by this sprint: `FlowStorage.ts`, `FlowExecutor.ts`, `FlowScheduleState.ts`, VS Code patches, and the Vite build configuration.

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

## Workstream 4: Agent mode in existing editor (R5 + R6)

### Files

- `extensions/ritemark/src/views/RitemarkEditorProvider.ts` — add `isAgentMode` detection + new message fields to `init`
- `extensions/ritemark/webview/src/App.tsx` — add `'agent'` to `activePanel` union, render `AgentConfiguratorPanel`
- `extensions/ritemark/webview/src/components/agent/AgentConfiguratorPanel.tsx` — NEW component (220px panel)
- `extensions/ritemark/webview/src/components/agent/ScheduleField.tsx` — NEW sub-component
- `extensions/ritemark/webview/src/components/agent/ProvenanceBadge.tsx` — NEW sub-component (reusable)

No new Vite entry. No new HTML file. No new extension host provider.

### RitemarkEditorProvider changes (extension host)

In `resolveCustomTextEditor` (or wherever the `init` message is built), detect agent mode:

```typescript
const isAgentMode = /[\/\\]\.claude[\/\\]agents[\/\\][^\/\\]+\.md$/.test(document.uri.fsPath);
```

Extend the existing `init` message payload with:

```typescript
isAgentMode: boolean;
frontmatter: Record<string, FrontmatterValue>;  // parsed via parseFrontmatter()
flows: string[];           // .flow.json stems in .ritemark/flows/
skills: DiscoveredCommand[];  // all discovered skills with provenance
authStatus: Record<string, boolean>;  // { claude_local: true, ... }
k6Dismissed: boolean;      // workspaceState key: 'agentEditor.k6Dismissed.<filePath>'
```

These fields are only populated when `isAgentMode` is true. Non-agent files continue to receive the existing `init` shape unchanged.

Handle two new incoming message types:
- `{ type: 'applyFrontmatter', frontmatter }` — serialise frontmatter back to YAML block and apply to file via `vscode.workspace.applyEdit` (debounced 300 ms; body unchanged).
- `{ type: 'dismissK6Banner', filePath }` — write `workspaceState.update('agentEditor.k6Dismissed.' + filePath, true)`.
- `{ type: 'createFlow', name }` — scaffold new `.flow.json`, send `{ type: 'flowsUpdated', flows: string[] }` back.

**Frontmatter serialiser** (add to `RitemarkEditorProvider`):

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
      const safe = /[:#\[\]{}&*!|>'",%@`]/.test(String(v)) || String(v).includes('\n')
        ? JSON.stringify(v) : v;
      lines.push(`${k}: ${safe}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
```

### App.tsx changes (webview)

```typescript
// Extend activePanel union
type ActivePanel = 'none' | 'toc' | 'properties' | 'agent';
```

In the init message handler, if `isAgentMode` is true, set `activePanel` to `'agent'` (overrides any persisted value for that document).

In the panel render row (the `flex-1 flex overflow-hidden` row):

```tsx
{activePanel === 'agent' && (
  <AgentConfiguratorPanel
    frontmatter={agentFrontmatter}
    flows={agentFlows}
    skills={agentSkills}
    authStatus={agentAuthStatus}
    k6Dismissed={agentK6Dismissed}
    onFrontmatterChange={handleFrontmatterChange}  // debounced 300ms → posts applyFrontmatter
    onCreateFlow={handleCreateFlow}
    onDismissK6Banner={handleDismissK6Banner}
  />
)}
{/* existing TOC and Properties panels below */}
{activePanel === 'toc' && <InlineTableOfContents />}
{activePanel === 'properties' && <PropertiesSidePanel />}
<div className="flex-1 overflow-y-auto"><Editor /></div>
```

### AgentConfiguratorPanel component

Location: `webview/src/components/agent/AgentConfiguratorPanel.tsx`

**Structure must mirror `PropertiesSidePanel` exactly:**

```tsx
<div className="w-[220px] flex-shrink-0 h-full overflow-y-auto border-r border-hairline"
     style={{ background: 'var(--vscode-editor-background)' }}>
  <div className="flex flex-col gap-3 px-4 py-4">
    <h2 className="text-[15px] font-semibold text-ink-strong">Agent</h2>
    {/* field sections */}
  </div>
</div>
```

**UI component rules (enforced, no exceptions):**

| Field | shadcn component | Notes |
|---|---|---|
| name | `Input` | text, debounce 300ms |
| description | `Textarea` | rows=3 |
| icon | `Select` | Phosphor icon names |
| color | `button` swatches | 7 Ritemark brand colours |
| Agent runtimes | `ritemark-filter-chip` row | 4 options; `ritemark-dot` auth status |
| Model | `Select` | filtered by runtime |
| Schedule | `Input` | + preview line + `ScheduleField` |
| Linked flow | `Select` | flow stems + "＋ Create new flow…" |
| Skills | `Input` + tag pills | tag autocomplete; `ritemark-pill-soft.is-accent` tags; `ProvenanceBadge` |
| Allowed tools | `Checkbox` rows | single column; tool-name 56px + description text |

**Section dividers** use `<hr className="border-hairline my-1" />`. Section labels use `<Label className="text-[11px] font-semibold text-ink-strong uppercase tracking-wide">` — same pattern as `PropertiesSidePanel` group headers.

### Provenance badge component

```tsx
// webview/src/components/agent/ProvenanceBadge.tsx
// Reuses ritemark-pill-soft pattern from components.md
const variants = {
  claude: 'bg-accent-soft text-accent border border-accent-fainter',
  codex:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  shared: 'bg-surface-soft text-ink-muted border border-hairline',
} as const;

export function ProvenanceBadge({ provenance }: { provenance: 'claude' | 'codex' | 'shared' }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold tracking-wide ${variants[provenance]}`}>
      {provenance}
    </span>
  );
}
```

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

- Open `.claude/agents/sprint-manager.md` in Ritemark dev build → AgentConfiguratorPanel appears on the left (220px); TipTap editor takes remaining width.
- Edit name field in Configurator → file on disk updates within ~300 ms.
- Add a `schedule:` with no `runtime:` → yellow chip appears in Agent Library.
- Skills list shows `[shared]` badge for a skill that exists in both roots.
- Flows section appears in Agent Library; clicking a flow opens the editor.
- Separate Flows activity bar icon is gone.

### Regression checks

- `.claude/skills/*/SKILL.md` still appears in Skills (WS1 must not break skills discovery).
- `.agents/skills/*/SKILL.md` still appears in Skills (already worked; R1 removal must not regress).
- All existing agent rows still appear after R1 removal (no regression to Claude-only workspaces).
- `npm run compile` passes in `extensions/ritemark`.
- `npm run build` passes in `extensions/ritemark/webview` (`index` entry only — no new entry added).
- `./scripts/validate-qa.sh` passes.
