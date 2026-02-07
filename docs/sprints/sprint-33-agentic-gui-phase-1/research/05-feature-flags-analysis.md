# Feature Flags Analysis

**Sprint 33: Agentic GUI - Phase 1**
**Date:** 2026-02-07

## Question: Does This Sprint Need Feature Flags?

Let's evaluate against the feature flag criteria from `.claude/skills/feature-flags/SKILL.md`.

### Evaluation Checklist

| Criterion | Applies? | Reasoning |
|-----------|----------|-----------|
| Platform-specific | ❌ No | Works on darwin, win32, linux (Claude SDK is cross-platform) |
| Experimental/unstable | ✅ **YES** | Agent autonomy is new, potentially risky |
| Requires large download | ❌ No | Claude SDK already bundled for Flows |
| Premium/paid feature | ❌ No | Uses user's own API key (no premium tier yet) |
| Needs kill-switch | ✅ **YES** | File modification risks require emergency disable |
| Large UI change | ✅ **YES** | New mode selector, activity feed, major UX shift |

**Decision: YES, use feature flags.**

## Recommended Flags

### Flag 1: Agent Mode (Experimental)

```typescript
// In flags.ts
'agentic-assistant': {
  id: 'agentic-assistant',
  name: 'Agentic AI Assistant',
  description: 'Enable autonomous agent mode with file modifications',
  status: 'experimental',  // Requires opt-in
  platforms: ['darwin', 'win32', 'linux'],
}
```

**Why experimental:**
- First release of agent autonomy
- File modification risks
- Need user testing before making default
- Easier to roll back if issues found

**User opt-in:**
- Setting: `ritemark.experimental.agenticAssistant`
- Default: `false`
- Users must enable in Settings UI

### Flag 2: Individual Agent Modes (Sub-flags)

Option to gate specific modes separately:

```typescript
'agent-assist-mode': {
  id: 'agent-assist-mode',
  name: 'Agent Assist Mode',
  description: 'Agent suggests actions, user approves',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
  requires: ['agentic-assistant']  // Parent flag must be enabled
}

'agent-auto-mode': {
  id: 'agent-auto-mode',
  name: 'Agent Auto Mode',
  description: 'Agent executes autonomously with monitoring',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
  requires: ['agentic-assistant']
}
```

**Reasoning:**
- Allows gradual rollout (Assist first, Auto later)
- Users can enable lower-risk mode (Assist) without full autonomy
- More granular control if one mode has issues

**Trade-off:**
- More complexity in settings
- Might confuse users ("why are there 3 settings?")

**Recommendation: Start with single flag (`agentic-assistant`), add sub-flags only if needed.**

## Flag Lifecycle Plan

### Phase 1: Experimental (Sprint 33-35)

- Status: `experimental`
- Default: OFF
- Users must opt-in via Settings
- Limited audience (power users, early testers)
- Gather feedback, fix bugs

### Phase 2: Beta (Sprint 36-38)

- Status: Still `experimental` but promoted
- Default: Still OFF
- Add in-app prompt to try the feature
- Wider testing audience
- Polish UX based on feedback

### Phase 3: Stable (Sprint 39+)

- Status: `stable`
- Default: ON for new users
- Existing users keep their setting
- Feature is mature, battle-tested

### Phase 4: Removal (Future)

- Remove flag entirely
- Feature is permanent, always enabled
- Clean up flag-checking code

## Implementation in Code

### Extension Activation

```typescript
// src/extension.ts
import { isEnabled } from './features';

export function activate(context: vscode.ExtensionContext) {
  // ... existing activation

  if (isEnabled('agentic-assistant')) {
    // Initialize AgentRunner
    const agentRunner = new AgentRunner();
    context.subscriptions.push(agentRunner);

    // Pass to UnifiedViewProvider
    unifiedViewProvider.setAgentRunner(agentRunner);
  }
}
```

### Webview UI

```typescript
// webview/src/App.tsx
import { useFeatures } from './hooks/useFeatures';

function UnifiedAIView() {
  const features = useFeatures();

  return (
    <div>
      <div className="mode-selector">
        <button>Chat</button>
        {features['agentic-assistant'] && (
          <>
            <button>Assist</button>
            <button>Auto</button>
          </>
        )}
      </div>
      {/* ... rest of UI */}
    </div>
  );
}
```

### Message Handling

```typescript
// src/views/UnifiedViewProvider.ts
case 'ai-execute-agent':
  if (!isEnabled('agentic-assistant')) {
    this._view?.webview.postMessage({
      type: 'agent-error',
      error: 'Agentic mode is disabled. Enable in Settings > Experimental Features.'
    });
    return;
  }
  await this._handleAgentExecution(message);
  break;
```

## Settings UI Integration

Add to `package.json`:

```json
{
  "contributes": {
    "configuration": {
      "title": "Ritemark",
      "properties": {
        "ritemark.experimental.agenticAssistant": {
          "type": "boolean",
          "default": false,
          "markdownDescription": "Enable agentic AI assistant with file modification capabilities. **Experimental:** Use with caution. [Learn more](https://docs.ritemark.com/features/agent)",
          "order": 100
        }
      }
    }
  }
}
```

## User Communication

### Settings Description

> **Agentic AI Assistant** (Experimental)
> Allow the AI to autonomously read, edit, and organize files in your workspace.
> You control which folders the agent can access. All changes can be undone.
> Requires Anthropic API key.

### First-Time Prompt

When user tries to switch to Assist/Auto mode:

```
┌─────────────────────────────────────────┐
│ Enable Agentic Assistant?               │
├─────────────────────────────────────────┤
│ This experimental feature allows AI to  │
│ modify files in your workspace.         │
│                                         │
│ You'll be able to:                      │
│ • Choose which folders are accessible   │
│ • Approve each action (Assist mode)     │
│ • Undo any changes                      │
│                                         │
│ [Enable in Settings] [Learn More] [×]   │
└─────────────────────────────────────────┘
```

## Kill-Switch Strategy

If critical bug found in production:

1. **Update flag remotely** (future: remote config)
   - For now: Hotfix release that changes default to `false`

2. **Notify users** via in-app banner
   ```
   "Agentic mode temporarily disabled due to a bug.
    Update will be available soon. Sorry for the inconvenience!"
   ```

3. **Rollback plan**
   - Flag makes rollback easy: just disable, no code changes needed
   - Users can continue using Chat mode unaffected

## Testing Strategy

- Test with flag ON: Full agent functionality
- Test with flag OFF: Mode selector hidden, agent commands blocked
- Test flag toggle: Enable/disable without restart (if possible)
- Test on all platforms (darwin, win32, linux)

## Deliverable

As part of Phase 2 (PLAN), include this in sprint-plan.md:

```markdown
## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - ✅ Experimental feature (agent autonomy)
  - ✅ Large UI change (mode selector, activity feed)
  - ✅ Needs kill-switch (file modification risks)

**Flag Definition:**
- ID: `agentic-assistant`
- Status: `experimental` (opt-in, default OFF)
- Platforms: darwin, win32, linux
- Setting: `ritemark.experimental.agenticAssistant`

**Lifecycle:**
- Sprint 33-35: Experimental (opt-in only)
- Sprint 36+: Promote to stable (default ON)
- Future: Remove flag (permanent feature)
```
