# Existing Feature Research

## Current Feature Landscape

### 1. Voice Dictation (Experimental, macOS-only)
**Location:** `extensions/ritemark/src/voiceDictation/`
**Integration:** `ritemarkEditor.ts:315` - DictationController instantiated
**Status:** Implemented but not gated
**Platform:** Currently darwin-only (uses native whisper.cpp binaries)
**User-facing:** Yes - recording UI in webview

**Feature characteristics:**
- Platform-specific binaries (darwin only for now)
- Model download required (75MB whisper model)
- Should be experimental (not stable yet)
- Needs user consent before model download

### 2. Markdown Export (PDF, Word)
**Location:** `extensions/ritemark/src/export/`
**Integration:** `ritemarkEditor.ts:358-369` - Message handlers
**Status:** Implemented but not gated
**Platform:** Cross-platform (uses Node.js libraries)
**User-facing:** Yes - export buttons in editor

**Feature characteristics:**
- PDF: Uses pdfkit
- Word: Uses docx library
- Both are stable, working features
- Should be marked as stable

### 3. AI Assistant
**Location:** `extensions/ritemark/src/ai/`
**Integration:** `extension.ts:28-44` - AIViewProvider registration
**Status:** Implemented, always active
**Platform:** Cross-platform (API-based)
**User-facing:** Yes - sidebar panel

**Feature characteristics:**
- Requires OpenAI API key
- Network-dependent
- Already has opt-in via API key requirement
- Could be marked as stable

### 4. Excel/CSV Viewer
**Location:** `extensions/ritemark/src/excelEditorProvider.ts`
**Integration:** `extension.ts:84-87` - Custom editor registration
**Status:** Implemented, always active
**Platform:** Cross-platform
**User-facing:** Yes - opens .xlsx/.xls/.csv files

**Feature characteristics:**
- Read-only preview
- Stable functionality
- Should be marked as stable

### 5. Update Checker
**Location:** `extensions/ritemark/src/update/`
**Integration:** `extension.ts:20-25` - UpdateService init
**Status:** Implemented with user preference
**Platform:** Cross-platform
**User-facing:** Via settings (`ritemark.updates.enabled`)

**Feature characteristics:**
- Already has configuration in package.json
- Has its own enable/disable setting
- Stable functionality

## Current VS Code Settings

**File:** `extensions/ritemark/package.json`

```json
"configuration": {
  "title": "RiteMark Updates",
  "properties": {
    "ritemark.updates.enabled": {
      "type": "boolean",
      "default": true,
      "description": "Check for updates on startup"
    },
    "ritemark.updates.dismissed": {
      "type": "string",
      "default": "",
      "description": "Last dismissed update version (internal)"
    }
  }
}
```

## Features That Need Gating

### Priority 1: Voice Dictation
- **Status:** experimental
- **Platform:** darwin
- **Reason:** Beta feature, large model download, platform-specific
- **Gate location:** `extension.ts` or `ritemarkEditor.ts` instantiation
- **User setting:** `ritemark.features.voiceDictation` (experimental toggle)

### Priority 2: Markdown Export
- **Status:** stable
- **Platform:** * (all)
- **Reason:** Could have kill-switch if issues found
- **Gate location:** Message handler in `ritemarkEditor.ts`
- **User setting:** Not needed (stable, always on)

### Priority 3: Future Premium Features
- **Status:** premium (not implemented yet)
- **Platform:** TBD
- **Reason:** Future monetization
- **Examples:** Advanced AI features, team collaboration

## Platform Detection Requirements

**Empty file found:** `src/utils/platform.ts`

Need to implement:
```typescript
export function getCurrentPlatform(): 'darwin' | 'win32' | 'linux'
```

Uses VS Code API: `process.platform`

## Integration Points

### 1. Extension Activation (extension.ts)
- Register features conditionally based on flags
- Example: Only create DictationController if enabled

### 2. Message Handlers (ritemarkEditor.ts)
- Check flags before handling feature-specific messages
- Example: Check flag before exportPDF/exportWord

### 3. Package.json Configuration
- Add settings for experimental features
- Users get UI toggles in Settings

### 4. Webview Communication
- Send enabled features list on initial load
- Webview can hide/show UI elements accordingly

## Technical Constraints

1. **No remote config yet** - All flags are static/local
2. **Settings sync** - VS Code handles settings sync automatically
3. **Default values** - experimental = false, stable = true, premium = false
4. **Type safety** - Use TypeScript const assertions for flag IDs
5. **Runtime check** - Single function `isEnabled(flagId)` for easy auditing

## Code Volume Estimate

- `flags.ts`: ~60 lines (flag definitions + TypeScript types)
- `featureGate.ts`: ~40 lines (isEnabled function + platform check)
- `index.ts`: ~5 lines (public API exports)
- `package.json`: ~20 lines (new configuration section)
- Integration changes: ~10-15 locations (wrap existing feature code)

**Total new code:** ~150-200 lines
**Total changes:** ~250-300 lines including refactoring

## Dependencies

- No new npm packages required
- Uses built-in VS Code APIs:
  - `vscode.workspace.getConfiguration()`
  - `process.platform`
  - `vscode.ExtensionContext`

## Risks

1. **Breaking changes** - Gating existing features might break user workflows
   - Mitigation: All currently active features default to enabled

2. **Settings migration** - Existing users have no settings
   - Mitigation: Smart defaults (experimental=false, stable=true)

3. **Platform detection edge cases** - Unexpected platform values
   - Mitigation: Fallback to 'linux' for unknown platforms

4. **Webview sync** - Feature gates must sync with webview UI
   - Mitigation: Send feature state on every load message

## Future Extensibility

### Adding Remote Config (Future Sprint)
1. Add `RemoteConfigService` class
2. Fetch flags from GitHub/CDN on startup
3. Merge remote flags with local flags (remote overrides)
4. Cache remote flags locally
5. **No changes to public API** - `isEnabled()` remains the same

### Adding Premium Licensing (Future Sprint)
1. Add `LicenseService` class
2. Check license status in `isEnabled()` for premium flags
3. Add license activation UI
4. **No changes to flag definitions** - just runtime behavior

## Documentation Updates Needed

### 1. CLAUDE.md
Add new section: "Feature Flag Guidelines"
- When to add a flag
- Decision tree diagram
- How to check flags in code

### 2. Sprint Template
Add checklist item: "Feature flag defined?"

### 3. Agent Instructions
Update `sprint-manager.md`:
- Ask "Does this feature need a flag?" in Phase 2

## Test Cases

### Unit Tests (Not in scope for MVP)
- `isEnabled('stable-feature')` → true
- `isEnabled('experimental-feature')` → false (default)
- `isEnabled('darwin-only-feature')` on Windows → false
- `isEnabled('unknown-feature')` → false

### Manual Testing Checklist
1. Dictation appears in settings as experimental toggle
2. Dictation disabled by default
3. Enabling dictation shows recording button
4. Export buttons always visible (stable)
5. Settings persist across app restarts
6. Platform detection returns correct value

## Sprint Boundary Decisions

### In Scope
- Core feature flag system (flags.ts, featureGate.ts)
- Platform detection utility
- Wrap existing features (dictation, export)
- Package.json configuration
- Documentation updates

### Out of Scope
- Remote configuration (future sprint)
- Premium licensing logic (future sprint)
- Unit tests (can be added later)
- Migration scripts (not needed - smart defaults)
- Telemetry/analytics integration
