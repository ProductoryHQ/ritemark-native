# Sprint 03: AI & Polish

**Goal:** Add AI assistant with ~80% code reuse from ritemark-app, plus UX polish

**Status:** ✅ COMPLETE (2025-12-01)

**Approach:** Copy proven AI code, adapt for VS Code extension architecture

---

## Exit Criteria (Jarmo Validates)

- [x] AI sidebar works in editor (toggle with Cmd+Shift+A)
- [x] Can rephrase selected text (modal preview)
- [x] Can find/replace across document (preview matches)
- [x] Can insert content at position
- [x] API key setup via command palette works
- [x] Offline shows clear "Connect for AI" message
- [x] Jarmo: "This is polished enough to show users"

---

## Phase Checklist

### Phase 1: RESEARCH ✅
- [x] Analyze ritemark-app AI implementation
- [x] Document code reuse strategy
- [x] Identify VS Code adaptations needed
- [x] Research SecretStorage API

### Phase 2: PLAN ✅
- [x] Create sprint folder structure
- [x] Write sprint-plan.md (this file)
- [x] **⚠️ Jarmo approval to proceed** (2025-11-30)

### Phase 3: DEVELOP

#### Task 1: API Key Management (SecretStorage) ✅
- [x] Create `apiKeyManager.ts` using VS Code SecretStorage
- [x] Register command: `ritemark.configureApiKey`
- [x] Input prompt for API key entry
- [x] Validate `sk-` prefix
- [x] Store/retrieve/delete operations

#### Task 2: Core AI Service (Extension Side) ✅
- [x] Copy `openAIClient.ts` → remove `dangerouslyAllowBrowser`
- [x] Copy `textSearch.ts` (adapted for plain text)
- [x] Copy widget types (`types.ts`)
- [x] Adapt imports for extension context
- [x] Wire API key retrieval from SecretStorage
- [x] Add dependencies (openai, turndown)

#### Task 3: AI Message Bridge (Extension Side) ✅
- [x] Define message protocol (extension ↔ webview)
  - `ai-execute`: Send prompt to AI
  - `ai-streaming`: Progressive content updates
  - `ai-result`: Final result or widget
  - `ai-error`: Error handling
  - `ai-cancel`: User cancellation
  - `ai-key-status`: Check API key
  - `ai-configure-key`: Open settings
  - `ai-widget`: Tool call result
  - `ai-stopped`: User cancelled
- [x] Implement handlers in `ritemarkEditor.ts`
- [x] Implement handlers in webview (Task 4)

#### Task 4: AI Sidebar UI (Webview) ✅
- [x] Create `AIChatSidebar.tsx` (simplified version)
- [x] Selection indicator in sidebar
- [x] Add sidebar toggle (Cmd+Shift+A)
- [x] Show "API key not configured" state with setup button
- [x] Wire streaming display
- [x] Wire tool execution (rephrase, findReplace, insert)
- [x] Update App.tsx with AI state management
- [x] Show "Offline" state

#### Task 5: Widget System ✅
- [x] Copy `RephraseWidget.ts` + UI
- [x] Copy `FindReplaceWidget.ts` + UI
- [x] Copy `WidgetRenderer.tsx`
- [x] Adapt for webview context
- [x] Test modal display mode

#### Task 6: Offline Detection ✅
- [x] Detect network connectivity
- [x] Status bar indicator (Ready/Offline)
- [x] AI sidebar shows offline message
- [x] Graceful degradation (editing still works)

#### Task 7: UX Polish ✅
- [x] Welcome screen on first launch (Walkthrough)
- [x] Hide unused VS Code Activity Bar items
- [x] Lucide icon integration for activity bar
- [x] Activity bar icon size tuning (16px)

### Phase 4: TEST & VALIDATE ✅
- [x] Test API key flow (configure, use, delete)
- [x] Test rephrase with various styles
- [x] Test find/replace with case preservation
- [x] Test insert at different positions
- [x] Test streaming + cancellation
- [x] Test offline mode
- [x] Test error scenarios (401, 429, timeout)
- [x] Jarmo tests and approves

### Phase 5: CLEANUP ✅
- [x] Remove debug logging
- [x] Remove unused copied code
- [x] Update documentation
- [x] Code review

### Phase 6: CI/CD DEPLOY
- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Tag: `v0.3.0-ai`

---

## Message Protocol (Extension ↔ Webview)

### Webview → Extension

```typescript
// Execute AI command
{ type: 'ai-execute', prompt: string, selection: EditorSelection }

// Cancel ongoing request
{ type: 'ai-cancel' }

// Request API key status
{ type: 'ai-key-status' }

// Open API key configuration
{ type: 'ai-configure-key' }
```

### Extension → Webview

```typescript
// Streaming content update
{ type: 'ai-streaming', content: string }

// Final result (conversational)
{ type: 'ai-result', success: true, message: string }

// Widget result (for modal operations)
{ type: 'ai-widget', widgetType: string, args: any }

// Error
{ type: 'ai-error', error: string }

// API key status
{ type: 'ai-key-status', hasKey: boolean }
```

---

## File Structure (After Sprint)

```
extensions/ritemark/
├── src/
│   ├── extension.ts
│   ├── ritemarkEditor.ts        # + AI message handlers
│   ├── ai/
│   │   ├── apiKeyManager.ts     # NEW - SecretStorage wrapper
│   │   ├── openAIClient.ts      # COPY from ritemark-app
│   │   ├── textSearch.ts        # COPY from ritemark-app
│   │   └── widgets/
│   │       ├── types.ts         # COPY
│   │       ├── WidgetRegistry.ts # COPY
│   │       ├── RephraseWidget.ts # COPY + adapt
│   │       └── FindReplaceWidget.ts # COPY + adapt
│   └── commands/
│       └── configureApiKey.ts   # NEW
├── webview/
│   └── src/
│       ├── App.tsx              # + AI sidebar integration
│       ├── components/
│       │   ├── Editor.tsx
│       │   ├── ai/
│       │   │   ├── AIChatSidebar.tsx    # COPY + adapt
│       │   │   ├── SelectionIndicator.tsx # COPY
│       │   │   └── WidgetRenderer.tsx   # COPY + adapt
│       │   └── ...
│       └── bridge.ts            # + AI message handlers
```

---

## Dependencies to Add

```json
{
  "openai": "^4.x"
}
```

Note: No `idb` package needed - using VS Code SecretStorage instead.

---

## Estimated Duration

| Task | Hours |
|------|-------|
| Task 1: API Key Management | 2h |
| Task 2: Core AI Service | 4h |
| Task 3: Message Bridge | 4h |
| Task 4: AI Sidebar UI | 6h |
| Task 5: Widget System | 4h |
| Task 6: Offline Detection | 2h |
| Task 7: UX Polish | 4h |
| Testing + Debugging | 4h |
| **Total** | **~30h / 4-5 days** |

---

## Notes

_Implementation notes will be added during development_
