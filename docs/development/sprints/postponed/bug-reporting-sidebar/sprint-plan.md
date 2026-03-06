# Sprint 25: Bug Reporting Sidebar

## Goal
Add an easy-to-use bug reporting feature that allows customers to submit GitHub issues directly from Ritemark's AI sidebar with auto-collected system information.

## Feature Flag Check
- [ ] Does this sprint need a feature flag?
  - Platform-specific? **No** (works on all platforms)
  - Experimental? **No** (standard feature)
  - Large download? **No** (no external dependencies)
  - Premium? **No** (core support feature)
  - Kill-switch? **Maybe** (could be useful if abused)

  **Decision: NO feature flag for initial launch**
  - This is a core support feature that benefits all users
  - Low risk (just opens a URL)
  - Can add kill-switch in future if needed (via GitHub repo URL change)

## Success Criteria
- [ ] "Report Bug" button visible and discoverable in AI sidebar menu
- [ ] Clicking button opens a friendly dialog with clear instructions
- [ ] Dialog collects user's bug description (required)
- [ ] System information is automatically collected and displayed
- [ ] User can review exactly what will be submitted
- [ ] Clicking "Submit" opens GitHub with pre-filled issue
- [ ] Issue includes user description + system info in proper format
- [ ] Labels are automatically applied (bug, user-reported)
- [ ] Works on macOS (primary platform), Windows, and Linux
- [ ] Privacy-focused: no file paths, content, or personal data collected

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| Command registration | `ritemark.reportBug` command in package.json |
| Menu item | Bug icon in AI sidebar view/title menu |
| Webview dialog | Custom dialog for collecting bug description |
| System info collector | Function to gather app version, OS, architecture |
| URL generator | Function to build pre-filled GitHub issue URL |
| Privacy notice | Clear statement in dialog about data collection |
| Documentation | Update relevant docs with bug reporting info |
| GitHub labels | Create `user-reported` label in repository |

## Implementation Checklist

### Phase 1: Command & Menu Setup
- [ ] Add `ritemark.reportBug` command to `package.json`
- [ ] Add menu item to AI sidebar (`contributes.menus.view/title`)
- [ ] Use `$(bug)` icon for clear intent
- [ ] Add command to activationEvents
- [ ] Register command handler in `extension.ts`

### Phase 2: System Info Collection
- [ ] Create `src/utils/systemInfo.ts` with collection function
- [ ] Collect Ritemark version from extension package.json
- [ ] Collect VS Code OSS version from `vscode.version`
- [ ] Collect OS name and version via `process.platform` and `os.release()`
- [ ] Collect architecture via `process.arch`
- [ ] Collect active file type (if editor is open)
- [ ] Format into readable structure
- [ ] Add tests for edge cases (missing data, etc.)

### Phase 3: Webview Dialog
- [ ] Create `src/views/BugReportDialog.ts`
- [ ] Implement WebviewPanel for modal dialog
- [ ] Design HTML/CSS following VS Code theme variables
- [ ] Add multi-line textarea for description (required)
- [ ] Add collapsible system info preview section
- [ ] Add checkbox to include/exclude system info (default: checked)
- [ ] Add privacy notice with lock icon
- [ ] Add character counter (max 2000 chars)
- [ ] Enable submit button only when description ≥10 chars
- [ ] Handle Cancel button (close dialog)
- [ ] Handle Submit button (generate URL and open)
- [ ] Support keyboard shortcuts (Escape = cancel, Cmd+Enter = submit)
- [ ] Auto-focus description field on open

### Phase 4: GitHub Integration
- [ ] Create `src/utils/githubIssue.ts` with URL generator
- [ ] Define repository URL constant
- [ ] Build issue title: `[Bug] {first 80 chars of description}`
- [ ] Build issue body with template:
  - Bug Description (user input)
  - System Information (auto-collected)
  - Footer note about in-app submission
- [ ] URL encode all parameters properly
- [ ] Handle special characters (quotes, newlines, emoji)
- [ ] Add labels: `bug,user-reported`
- [ ] Truncate if URL exceeds 8000 characters
- [ ] Test with long descriptions and special characters
- [ ] Use `vscode.env.openExternal()` to open URL

### Phase 5: Error Handling & Edge Cases
- [ ] Disable submit if description is empty
- [ ] Show validation message if description < 10 chars
- [ ] Handle very long descriptions (truncate with warning)
- [ ] Handle special characters in description
- [ ] Handle offline scenario (show friendly message that internet is required, no offline queue)
- [ ] Handle user cancellation gracefully
- [ ] Handle webview disposal properly
- [ ] Add try-catch around system info collection
- [ ] Graceful fallback if any system info is unavailable

### Phase 6: Documentation & Polish
- [ ] Update `CHANGELOG.md` with new feature
- [ ] Add entry to `docs/sprints/ROADMAP.md`
- [ ] Update `docs/sprints/WISHLIST.md` (move from future to completed)
- [ ] Test on macOS arm64 (primary platform)
- [ ] Test with various bug descriptions (short, long, special chars)
- [ ] Verify GitHub issue opens correctly
- [ ] Verify labels are applied
- [ ] Create `user-reported` label in GitHub repo (if doesn't exist)
- [ ] Test keyboard navigation (Tab, Escape, Cmd+Enter)
- [ ] Test with VS Code theme (light mode)

### Phase 7: GitHub Repository Setup
- [ ] Verify `bug` label exists in `jarmo-productory/ritemark-public` repo
- [ ] Create `user-reported` label:
  - Color: `#0075ca` (blue)
  - Description: "Reported via in-app bug reporter"
- [ ] Optional: Create `needs-triage` label if desired
- [ ] Test actual issue submission to verify labels work

## Technical Approach

### Files to Create
1. `src/commands/reportBug.ts` - Main command handler
2. `src/views/BugReportDialog.ts` - Webview dialog implementation
3. `src/utils/systemInfo.ts` - System information collector
4. `src/utils/githubIssue.ts` - GitHub URL generator

### Files to Modify
1. `package.json` - Add command, menu, activation event
2. `src/extension.ts` - Register command
3. `CHANGELOG.md` - Document new feature

### Key Dependencies
- No new npm packages required
- Uses existing VS Code APIs:
  - `vscode.window.createWebviewPanel()` - Dialog
  - `vscode.env.openExternal()` - Open URL
  - Node.js built-ins: `os`, `process`

### Dialog Implementation Pattern
Follow existing webview patterns:
- Similar structure to `UnifiedViewProvider`
- Use CSP-safe inline HTML
- Message passing between extension and webview
- Theme-aware CSS using VS Code variables

### URL Format Example
```
https://github.com/jarmo-productory/ritemark-public/issues/new?
  title=[Bug]%20Editor%20crashed%20when%20pasting
  &body=<ENCODED_BODY>
  &labels=bug,user-reported
```

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| URL too long | Medium | Low | Truncate description, warn user |
| User has no GitHub account | High | Low | Show message explaining GitHub is needed |
| GitHub API changes | Low | Medium | Monitor GitHub docs, adapt if needed |
| Privacy concerns | Low | High | Clear disclosure, minimal data collection |
| Webview complexity | Low | Medium | Follow existing patterns, test thoroughly |
| Abuse (spam issues) | Low | Medium | Can change URL or add rate limiting later |

## Testing Plan

### Manual Testing
1. **Happy Path**
   - Click "Report Bug" in AI sidebar
   - Enter description
   - Verify system info is correct
   - Click Submit
   - Verify GitHub opens with correct info
   - Verify issue can be submitted on GitHub

2. **Edge Cases**
   - Empty description (button should be disabled)
   - Very short description (<10 chars)
   - Very long description (>2000 chars)
   - Special characters: quotes, newlines, emoji, brackets
   - Markdown in description (code blocks, lists)
   - Unchecking "Include system info"
   - Pressing Cancel
   - Pressing Escape
   - Pressing Cmd+Enter to submit

3. **Error Scenarios**
   - Offline mode (browser should handle)
   - Active editor closed (system info should still work)
   - No workspace open (should still work)

### Automated Testing
- Unit tests for `systemInfo.ts`
- Unit tests for `githubIssue.ts` URL generation
- Test URL encoding with various inputs

## Timeline Estimate

| Phase | Estimated Time |
|-------|----------------|
| Command & Menu Setup | 30 min |
| System Info Collection | 1 hour |
| Webview Dialog | 3 hours |
| GitHub Integration | 1.5 hours |
| Error Handling | 1 hour |
| Documentation & Polish | 1 hour |
| GitHub Repo Setup | 15 min |
| Testing | 1 hour |
| **Total** | **~9 hours** |

## Future Enhancements (Post-Sprint)

### Knowledge Base Integration (Future)
- Link bug reporter to a knowledge base / FAQ system
- Before submitting, search knowledge base for known solutions
- Suggest relevant help articles based on user's description
- Reduce duplicate issues by showing existing answers

### Phase 2 (Future Sprint)
- Screenshot attachment capability
- Steps to reproduce field (optional)
- Expected behavior field (optional)
- Severity/priority selection
- Feature request option (not just bugs)

### Phase 3 (Future Sprint)
- In-app issue tracking (see your submitted bugs)
- Check for duplicate issues before submitting
- Attach error logs automatically
- Email fallback for users without GitHub

## Status
**Current Phase:** 2 (PLAN)
**Approval Required:** Yes - waiting for Jarmo's approval

## Approval
- [ ] Jarmo approved this sprint plan

---

## Research Documents
- `research/01-architecture-analysis.md` - Sidebar and command patterns
- `research/02-github-issues-integration.md` - GitHub API and URL parameters
- `research/03-ux-design.md` - User experience and dialog design
