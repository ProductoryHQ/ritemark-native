# Welcome Screen Analysis

## Problem

Windows build shows VS Code's default Welcome page instead of Ritemark's custom walkthrough.

**Expected:** Ritemark walkthrough (Get Started with Ritemark)
**Actual:** VS Code generic welcome screen

## Ritemark Walkthrough (Already Exists)

**Location:** `extensions/ritemark/package.json` lines 126-164

```json
"walkthroughs": [
  {
    "id": "ritemark.welcome",
    "title": "Get Started with Ritemark",
    "description": "A beautiful markdown editor with AI assistance",
    "steps": [
      {
        "id": "welcome",
        "title": "Welcome to Ritemark",
        "description": "Write in markdown with a clean, distraction-free interface...",
        "media": { "svg": "media/logo.svg" },
        "completionEvents": ["onStepSelected"]
      },
      {
        "id": "configureApiKey",
        "title": "Configure AI API Key",
        "description": "Optional: Add your OpenAI API key...",
        "completionEvents": ["onCommand:ritemark.configureApiKey"]
      },
      {
        "id": "openMarkdown",
        "title": "Open a Markdown File",
        "description": "Open any `.md` file to start writing...",
        "completionEvents": ["onCommand:workbench.action.files.openFileFolder"]
      },
      {
        "id": "tryAI",
        "title": "Try AI Features",
        "description": "Select text and use the AI panel...",
        "completionEvents": ["onCommand:ritemark.showAIPanel"]
      }
    ]
  }
]
```

The walkthrough IS defined correctly. The issue is VS Code isn't showing it on startup.

## VS Code Welcome Page System

VS Code has TWO welcome mechanisms:

1. **Welcome Page** - The default startup page
   - Shows tips, recent files, tutorials
   - Generic VS Code content
   - Configured in VS Code core

2. **Extension Walkthroughs** - Custom onboarding
   - Defined by extensions (like we have)
   - Accessible via: Command Palette → "Welcome: Open Walkthrough"
   - Not shown by default on startup

## The Problem

Our walkthrough exists but isn't shown automatically. Users have to manually open it via Command Palette.

## Solution Options

### Option 1: Product.json Configuration (Preferred)

**File:** `branding/product.json`

Add configuration to show our walkthrough on first launch:

```json
{
  "nameShort": "Ritemark",
  // ... existing config ...
  "startupWalkthrough": {
    "extensionId": "ritemark",
    "walkthroughId": "ritemark.welcome"
  }
}
```

**Pros:** Clean, no patch needed
**Cons:** Might not be a real VS Code setting (need to verify)

### Option 2: Disable Default Welcome Page

**File:** `branding/product.json`

```json
{
  "nameShort": "Ritemark",
  // ... existing config ...
  "welcomePage": {
    "enabled": false
  }
}
```

Then add extension activation to show walkthrough on first launch.

### Option 3: Patch Welcome Page Module

Create patch to modify VS Code's welcome page logic:
- File: `vscode/src/vs/workbench/contrib/welcomeWalkthrough/browser/welcomePage.ts`
- Redirect to our walkthrough instead of generic welcome

**Pros:** Full control
**Cons:** Requires patch, more maintenance

### Option 4: Auto-show Walkthrough via Extension

**File:** `extensions/ritemark/src/extension.ts`

Add code to check if first launch and show walkthrough:

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // Check if first launch
  const hasSeenWelcome = context.globalState.get('ritemark.hasSeenWelcome', false)

  if (!hasSeenWelcome) {
    // Show walkthrough
    await vscode.commands.executeCommand('workbench.action.openWalkthrough', 'ritemark#ritemark.welcome')
    await context.globalState.update('ritemark.hasSeenWelcome', true)
  }

  // ... rest of activation
}
```

**Pros:** Simple, no patch needed
**Cons:** Shows walkthrough after Welcome page (not instead of)

## Recommended Approach

**Start with Option 4** (extension-based):
1. Easiest to implement
2. No patches or product.json experiments
3. Works reliably
4. Can be enhanced later

**Then optionally add Option 2** (disable default Welcome):
1. Set `workbench.tips.enabled: false` in product.json (already in package.json)
2. This suppresses some welcome UI

## Testing

1. Build Windows app
2. Delete user data folder: `%APPDATA%\.ritemark`
3. Launch app
4. Verify: Ritemark walkthrough shows automatically

## Complexity

**Medium** - Requires:
- Understanding VS Code welcome system
- Testing first-launch behavior
- May need to experiment with different approaches
- Clean way to detect first launch
