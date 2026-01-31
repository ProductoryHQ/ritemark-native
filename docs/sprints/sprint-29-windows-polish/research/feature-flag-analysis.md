# Feature Flag System Analysis

## Current Implementation

### Extension Side (Working Correctly)

**Location:** `extensions/ritemark/src/features/flags.ts`

```typescript
export const FLAGS: Record<FlagId, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text using Whisper (macOS only)',
    status: 'stable',
    platforms: ['darwin'],  // <-- Correctly limited to macOS
  },
  // ... other flags
};
```

**Evaluation:** `extensions/ritemark/src/features/featureGate.ts`
- Checks platform (darwin, win32, linux)
- Checks status (stable, experimental, disabled, premium)
- Checks user settings (for experimental features)
- Returns `false` on Windows for voice-dictation

**Sent to Webview:** `extensions/ritemark/src/ritemarkEditor.ts` lines 141-144

```typescript
features: {
  voiceDictation: isEnabled('voice-dictation'),  // false on Windows
  markdownExport: isEnabled('markdown-export')
}
```

### Webview Side (NOT Checking Flags)

**Current behavior:**
- `App.tsx` receives `features` in load message
- BUT does not store it in state
- Does not pass it to child components
- `DocumentHeader.tsx` always renders `<VoiceDictationButton />`

**Problem:**
- Button shows on Windows even though feature doesn't work
- User sees non-functional UI element

## Fix Required

### Step 1: Store features in App state

```typescript
// App.tsx
const [features, setFeatures] = useState<{ voiceDictation: boolean; markdownExport: boolean }>({
  voiceDictation: false,
  markdownExport: false
})

// In onMessage('load'):
setFeatures((message.features as { voiceDictation: boolean; markdownExport: boolean }) || {
  voiceDictation: false,
  markdownExport: false
})
```

### Step 2: Pass to DocumentHeader

```typescript
// App.tsx
<DocumentHeader
  // ... existing props
  features={features}
/>
```

### Step 3: Conditionally render button

```typescript
// DocumentHeader.tsx
interface DocumentHeaderProps {
  // ... existing props
  features: { voiceDictation: boolean; markdownExport: boolean }
}

export function DocumentHeader({ features, ... }: DocumentHeaderProps) {
  return (
    <div className="document-header">
      {/* ... existing code */}

      {/* Only show if feature is enabled */}
      {features.voiceDictation && <VoiceDictationButton />}

      {/* ... rest of header */}
    </div>
  )
}
```

## Testing Plan

1. **Windows (should hide button):**
   - Build Windows version
   - Launch app
   - Open .md file
   - Verify: No dictate button in header

2. **macOS (should show button):**
   - Build macOS version
   - Launch app
   - Open .md file
   - Verify: Dictate button visible and functional

## Files to Modify

| File | Change |
|------|--------|
| `extensions/ritemark/webview/src/App.tsx` | Add features state, pass to DocumentHeader |
| `extensions/ritemark/webview/src/components/header/DocumentHeader.tsx` | Accept features prop, conditionally render button |

## No Patch Required

This fix is entirely in the webview (React) code:
- No VS Code patches needed
- No extension TypeScript changes needed
- Just webview UI logic

## Estimated Complexity

**Simple** - This is the easiest of the 4 issues:
- Feature flag system already works
- Just need to use the data that's already being sent
- Pure React prop passing
- 10-15 lines of code total
