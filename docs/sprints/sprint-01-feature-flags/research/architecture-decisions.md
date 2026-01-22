# Feature Flag Architecture Decisions

## Design Principles

1. **Simple over configurable** - 90% of features use defaults
2. **Static over dynamic** - Flags defined in code, not JSON
3. **Single source of truth** - One place to check if feature enabled
4. **Future-proof API** - Can add remote config without changing call sites
5. **Type-safe** - TypeScript catches typos at compile time

## Architecture Overview

```
Feature Flag System
├── flags.ts          (Static flag register - source of truth)
├── featureGate.ts    (Runtime evaluation - isEnabled())
├── index.ts          (Public API)
└── utils/platform.ts (Platform detection helper)

Integration Points
├── extension.ts      (Feature activation)
├── ritemarkEditor.ts (Message handlers)
└── package.json      (VS Code settings UI)
```

## Core Interfaces

### FeatureFlag Definition

```typescript
export interface FeatureFlag {
  id: string;                    // Unique identifier (e.g., 'voice-dictation')
  label: string;                 // User-facing name (e.g., 'Voice Dictation')
  description?: string;          // Help text for settings UI
  status: 'stable' | 'experimental' | 'disabled' | 'premium';
  platforms: Array<'darwin' | 'win32' | 'linux' | '*'>;
}
```

### Status Definitions

| Status | Default Enabled | User Override | UI Visibility | Purpose |
|--------|----------------|---------------|---------------|---------|
| `stable` | Yes | No (hidden) | Always shown | Production-ready features |
| `experimental` | No | Yes (toggle) | Shown in Settings | Beta features needing feedback |
| `disabled` | No | No (hidden) | Hidden | Kill-switch for broken features |
| `premium` | No | No (hidden) | Hidden | Future paid features |

### Platform Filtering

- `['*']` - All platforms (most features)
- `['darwin']` - macOS only (e.g., voice dictation v1)
- `['darwin', 'win32']` - macOS + Windows
- `['linux']` - Linux only

## Implementation Details

### 1. Static Flag Register (flags.ts)

```typescript
export const FLAGS = {
  VOICE_DICTATION: {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Transcribe speech to text using Whisper AI (experimental)',
    status: 'experimental',
    platforms: ['darwin'], // macOS only for now
  },
  MARKDOWN_EXPORT: {
    id: 'markdown-export',
    label: 'Markdown Export',
    description: 'Export to PDF and Word formats',
    status: 'stable',
    platforms: ['*'],
  },
  // Future: TEAM_COLLABORATION: { status: 'premium', ... }
} as const;

// Type-safe flag ID union
export type FlagId = typeof FLAGS[keyof typeof FLAGS]['id'];
```

**Why const assertion?**
- TypeScript infers literal types ('voice-dictation' not string)
- Catches typos at compile time
- Enables autocomplete in IDEs

### 2. Runtime Gate Function (featureGate.ts)

```typescript
import * as vscode from 'vscode';
import { FLAGS, FlagId } from './flags';
import { getCurrentPlatform } from '../utils/platform';

export function isEnabled(flagId: FlagId): boolean {
  // 1. Find flag definition
  const flag = Object.values(FLAGS).find(f => f.id === flagId);
  if (!flag) {
    console.warn(`Unknown feature flag: ${flagId}`);
    return false;
  }

  // 2. Check platform compatibility
  const currentPlatform = getCurrentPlatform();
  const platformMatch = flag.platforms.includes('*') ||
                       flag.platforms.includes(currentPlatform);
  if (!platformMatch) {
    return false;
  }

  // 3. Check status
  switch (flag.status) {
    case 'disabled':
      return false; // Always off

    case 'premium':
      return false; // TODO: Check license in future sprint

    case 'stable':
      return true;  // Always on

    case 'experimental':
      // Check user setting (default: false)
      const config = vscode.workspace.getConfiguration('ritemark.features');
      return config.get(flagId, false);

    default:
      return false;
  }
}
```

**Evaluation order:**
1. Flag exists? (unknown flags = disabled)
2. Platform supported? (wrong platform = disabled)
3. Status allows? (disabled/premium = off, stable = on, experimental = check setting)

### 3. Platform Detection (utils/platform.ts)

```typescript
export function getCurrentPlatform(): 'darwin' | 'win32' | 'linux' {
  const platform = process.platform;

  // Handle known platforms
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') {
    return platform;
  }

  // Fallback for unknown platforms (e.g., 'freebsd', 'sunos')
  console.warn(`Unknown platform: ${platform}, defaulting to linux`);
  return 'linux';
}
```

### 4. VS Code Configuration (package.json)

```json
{
  "contributes": {
    "configuration": {
      "title": "RiteMark Features",
      "properties": {
        "ritemark.features.voice-dictation": {
          "type": "boolean",
          "default": false,
          "description": "Enable voice dictation (experimental, macOS only)",
          "scope": "application"
        }
      }
    }
  }
}
```

**Note:** Only experimental features appear in settings. Stable features are hidden.

## Integration Patterns

### Pattern 1: Feature Activation (extension.ts)

**Before:**
```typescript
// Feature always activated
aiViewProvider = new AIViewProvider(context.extensionUri);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(AIViewProvider.viewType, aiViewProvider)
);
```

**After:**
```typescript
import { isEnabled } from './features';

if (isEnabled('ai-assistant')) {
  aiViewProvider = new AIViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AIViewProvider.viewType, aiViewProvider)
  );
}
```

### Pattern 2: Message Handlers (ritemarkEditor.ts)

**Before:**
```typescript
case 'exportPDF':
  await exportToPDF(markdown, properties, document.uri);
  break;
```

**After:**
```typescript
case 'exportPDF':
  if (isEnabled('markdown-export')) {
    await exportToPDF(markdown, properties, document.uri);
  } else {
    webview.postMessage({ type: 'export-disabled' });
  }
  break;
```

### Pattern 3: Conditional Instantiation

**Before:**
```typescript
this.dictationController = new DictationController(webview, this.context);
```

**After:**
```typescript
if (isEnabled('voice-dictation')) {
  this.dictationController = new DictationController(webview, this.context);
}
```

### Pattern 4: Webview Feature List

**New pattern - send enabled features on load:**
```typescript
webview.postMessage({
  type: 'load',
  content: markdown,
  features: {
    voiceDictation: isEnabled('voice-dictation'),
    markdownExport: isEnabled('markdown-export'),
  }
});
```

Webview can hide/disable UI elements based on this.

## File Structure

```
extensions/ritemark/src/
├── features/
│   ├── index.ts          # Public API: export { isEnabled, FLAGS }
│   ├── flags.ts          # Flag definitions
│   └── featureGate.ts    # isEnabled() implementation
├── utils/
│   └── platform.ts       # getCurrentPlatform() helper
└── extension.ts          # Import and use isEnabled()
```

## Configuration Naming Convention

**Pattern:** `ritemark.features.<flag-id>`

Examples:
- `ritemark.features.voice-dictation` (experimental toggle)
- `ritemark.features.advanced-ai` (future experimental)

**Why this pattern?**
- Groups all feature toggles under one namespace
- Settings UI shows them together
- Easy to find and manage
- Consistent with VS Code conventions

## Future Extensibility

### Adding Remote Config (Future Sprint)

```typescript
// Step 1: Add remote flag fetching
export class RemoteConfigService {
  async fetchFlags(): Promise<RemoteFlags> {
    // Fetch from GitHub/CDN
  }
}

// Step 2: Merge with local flags in isEnabled()
export function isEnabled(flagId: FlagId): boolean {
  const flag = Object.values(FLAGS).find(f => f.id === flagId);

  // Check remote override (if available)
  const remoteOverride = remoteConfig.get(flagId);
  if (remoteOverride !== undefined) {
    return remoteOverride; // Remote takes precedence
  }

  // Fall back to local evaluation
  // ... (rest of current logic)
}
```

**Key point:** Call sites don't change. They still use `isEnabled(flagId)`.

### Adding Premium Licensing (Future Sprint)

```typescript
// Step 1: Add license service
export class LicenseService {
  isFeatureAllowed(flagId: string): boolean {
    // Check license tier
  }
}

// Step 2: Check license in isEnabled()
case 'premium':
  return licenseService.isFeatureAllowed(flagId);
```

**Key point:** Flag definitions don't change. Just runtime behavior.

## Testing Strategy

### Manual Testing
1. Toggle experimental features in Settings UI
2. Restart app and verify persistence
3. Test on different platforms (platform filtering)
4. Test with unknown flag ID (should return false)

### Future Unit Tests
- Mock `vscode.workspace.getConfiguration()`
- Mock `process.platform`
- Test each status type
- Test platform filtering logic

## Security Considerations

1. **No user input** - Flag IDs are compile-time constants
2. **Settings validation** - VS Code validates boolean values
3. **Safe defaults** - experimental = false, premium = false
4. **No eval/dynamic code** - All checks are static

## Performance Considerations

1. **Fast lookup** - O(n) search through FLAGS object (small n)
2. **No caching needed** - Config reads are fast
3. **Lazy evaluation** - Only check flags when feature used
4. **No network calls** - All local (for now)

## Migration Path

### For Existing Users
- No breaking changes
- All currently active features default to enabled
- New experimental features default to disabled

### For New Users
- Clean slate with sensible defaults
- Experimental features require opt-in

## Decision Log

### Why not JSON config file?
- Harder to type-check
- Requires file I/O
- Less discoverable for developers
- Can add later without breaking changes

### Why not use VS Code's when clauses?
- Limited to UI visibility
- Can't control code execution
- Less flexible for complex logic
- Feature flags complement when clauses

### Why separate experimental from disabled?
- experimental = temporary (will become stable or removed)
- disabled = emergency kill-switch (could be re-enabled)
- Different user expectations

### Why include premium status now?
- Signals future monetization plan
- Prevents refactoring later
- Currently behaves like disabled
- Easy to activate when ready

## Open Questions (for Jarmo)

None - architecture fully defined in user requirements.

## Next Steps (Phase 2: Planning)

1. Create detailed implementation checklist
2. Define success criteria
3. List all integration points
4. Identify documentation updates needed
5. Get approval to proceed
