# UX Design - Bug Reporting Feature

**Sprint:** 25
**Date:** 2026-01-27
**Phase:** 1 (Research)

## User Personas

### Primary: Non-Technical Writer
**Profile:**
- Uses Ritemark for writing documents
- Not a developer, may not have GitHub account
- Wants to report bugs but intimidated by technical processes
- Prefers simple, guided experiences

**Needs:**
- Clear, simple language ("Report a problem" not "Submit issue")
- Guided prompts ("What happened?" not "Description:")
- Explanation of what will happen next
- Reassurance that their feedback matters

### Secondary: Technical User
**Profile:**
- Developer or power user
- Has GitHub account, familiar with issue tracking
- Wants quick access without friction
- May want to add technical details

**Needs:**
- Fast access (keyboard shortcut or command palette)
- Ability to add detailed technical info
- Preview of what will be submitted
- Option to include logs or screenshots (on GitHub)

## Design Principles

### 1. Minimize Friction
- **One-click access** from visible UI location
- **Short form** - don't overwhelm with fields
- **Smart defaults** - pre-fill what we can
- **Progressive disclosure** - optional fields are hidden initially

### 2. Build Trust
- **Show exactly what will be submitted** - no surprises
- **Explain the process** - "This will open GitHub in your browser"
- **Privacy first** - clearly state what we don't collect
- **Give control** - user can edit everything

### 3. Guide Non-Technical Users
- **Friendly language** - avoid jargon
- **Helpful prompts** - "Describe what went wrong" not "Issue description"
- **Examples** - show sample text in placeholders
- **Validation** - prevent submission of empty reports

## UI Options

### Option 1: VS Code Input Box (Simplest)
**Method:** `vscode.window.showInputBox()`
**Appearance:** Single-line text input at top of window

**Pros:**
- Zero implementation effort (built-in API)
- Consistent with VS Code UX
- Keyboard-friendly

**Cons:**
- Single line only (no multi-line description)
- Can't show system info preview
- Can't show privacy explanation
- Too minimal for quality bug reports

**Verdict:** ❌ Too limited for our needs

### Option 2: Quick Pick with Input (Minimal)
**Method:** `vscode.window.showQuickPick()` + `showInputBox()`
**Flow:**
1. Quick pick: "What type of issue?"
   - Bug (something's broken)
   - Feature Request
   - Question
2. Input box: "Describe the issue"
3. Opens GitHub with info

**Pros:**
- Still uses native VS Code UI
- Can categorize issues
- Slightly better UX than single input

**Cons:**
- Still single-line input
- No preview of submission
- No privacy explanation

**Verdict:** 🤔 Better but still limited

### Option 3: Custom Webview Dialog (Recommended)
**Method:** Create a modal webview panel
**Appearance:** Custom HTML form with multiple fields

**Pros:**
- Multi-line text areas
- Can show system info preview
- Can show privacy explanation
- Full control over UX
- Can add helpful tips/examples
- Better for non-technical users

**Cons:**
- More implementation work (~2-3 hours)
- Requires HTML/CSS
- Need to handle webview lifecycle

**Verdict:** ✅ Best user experience

### Option 4: External Web Form
**Method:** Open browser to pre-built form, POST to GitHub API
**Appearance:** Web page outside Ritemark

**Pros:**
- Can use advanced form features
- No webview complexity

**Cons:**
- Takes user out of app
- Requires backend server
- Privacy concerns (data leaves user's machine)
- Much more complex

**Verdict:** ❌ Overkill, violates "local-first" principle

## Recommended Design: Custom Webview Dialog

### Visual Layout

```
┌─────────────────────────────────────────────┐
│  Report a Bug                          [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  Help us fix it! Describe what went wrong: │
│  ┌─────────────────────────────────────┐   │
│  │ The editor froze when I...          │   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│  Example: "The app crashed when..."        │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ ▼ System Information (included)       │ │
│  │   • Ritemark 1.0.3                   │ │
│  │   • macOS 14.2.1 (arm64)             │ │
│  │   • VS Code OSS 1.94.0               │ │
│  └───────────────────────────────────────┘ │
│  ☑ Include system information              │
│                                             │
│  🔒 We never collect file names, content,  │
│     or personal data.                      │
│                                             │
│        [Cancel]  [Submit Bug Report]       │
└─────────────────────────────────────────────┘
```

### Field Specifications

#### 1. Description Field
- **Label:** "Help us fix it! Describe what went wrong:"
- **Type:** Multi-line textarea
- **Required:** Yes
- **Placeholder:** "Example: The app crashed when I pasted a large table from Excel"
- **Max length:** 2000 characters (with counter)
- **Validation:** Must have at least 10 characters

#### 2. System Info Section
- **Display:** Collapsible section (expanded by default)
- **Content:**
  - Ritemark version
  - OS + version
  - Architecture
  - VS Code OSS version
- **Checkbox:** "Include system information" (checked by default)
- **Behavior:** If unchecked, only user description is sent

#### 3. Privacy Notice
- **Icon:** 🔒 (lock emoji or icon)
- **Text:** "We never collect file names, content, or personal data."
- **Style:** Small, gray text
- **Link:** "Privacy Policy" → opens privacy doc

#### 4. Buttons
- **Cancel:** Secondary button (left side)
  - Closes dialog without action
  - Keyboard: Escape key
- **Submit Bug Report:** Primary button (right side)
  - Disabled until description meets minimum length
  - Keyboard: Cmd/Ctrl+Enter
  - Label shows intent clearly

### Interaction Flow

#### Happy Path
1. **User clicks "Report Bug" icon** in AI sidebar
2. **Webview dialog opens** in center of window
3. **User types description** in text area
4. **Submit button enables** after 10 characters
5. **User clicks "Submit Bug Report"**
6. **Dialog closes**
7. **Browser opens** with pre-filled GitHub issue
8. **User sees preview** on GitHub, can edit, then submits
9. **Success!** Issue is created

#### Alternative Paths

**Path A: User cancels**
1. User clicks "Cancel" or presses Escape
2. Dialog closes
3. No action taken
4. No error message (canceling is normal)

**Path B: User unchecks system info**
1. User unchecks "Include system information"
2. System info section collapses (optional)
3. Only description is sent to GitHub
4. Still works fine (just less context for debugging)

**Path C: User writes very long description**
1. Character counter shows "1950 / 2000"
2. At 2000, input stops accepting text
3. Warning appears: "Description is at maximum length"
4. User must shorten or continue on GitHub after opening

#### Error Scenarios

**Error A: Empty description**
- Submit button stays disabled
- No error message (implicit feedback)

**Error B: Too short description (<10 chars)**
- Submit button stays disabled
- Helper text: "Please add a few more details"

**Error C: Not logged into GitHub**
- Not our problem - GitHub handles auth
- User sees GitHub login page after clicking submit

**Error D: Offline**
- Should still open browser
- Browser shows "No internet connection"
- Or we could detect and show message beforehand

## Accessibility Considerations

### Keyboard Navigation
- **Tab order:** Description → Checkbox → Cancel → Submit
- **Shortcuts:**
  - Escape: Cancel
  - Cmd/Ctrl+Enter: Submit (if valid)
- **Focus management:** Auto-focus description field on open

### Screen Readers
- **Label associations:** All form fields have proper labels
- **ARIA attributes:**
  - `role="dialog"`
  - `aria-label="Report a Bug"`
  - `aria-describedby` for helper text
- **Status messages:** "Submit button enabled" when description is valid

### Visual
- **High contrast support:** Uses VS Code theme colors
- **Font size:** Respects VS Code font size settings
- **Color coding:** Don't rely solely on color for states

## Mobile/Responsive (Future)
- Not applicable (VS Code desktop only)
- But: dialog should work on small windows
- Minimum width: 400px
- Vertical layout on narrow windows

## Copy Considerations

### Button Labels
- ✅ "Submit Bug Report" (clear intent)
- ✅ "Report Bug" (menu item)
- ❌ "Submit Issue" (too technical)
- ❌ "Send Feedback" (ambiguous)

### Field Labels
- ✅ "Describe what went wrong" (friendly)
- ✅ "Help us fix it!" (encouraging)
- ❌ "Issue description" (technical)
- ❌ "Problem summary" (formal)

### Helper Text
- ✅ "Example: The app crashed when I pasted from Excel"
- ✅ "The more details, the better we can help!"
- ❌ "Provide reproduction steps" (technical jargon)

### Privacy Notice
- ✅ "We never collect file names, content, or personal data."
- ✅ "Your files stay private. Only app info is shared."
- ❌ "No PII is transmitted" (legal jargon)

## Icon Selection

### Menu Icon Options
From VS Code Codicons:
- `$(bug)` - Bug icon (most obvious)
- `$(report)` - Report icon (alternative)
- `$(feedback)` - Feedback icon (too generic)
- `$(comment)` - Comment (too generic)
- `$(issue-opened)` - GitHub issue icon (on-brand!)

**Recommendation:** `$(bug)` - universally understood, clear intent

### Icon Placement
In AI sidebar `view/title` menu:
```
[New Chat 💬] [AI Settings ⚙️] [Report Bug 🐛]
```

Position: Last (navigation@3)
Group: navigation

## Success Metrics

### Quantitative (Future)
- Number of bugs reported via in-app tool
- Conversion rate (opened dialog → submitted issue)
- Average time to submit report

### Qualitative
- User feedback: "Easy to report bugs"
- Issue quality: Are reports actionable?
- Reduction in "How do I report a bug?" questions

## Future Enhancements

### Phase 2 (Post-Launch)
- **Screenshots:** Auto-capture and attach to issue
- **Logs:** Option to include recent error logs
- **Steps to reproduce:** Dedicated field (optional)
- **Severity selection:** Critical, High, Medium, Low

### Phase 3 (Advanced)
- **In-app issue tracking:** See status of your reports
- **Notifications:** "Your bug was fixed!"
- **Voting:** Upvote existing issues instead of duplicates

## Competitor Analysis

### VS Code (Microsoft)
- **Location:** Help → Report Issue
- **Method:** Opens GitHub with pre-filled template
- **System Info:** Extensive (hardware, extensions, settings)
- **UX:** Very technical, designed for developers

**Takeaway:** We can be friendlier for non-technical users

### Notion
- **Location:** Help → Send Feedback
- **Method:** In-app modal form
- **System Info:** Collected automatically
- **UX:** Clean, simple, friendly copy

**Takeaway:** Good inspiration for our dialog design

### Obsidian
- **Location:** Help → Report Bug (opens forum)
- **Method:** Community forum post
- **System Info:** Manual (user must provide)
- **UX:** Simple but relies on community triage

**Takeaway:** Direct GitHub integration is better

### Linear
- **Location:** Cmd+K → "Report a bug"
- **Method:** In-app form, creates issue in Linear
- **System Info:** Auto-collected
- **UX:** Blazingly fast, minimal friction

**Takeaway:** Speed matters - minimize clicks

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **UI Method** | Custom webview dialog | Best UX, full control |
| **Location** | AI sidebar menu | Visible, contextual |
| **Icon** | `$(bug)` | Clear, universal |
| **Required Fields** | Description only | Minimize friction |
| **System Info** | Auto-collected, opt-out | Balance convenience & privacy |
| **Submission** | GitHub URL with params | Simple, no auth needed |
| **Privacy** | Explicit notice | Build trust |
| **Copy** | Friendly, non-technical | Accessible to all users |

## Next Steps (For Sprint Plan)

1. Create webview dialog HTML/CSS
2. Implement system info collection
3. Build URL generator with proper encoding
4. Register command + menu item
5. Handle dialog lifecycle (open/close)
6. Test with real GitHub repository
7. Create required labels in GitHub repo
