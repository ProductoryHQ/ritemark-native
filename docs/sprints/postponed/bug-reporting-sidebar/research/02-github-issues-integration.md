# GitHub Issues Integration Research

**Sprint:** 25
**Date:** 2026-01-27
**Phase:** 1 (Research)

## GitHub Issue URL Query Parameters

### Supported Parameters
GitHub allows pre-filling issue forms via URL query parameters:

```
https://github.com/OWNER/REPO/issues/new?
  title=ISSUE_TITLE
  &body=ISSUE_BODY
  &labels=LABEL1,LABEL2
  &assignees=USER1,USER2
  &milestone=MILESTONE_NUMBER
  &projects=PROJECT_ID
  &template=TEMPLATE_NAME
```

### Parameters We'll Use

#### 1. Title (Required)
- Format: `[Bug] Short description from user`
- Max length: ~256 characters (GitHub limit)
- Example: `[Bug] Editor crashes when pasting large tables`

#### 2. Body (Required)
- Markdown-formatted issue description
- Include user's description + system info
- Template structure (see below)

#### 3. Labels (Optional but Recommended)
- `bug` - Automatically categorize as bug
- `user-reported` - Distinguish from internal issues
- `needs-triage` - Signal that it needs review

**Note:** Labels must exist in the repo before use. We need to create these labels in the ritemark-public GitHub repository.

### URL Encoding Requirements

- Spaces → `%20` or `+`
- Newlines → `%0A`
- Special characters must be percent-encoded
- Use `encodeURIComponent()` for each parameter value

### URL Length Limits

**Browser URL limits:**
- Chrome: ~2MB (very high)
- Safari: 80,000 characters
- Firefox: 65,536 characters

**Practical limit:** ~8,000 characters to be safe across all browsers

**Mitigation for long descriptions:**
- Truncate user description if needed
- Warn user if description is too long
- Suggest pasting additional details after opening GitHub

## Issue Body Template

### Proposed Template Structure

```markdown
## Bug Description
{USER_DESCRIPTION}

## Steps to Reproduce
{USER_STEPS}

## Expected Behavior
{USER_EXPECTED}

## System Information
- **Ritemark Version:** {APP_VERSION}
- **VS Code OSS Version:** {VSCODE_VERSION}
- **Operating System:** {OS_NAME} {OS_VERSION}
- **Architecture:** {ARCH}

## Additional Context
- **Active File Type:** {FILE_TYPE}
- **Feature Flags Enabled:** {FLAGS}

---
*This issue was submitted via Ritemark's built-in bug reporter.*
```

### Dynamic Fields

**Always Include:**
- Ritemark version (e.g., "1.0.3")
- VS Code OSS version (e.g., "1.94.0")
- OS (e.g., "macOS 14.2.1", "Windows 11", "Ubuntu 22.04")
- Architecture (e.g., "arm64", "x64")

**Include if Available:**
- Active file type (.md, .csv, .xlsx, none)
- Experimental features enabled (if any)

**User-Provided:**
- Bug description (required)
- Steps to reproduce (optional but encouraged)
- Expected behavior (optional)

## Code Example: URL Generation

```typescript
function generateBugReportUrl(userInput: {
  description: string;
  steps?: string;
  expected?: string;
}): string {
  const repoUrl = 'https://github.com/jarmo-productory/ritemark-public';

  // Collect system info
  const systemInfo = {
    ritemarkVersion: vscode.extensions.getExtension('ritemark')?.packageJSON.version || 'unknown',
    vscodeVersion: vscode.version,
    os: `${process.platform} ${os.release()}`,
    arch: process.arch,
  };

  // Build issue title
  const title = `[Bug] ${userInput.description.substring(0, 80)}`;

  // Build issue body
  let body = '## Bug Description\n';
  body += userInput.description + '\n\n';

  if (userInput.steps) {
    body += '## Steps to Reproduce\n';
    body += userInput.steps + '\n\n';
  }

  if (userInput.expected) {
    body += '## Expected Behavior\n';
    body += userInput.expected + '\n\n';
  }

  body += '## System Information\n';
  body += `- **Ritemark Version:** ${systemInfo.ritemarkVersion}\n`;
  body += `- **VS Code OSS Version:** ${systemInfo.vscodeVersion}\n`;
  body += `- **Operating System:** ${systemInfo.os}\n`;
  body += `- **Architecture:** ${systemInfo.arch}\n\n`;
  body += '---\n';
  body += '*This issue was submitted via Ritemark\\'s built-in bug reporter.*';

  // Encode parameters
  const params = new URLSearchParams({
    title: title,
    body: body,
    labels: 'bug,user-reported',
  });

  return `${repoUrl}/issues/new?${params.toString()}`;
}
```

## GitHub Labels Setup

### Required Labels in Repository

Before deploying this feature, we need to create these labels in the ritemark-public GitHub repo:

1. **bug**
   - Color: `#d73a4a` (red)
   - Description: "Something isn't working"
   - *May already exist (default GitHub label)*

2. **user-reported**
   - Color: `#0075ca` (blue)
   - Description: "Reported via in-app bug reporter"
   - *Custom label - needs creation*

3. **needs-triage** (optional)
   - Color: `#fbca04` (yellow)
   - Description: "Requires review and categorization"
   - *May already exist*

### Label Management
- Labels can be created via GitHub UI: Settings → Labels
- Or via GitHub API (requires auth)
- Alternative: Use only `bug` label if others don't exist

## Privacy & Data Handling

### What We NEVER Collect
- ❌ File paths (e.g., `/Users/jarmo/Documents/secret.md`)
- ❌ File content (never read document text)
- ❌ API keys (never access SecretStorage)
- ❌ User's GitHub username/email
- ❌ Workspace folder names

### What We Collect (with Transparency)
- ✅ Ritemark version number (public info)
- ✅ OS version (standard for bug reports)
- ✅ Architecture (arm64/x64)
- ✅ File type extension only (`.md`, `.csv`, etc.)
- ✅ Feature flag status (boolean, no data)

### User Control
- Show preview of what will be submitted
- Allow editing before opening GitHub
- Option to exclude system info (manual checkbox)

## Error Handling

### Scenarios to Handle

1. **User cancels dialog**
   - Do nothing, no error message

2. **Empty description**
   - Disable submit button
   - Show inline validation: "Please describe the issue"

3. **URL too long (>8000 chars)**
   - Truncate description
   - Show warning: "Description was shortened to fit. You can add details on GitHub."

4. **GitHub is down**
   - No way to detect beforehand
   - User sees GitHub error page after clicking
   - Not our responsibility to handle

5. **User not logged into GitHub**
   - GitHub will prompt for login
   - Not our responsibility to handle

## Alternative: Issue Templates

### GitHub Issue Templates (Alternative Approach)
Instead of URL parameters, we could:
1. Create an issue template in `.github/ISSUE_TEMPLATE/bug_report.yml`
2. Link directly to template
3. User fills form on GitHub (not pre-filled)

**Pros:**
- Simpler implementation
- No URL length limits
- Better GitHub UI (form fields)

**Cons:**
- User has to manually enter system info
- Less convenient (more typing)
- Doesn't leverage app's knowledge of system

**Decision:** Use URL parameters for better UX. Issue templates can coexist for manual reporting.

## Internationalization Considerations

**Current:** Ritemark is English-only
**Future:** If we add localization:
- Issue title/body should remain in English (for maintainer)
- UI strings (dialog, buttons) can be translated
- System info labels stay in English

## Testing Strategy

### Manual Testing Checklist
- [ ] Click button opens GitHub in browser
- [ ] Title is properly formatted
- [ ] Body includes user description
- [ ] System info is accurate
- [ ] Labels are applied
- [ ] URL is properly encoded (no broken characters)
- [ ] Long descriptions are truncated gracefully
- [ ] Works on macOS (primary platform)
- [ ] Works on Windows (if we support it)
- [ ] Works on Linux (if we support it)

### Edge Cases to Test
- [ ] Empty description (should be blocked)
- [ ] Very long description (>5000 chars)
- [ ] Special characters in description (quotes, brackets, emoji)
- [ ] Description with markdown formatting
- [ ] Description with code blocks
- [ ] Offline mode (should show error)

## References

- **GitHub Docs:** https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-an-issue#creating-an-issue-from-a-url-query
- **URL Encoding:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
- **VS Code API:** https://code.visualstudio.com/api/references/vscode-api#env
