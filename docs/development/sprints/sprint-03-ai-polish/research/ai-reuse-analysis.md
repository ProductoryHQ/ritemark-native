# Sprint 03 Research: AI Code Reuse Analysis

## Source: ritemark-app AI Implementation

### Files to Copy/Adapt

| File | Lines | Reuse Strategy |
|------|-------|----------------|
| `services/ai/openAIClient.ts` | 713 | COPY + adapt (remove browser flag) |
| `services/ai/textSearch.ts` | 149 | COPY as-is (editor-agnostic) |
| `services/ai/widgets/core/types.ts` | 133 | COPY as-is |
| `services/ai/widgets/core/WidgetRegistry.ts` | 91 | COPY as-is |
| `services/ai/widgets/rephrase/*` | ~200 | COPY + adapt UI |
| `services/ai/widgets/find-replace/*` | ~200 | COPY + adapt UI |
| `components/ai/AIChatSidebar.tsx` | 757 | COPY + adapt for webview |

### Architecture Summary

**OpenAI Integration:**
- Model: `gpt-5-nano` (fastest for tool selection)
- Streaming with `stream: true`
- Function calling with 3 tools
- 90 second timeout
- AbortController for cancellation

**Tools:**
1. `rephraseText` - Modal preview, style options (longer/shorter/formal/casual)
2. `findAndReplaceAll` - Preview matches, case preservation
3. `insertText` - Smart positioning (absolute/relative/selection)

**Widget System:**
```
ChatWidget interface:
- id, type, state
- displayMode: 'inline' | 'modal'
- initialize(args) → WidgetPreview
- execute() → WidgetResult
- cancel(), destroy()

WidgetRegistry:
- register(plugin)
- findByToolName(toolName)
```

**Text Search (3-tier fallback):**
1. Exact case-insensitive match
2. Markdown-normalized (removes escapes: `\.` → `.`)
3. Unicode-normalized (handles õ, ü, ä)

---

## VS Code Adaptation Required

### 1. API Key Storage

**ritemark-app:** IndexedDB + AES-256-GCM encryption
**ritemark-native:** VS Code SecretStorage API

```typescript
// VS Code SecretStorage (simpler, OS keychain-backed)
class APIKeyManager {
  constructor(private secrets: vscode.SecretStorage) {}

  async storeAPIKey(key: string): Promise<void> {
    await this.secrets.store('openai-api-key', key)
  }

  async getAPIKey(): Promise<string | undefined> {
    return this.secrets.get('openai-api-key')
  }

  async deleteAPIKey(): Promise<void> {
    await this.secrets.delete('openai-api-key')
  }
}
```

### 2. OpenAI Client

**Change:** Remove `dangerouslyAllowBrowser: true`
- VS Code extension runs in Node.js context (not browser)
- OpenAI SDK works natively

### 3. Editor Integration

**ritemark-app:** TipTap editor instance passed directly
**ritemark-native:** postMessage bridge to webview

```typescript
// Extension side
webview.postMessage({ type: 'ai-result', content: '...' })

// Webview side (TipTap)
window.addEventListener('message', (e) => {
  if (e.data.type === 'ai-result') {
    editor.chain().insertContent(e.data.content).run()
  }
})
```

### 4. UI Components

**AIChatSidebar:** Embed in editor webview (not separate panel)
- Sidebar within the webview
- Toggle with Cmd+Shift+A
- Same React components, different container

---

## Implementation Plan

### Phase 1: Core AI Service (Extension Side)
1. Copy `openAIClient.ts` → adapt for Node.js
2. Copy `textSearch.ts` → no changes
3. Create `apiKeyManager.ts` using SecretStorage
4. Copy widget types and registry

### Phase 2: UI Components (Webview Side)
1. Copy `AIChatSidebar.tsx` → adapt imports
2. Copy widget UI components
3. Wire postMessage bridge for AI commands

### Phase 3: Integration
1. Connect extension ↔ webview messaging
2. Add "Configure API Key" command
3. Show key status in sidebar
4. Test all tools end-to-end

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OpenAI API differences | Low | Same SDK, just different runtime |
| Widget UI styling | Medium | Use existing Tailwind, may need tweaks |
| postMessage complexity | Medium | Clear message protocol, typed interfaces |
| Streaming in webview | Low | Same pattern as ritemark-app |

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Copy + adapt AI services | 4h |
| SecretStorage integration | 2h |
| Copy + adapt UI components | 6h |
| postMessage bridge | 4h |
| Testing + debugging | 4h |
| **Total** | **~20h** |
