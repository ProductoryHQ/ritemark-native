# Architecture Analysis - Bug Reporting Feature

**Sprint:** 25
**Date:** 2026-01-27
**Phase:** 1 (Research)

## Current Sidebar Architecture

### Menu Structure
From `package.json` analysis:
- Sidebar views are defined in `contributes.views`
- Menu items appear in `contributes.menus.view/title`
- Current AI sidebar has two menu buttons:
  - "New Chat" (`ritemark.newChat`)
  - "AI Settings" (`ritemark.aiSettings`)

### Command Registration Pattern
```json
{
  "command": "ritemark.commandName",
  "title": "Display Title",
  "icon": "$(codicon-name)"
}
```

### Example from Existing Code
Explorer view has a search button:
```json
{
  "command": "ritemark.openSearch",
  "when": "view == workbench.explorer.fileView",
  "group": "navigation@1"
}
```

AI view has navigation buttons:
```json
{
  "command": "ritemark.newChat",
  "when": "view == ritemark.unifiedView",
  "group": "navigation@1"
}
```

## Bug Reporting Location Options

### Option 1: AI Sidebar Menu (Recommended)
**Location:** `view/title` menu in `ritemark.unifiedView`
**Pros:**
- Already has menu items (New Chat, AI Settings)
- Contextually related (support/help section)
- Consistent with current design

**Cons:**
- Only visible when AI panel is open

### Option 2: Global Command Palette
**Location:** Command palette only (no UI button)
**Pros:**
- Always accessible (Cmd+Shift+P)
- Doesn't clutter UI

**Cons:**
- Less discoverable for non-technical users
- Doesn't meet "customer perspective" requirement

### Option 3: Help Menu
**Location:** VS Code top menu bar > Help
**Pros:**
- Standard location for "Report Issue"
- Always visible

**Cons:**
- Requires VS Code patch (adds complexity)
- Less modern UX

### Recommendation
**Hybrid Approach:**
1. **Primary:** AI Sidebar menu item (visible, accessible)
2. **Secondary:** Command palette entry (for power users)
3. **Future:** Help menu patch if user feedback demands it

## URL Opening Mechanism

### Existing Pattern
From codebase analysis, we already use `vscode.env.openExternal()`:

**File:** `src/ritemarkEditor.ts:432`
```typescript
vscode.env.openExternal(vscode.Uri.parse(fullUrl));
```

**File:** `src/update/updateNotification.ts:43`
```typescript
await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
```

This is the standard VS Code API for opening URLs in the default browser.

## GitHub Issues Integration Options

### Option A: Pre-filled GitHub Issue URL (Recommended)
**Method:** Generate URL with query parameters
**Example:**
```
https://github.com/jarmo-productory/ritemark-public/issues/new?
  title=[Bug]%20...
  &body=...
  &labels=bug,user-reported
```

**Pros:**
- No authentication required
- User sees exactly what will be submitted
- User can edit before submitting
- Works offline (opens in browser when online)
- Simple implementation

**Cons:**
- User needs GitHub account to submit
- Opens external browser

### Option B: GitHub REST API (More Complex)
**Method:** Direct API calls to create issues
**Requires:**
- GitHub Personal Access Token
- OAuth flow for users
- Token storage in VS Code SecretStorage

**Pros:**
- Seamless in-app experience
- No browser navigation

**Cons:**
- Requires user authentication
- Token management complexity
- Privacy concerns (storing GitHub tokens)
- More code to maintain

### Option C: Email Fallback
**Method:** `mailto:` link as fallback
**Example:**
```
mailto:support@ritemark.io?subject=Bug%20Report&body=...
```

**Pros:**
- Works for users without GitHub
- No external dependencies

**Cons:**
- Manual triage required
- Not integrated with issue tracker
- Less structured data

### Recommendation
**Primary:** Pre-filled GitHub Issue URL (Option A)
**Fallback:** Consider email for users who can't/won't use GitHub

## Auto-Collected Information

### Essential Data
1. **App Version** - `vscode.version` or from package.json
2. **OS Version** - `process.platform`, `process.arch`, `os.release()`
3. **Extension Version** - from extension's package.json
4. **VS Code Version** - underlying VS Code OSS version

### Optional Data (with user consent)
5. **Active File Type** - .md, .csv, .xlsx, etc.
6. **Open Document Count** - number of files open
7. **Last Error** - if there was a recent error
8. **Feature Flags** - which experimental features are enabled

### Privacy Considerations
- **Never collect:** File names, file content, paths, API keys
- **User control:** Show exactly what will be submitted
- **Opt-out:** Allow users to edit/remove any info

## User Experience Flow

### Happy Path
1. User clicks "Report Bug" in AI sidebar
2. Dialog appears: "Tell us what happened"
   - Text area for description (required)
   - "What were you doing?" field (optional)
   - Checkbox: "Include system info" (checked by default)
3. User writes bug description
4. Click "Submit" → Opens GitHub in browser with pre-filled issue
5. User reviews, adds screenshots, submits

### Edge Cases
- **No internet:** Show message "You'll need internet to submit bugs"
- **No GitHub account:** Show message with sign-up link
- **Empty description:** Disable submit button until text is entered

## Implementation Complexity

### Minimal Viable Implementation
- **Time:** 2-3 hours
- **Files to modify:**
  1. `package.json` - Add command + menu item
  2. `extension.ts` - Register command handler
  3. New file: `commands/reportBug.ts` - Logic

### Enhanced Implementation (with dialog)
- **Time:** 4-6 hours
- **Additional:**
  1. Modal dialog for collecting input
  2. System info collection function
  3. URL encoding utility
  4. User preference storage (if they opt out of system info)

## Technical Risks

### Low Risk
- Command registration (well-understood pattern)
- URL opening (already used in codebase)
- System info collection (standard Node.js APIs)

### Medium Risk
- Dialog UI (if using webview) - adds complexity
- URL length limits (GitHub URL has max length)
  - **Mitigation:** Truncate long descriptions, warn user

### No Risk
- No external dependencies needed
- No new build process changes
- No VS Code patches required

## References

### VS Code APIs Used
- `vscode.commands.registerCommand()` - Command registration
- `vscode.env.openExternal()` - Open URLs
- `vscode.window.showInputBox()` - Simple input (fallback)
- `vscode.window.showQuickPick()` - Option selection
- `process.platform`, `process.arch` - System info
- `os.release()` - OS version

### GitHub Issue URL Format
Documentation: https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-an-issue#creating-an-issue-from-a-url-query

### Existing Patterns
- Update notification: `src/update/updateNotification.ts`
- Link opening: `src/ritemarkEditor.ts:432`
- Command registration: `src/commands/configureApiKey.ts`
