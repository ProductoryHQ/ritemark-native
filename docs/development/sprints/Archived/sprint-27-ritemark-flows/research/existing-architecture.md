# Existing Architecture Analysis

## Sidebar View Pattern (UnifiedViewProvider)

The AI panel follows a webview view provider pattern that we can replicate for Flows:

```typescript
// extensions/ritemark/src/views/UnifiedViewProvider.ts
export class UnifiedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.unifiedView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (message) => {
      // Handle messages from webview
    });
  }
}
```

**Key learnings:**
- View provider is registered in `extension.ts` with `vscode.window.registerWebviewViewProvider`
- View type must be declared in `package.json` under `contributes.views`
- Uses message passing pattern for webview ↔ extension communication
- Workspace path is available for file operations

## OpenAI Service Integration

Already available at `extensions/ritemark/src/ai/openaiService.ts`:

```typescript
// We can reuse existing service for LLM nodes
import { generateCompletion } from './ai/openaiService';

const response = await generateCompletion({
  prompt: userPrompt,
  systemPrompt: systemPrompt,
  model: 'gpt-4o-mini', // or user's choice
  apiKey: apiKeyManager.getAPIKey(),
  // ... other options
});
```

**Already supported models (from apiKeyManager):**
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo

**Image generation:** Not yet implemented. Will need to add OpenAI Images API calls.

## File System Operations

VS Code API provides workspace file operations:

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Get workspace root
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
const workspacePath = workspaceFolder?.uri.fsPath;

// Create directory
const flowsDir = path.join(workspacePath, '.flows');
await fs.mkdir(flowsDir, { recursive: true });

// Write file
const flowPath = path.join(flowsDir, 'my-flow.flow.json');
await fs.writeFile(flowPath, JSON.stringify(flowData, null, 2));

// Read file
const content = await fs.readFile(flowPath, 'utf-8');
const flowData = JSON.parse(content);

// List files
const files = await fs.readdir(flowsDir);
const flowFiles = files.filter(f => f.endsWith('.flow.json'));
```

## Feature Flag Pattern

From `extensions/ritemark/src/features/flags.ts`:

```typescript
export type FlagId = 'voice-dictation' | 'markdown-export' | 'document-search';

export const FLAGS: Record<FlagId, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text using Whisper (macOS only)',
    status: 'stable', // or 'experimental', 'disabled', 'premium'
    platforms: ['darwin'],
  },
};
```

**For Flows:**
- Add `'ritemark-flows'` to FlagId union type
- Status: `'experimental'` (requires user opt-in)
- Platforms: `['darwin', 'win32', 'linux']` (cross-platform)
- Add setting to `package.json`: `ritemark.experimental.ritemarkFlows`

## Webview Integration

Webview uses Vite + React. Bundle is built with:

```bash
cd extensions/ritemark/webview
npm run build
# Output: media/webview.js (~900KB)
```

**Current dependencies (package.json):**
- React 18.2
- TipTap 2.1 (editor)
- Tailwind CSS 3.3
- Radix UI components (shadcn/ui base)
- Vite 5.0

**Will need to add:**
- `reactflow` ^12.x
- `@xyflow/react` ^12.x
- `zustand` ^5.x
- `elkjs` ^0.9.x (optional, for auto-layout)

## Message Passing Pattern

Extension → Webview:

```typescript
webviewView.webview.postMessage({
  type: 'flow:loaded',
  flow: flowData
});
```

Webview → Extension:

```typescript
// In React component
const vscode = acquireVsCodeApi();
vscode.postMessage({
  type: 'flow:save',
  flow: flowData
});
```

Extension handler:

```typescript
webviewView.webview.onDidReceiveMessage(async (message) => {
  switch (message.type) {
    case 'flow:save':
      await saveFlow(message.flow);
      break;
  }
});
```

## View Container Registration

From `package.json`:

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "ritemark-ai",
      "title": "Ritemark AI",
      "icon": "media/bot-icon.svg"
    }
  ]
},
"views": {
  "ritemark-ai": [
    {
      "type": "webview",
      "id": "ritemark.unifiedView",
      "name": "Ritemark AI",
      "contextualTitle": "Ritemark AI",
      "visibility": "collapsed"
    }
  ]
}
```

**For Flows (two options):**

**Option A: New activity bar container**
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "ritemark-flows",
      "title": "Ritemark Flows",
      "icon": "media/flows-icon.svg"
    }
  ]
}
```

**Option B: Add to existing AI container** (simpler, keeps UI consolidated)
```json
"views": {
  "ritemark-ai": [
    {
      "type": "webview",
      "id": "ritemark.flowsView",
      "name": "Flows",
      "contextualTitle": "Flows"
    }
  ]
}
```

**Recommendation:** Option B for MVP. Can split to separate container later if needed.

## Build Process

Extension compiles with TypeScript:

```bash
cd extensions/ritemark
npm run watch  # Development (auto-compile)
npm run compile  # One-time build
```

Webview compiles separately:

```bash
cd extensions/ritemark/webview
npm run build  # Production bundle to media/webview.js
npm run dev  # Development mode with HMR
```

## Testing in Dev Mode

From vscode-expert knowledge:

```bash
cd vscode
./scripts/code.sh --extensions-dir=../extensions/ritemark
```

This launches VS Code OSS with the Ritemark extension loaded, allowing live testing.

## Summary

**What we can reuse:**
- View provider pattern (UnifiedViewProvider as template)
- OpenAI service for LLM nodes
- File system operations (fs/promises)
- Message passing pattern
- Feature flag system
- Webview build process

**What we need to add:**
- FlowsViewProvider (new)
- FlowStorage service (CRUD for .flow.json)
- FlowExecutor service (sequential runner)
- React Flow UI components in webview
- Image generation API calls (OpenAI Images)
- Feature flag for experimental gating

**Dependencies to add:**
- Webview: reactflow, @xyflow/react, zustand, elkjs
- Extension: None (reuse existing)
