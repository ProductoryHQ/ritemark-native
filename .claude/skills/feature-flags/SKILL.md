---
name: feature-flags
description: Feature flag system for Ritemark - when to use flags, how to implement them, lifecycle management. Use when adding new features that need gating, platform restrictions, or experimental status.
version: 1.0.0
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Feature Flags

Ritemark uses feature flags to control feature availability based on platform, stability, and user preferences.

## When to Use This Skill

- Adding a new feature that should be gated
- Making a feature platform-specific (e.g., macOS-only)
- Shipping experimental features safely
- Planning feature rollout strategy

## When to Use Feature Flags

Use a feature flag if the feature is:

| Scenario | Flag Status | Example |
| --- | --- | --- |
| Platform-specific (e.g., macOS-only) | `experimental` or `stable` | Voice dictation (darwin only) |
| Experimental/unstable | `experimental` | New AI features in beta |
| Requires large download | `experimental` | Whisper model (~75MB) |
| Premium/paid feature | `premium` | Future: Pro features |
| Needs kill-switch | `stable` or `experimental` | Features that might break |
| Large UI change | `experimental` | Major editor redesigns |

**Do NOT use flags for:**
- Bug fixes
- Internal refactoring
- Small UI tweaks
- Core infrastructure

## Implementation

### Source Files

```
extensions/ritemark/src/features/
├── flags.ts          # Flag definitions
├── index.ts          # isEnabled() export
└── settings.ts       # User setting sync
```

### How to Check Flags

```typescript
import { isEnabled } from './features';

// Gate feature initialization
if (isEnabled('voice-dictation')) {
  this.dictationController = new DictationController(webview, context);
}

// Gate message handlers
case 'dictation:start':
  if (!isEnabled('voice-dictation')) {
    return; // or show error
  }
  // ... handle dictation
```

### Adding a New Flag

1. Define in `extensions/ritemark/src/features/flags.ts`
2. Add setting to `package.json` (if experimental)
3. Gate feature code with `isEnabled(flagId)`
4. Send feature state to webview (if UI needs it)
5. Update sprint documentation

### Flag Definition Example

```typescript
// In flags.ts
export const FLAGS: Record<string, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    name: 'Voice Dictation',
    description: 'Dictate text using Whisper',
    status: 'experimental',
    platforms: ['darwin'],  // macOS only
  },
  'document-search': {
    id: 'document-search',
    name: 'Document Search',
    description: 'Search across all documents',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
};
```

## Flag Lifecycle

1. **New feature** -> Add as `experimental` (default OFF, requires user opt-in)
2. **Testing phase** -> Users enable via Settings UI
3. **Stable** -> Change status to `stable` (default ON)
4. **Mature** -> Remove flag entirely (feature is permanent)
5. **Deprecation** -> Set to `disabled` (prevent usage)

## Flag Evaluation Logic

```
1. Flag exists? -> No: false (+ warning)
2. Status = 'disabled'? -> Yes: false
3. Status = 'premium'? -> Yes: false (future: check license)
4. Platform supported? -> No: false
5. Status = 'stable'? -> Yes: true
6. Status = 'experimental'? -> Check user setting (default: false)
```

## Best Practices

- **Gate at the highest level** (activation, not every function call)
- **One flag per feature** (don't combine unrelated features)
- **Default experimental features to OFF** (opt-in for safety)
- **Send feature state to webview** (so UI can hide disabled features)
- **Provide helpful error messages** (when feature is disabled)

## Webview Integration

Send feature state to webview on initialization:

```typescript
// In extension
webview.postMessage({
  type: 'features:state',
  features: {
    'voice-dictation': isEnabled('voice-dictation'),
    'document-search': isEnabled('document-search'),
  }
});

// In webview React component
const features = useFeatures();
if (!features['voice-dictation']) return null;
```

## Settings UI Integration

Experimental features appear in VS Code settings under `ritemark.experimental.*`:

```json
// package.json contributes.configuration
{
  "ritemark.experimental.voiceDictation": {
    "type": "boolean",
    "default": false,
    "description": "Enable voice dictation (requires microphone)"
  }
}
```
