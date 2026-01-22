# Sprint 01: Feature Flag System

## Goal

Implement a minimal, type-safe feature flag system that supports platform filtering, user preferences for experimental features, and future extensibility for remote config and premium licensing - without changing how features are called.

## Success Criteria

- [ ] `isEnabled(flagId)` function works correctly for all status types
- [ ] Platform filtering prevents platform-specific features on wrong OS
- [ ] Experimental features appear as toggles in VS Code Settings UI
- [ ] Voice dictation is gated (experimental, darwin-only, default OFF)
- [ ] Markdown export is gated (stable, all platforms, default ON)
- [ ] All currently working features continue to work (no regressions)
- [ ] TypeScript compilation succeeds with no errors
- [ ] Dev mode runs successfully and features behave correctly
- [ ] Documentation updated (CLAUDE.md, sprint-manager agent)

## Deliverables

| Deliverable | Description | Location |
|-------------|-------------|----------|
| Feature flag module | Core flag system (flags.ts, featureGate.ts, index.ts) | `extensions/ritemark/src/features/` |
| Platform utility | getCurrentPlatform() helper | `extensions/ritemark/src/utils/platform.ts` |
| VS Code configuration | Settings UI for experimental features | `extensions/ritemark/package.json` |
| Integration changes | Wrap existing features with isEnabled() | `extension.ts`, `ritemarkEditor.ts` |
| CLAUDE.md update | Feature flag guidelines section | `CLAUDE.md` |
| Agent update | Add flag checklist to sprint-manager | `.claude/agents/sprint-manager.md` |
| Research docs | Architecture and feature analysis | `docs/sprints/sprint-01-feature-flags/research/` |

## Implementation Checklist

### Phase 1: Research (COMPLETED)
- [x] Analyze existing features and integration points
- [x] Document architecture decisions
- [x] Identify all files requiring changes
- [x] Define flag interface and evaluation logic

### Phase 2: Plan (CURRENT)
- [ ] Review sprint plan with Jarmo
- [ ] Get approval to proceed to Phase 3

### Phase 3: Core Implementation

#### 3.1: Platform Detection Utility
- [ ] Implement `getCurrentPlatform()` in `src/utils/platform.ts`
  - Return `'darwin' | 'win32' | 'linux'`
  - Handle unknown platforms (fallback to 'linux')
  - Add warning log for unknown platforms

#### 3.2: Feature Flag Definitions
- [ ] Create `src/features/flags.ts`
  - Define FeatureFlag interface
  - Create FLAGS constant object with const assertion
  - Export FlagId type
  - Define initial flags:
    - VOICE_DICTATION (experimental, darwin)
    - MARKDOWN_EXPORT (stable, all platforms)

#### 3.3: Runtime Gate Function
- [ ] Create `src/features/featureGate.ts`
  - Implement `isEnabled(flagId: FlagId): boolean`
  - Add flag lookup logic
  - Add platform filtering
  - Add status evaluation:
    - disabled → false
    - premium → false
    - stable → true
    - experimental → check VS Code setting
  - Add console warnings for unknown flags

#### 3.4: Public API
- [ ] Create `src/features/index.ts`
  - Export `isEnabled` function
  - Export `FLAGS` constant
  - Export `FlagId` type
  - Export `FeatureFlag` interface

#### 3.5: VS Code Configuration
- [ ] Update `package.json`
  - Add "RiteMark Features" configuration section
  - Add `ritemark.features.voice-dictation` boolean setting
  - Set description, default (false), scope (application)

### Phase 4: Integration

#### 4.1: Extension Activation (extension.ts)
- [ ] Import `isEnabled` from './features'
- [ ] Add conditional voice dictation initialization (if needed here)
- [ ] Test extension activates without errors

#### 4.2: Editor Integration (ritemarkEditor.ts)
- [ ] Import `isEnabled` from './features'
- [ ] Gate DictationController instantiation (line ~315)
  - Only create if `isEnabled('voice-dictation')`
- [ ] Gate export message handlers (lines ~358-369)
  - Check `isEnabled('markdown-export')` before export
  - Send error message if disabled
- [ ] Update webview load messages
  - Add `features` object with enabled feature flags
  - Webview can hide UI elements accordingly

#### 4.3: Webview Communication
- [ ] Update load message to include feature flags
  - `voiceDictation: isEnabled('voice-dictation')`
  - `markdownExport: isEnabled('markdown-export')`
- [ ] Document expected webview behavior (for future webview sprint)

### Phase 5: Documentation

#### 5.1: Project Guidelines (CLAUDE.md)
- [ ] Add "Feature Flag System" section after "Critical Invariants"
  - When to add a feature flag (decision tree)
  - How to check flags (`isEnabled(flagId)`)
  - Flag lifecycle (disabled → experimental → stable → remove/premium)
  - Best practices (gate at highest level, one flag per feature)

#### 5.2: Sprint Process (sprint-manager.md)
- [ ] Update Phase 2 checklist template
  - Add "Feature flag defined?" item
- [ ] Add decision tree to sprint planning
  - Needs flag if: experimental, platform-specific, big change, kill-switch, premium
  - No flag if: bug fix, refactoring, small UI tweak, infrastructure

### Phase 6: Validation & Testing

#### 6.1: TypeScript Compilation
- [ ] Run `npm run compile` in extensions/ritemark
- [ ] Fix any type errors
- [ ] Verify all imports resolve

#### 6.2: Dev Mode Testing
- [ ] Start dev mode (invoke vscode-expert)
- [ ] Open Settings and verify "Voice Dictation" toggle appears
- [ ] Test with toggle OFF:
  - Voice dictation UI hidden/disabled
  - Export buttons work (stable feature)
- [ ] Test with toggle ON:
  - Voice dictation UI available
- [ ] Test on wrong platform (if possible):
  - darwin-only features disabled on non-Mac

#### 6.3: Regression Testing
- [ ] Verify all existing features work:
  - Open markdown file → editor loads
  - Export to PDF → works
  - Export to Word → works
  - AI assistant → works
  - Excel viewer → works
- [ ] Check console for warnings/errors
- [ ] Verify settings persist across restarts

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing features | High | All current features default to enabled (stable status) |
| Settings don't persist | Medium | VS Code handles persistence automatically |
| Platform detection fails | Low | Fallback to 'linux' for unknown platforms |
| TypeScript errors | Medium | Use const assertions and strict types |
| Webview out of sync | Low | Send feature state on every load message |

## Out of Scope

These are explicitly NOT included in this sprint:

- Remote configuration (future sprint)
- Premium licensing logic (future sprint)
- Unit tests (can be added later)
- Analytics/telemetry for feature usage
- Feature flag admin UI
- A/B testing capabilities
- Migration scripts (not needed - smart defaults work)

## Technical Notes

### File Changes Summary
```
New files (3):
- extensions/ritemark/src/features/flags.ts (~60 lines)
- extensions/ritemark/src/features/featureGate.ts (~40 lines)
- extensions/ritemark/src/features/index.ts (~5 lines)

Modified files (4):
- extensions/ritemark/src/utils/platform.ts (~15 lines added)
- extensions/ritemark/package.json (~20 lines in configuration)
- extensions/ritemark/src/ritemarkEditor.ts (~10 lines for gates)
- CLAUDE.md (~40 lines new section)
- .claude/agents/sprint-manager.md (~20 lines updates)

Total new code: ~200 lines
Total changes: ~300 lines
```

### Dependencies
- No new npm packages
- Uses VS Code APIs:
  - `vscode.workspace.getConfiguration()`
  - `process.platform`

### Performance Impact
- Negligible: Fast boolean checks, no I/O
- Config reads are cached by VS Code

## Testing Checklist

### Manual Tests
- [ ] Settings UI shows experimental toggles
- [ ] Toggling experimental feature works immediately
- [ ] Platform filtering works (darwin-only feature disabled on Windows/Linux)
- [ ] Stable features always work
- [ ] Unknown flags return false (check console warning)
- [ ] Settings persist after app restart

### Integration Tests
- [ ] Extension activates without errors
- [ ] All message handlers work
- [ ] Gated features respect flags
- [ ] Webview receives correct feature state

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes
**Gate:** Sprint Phase 2→3 requires Jarmo's approval

## Approval

- [ ] Jarmo approved this sprint plan (awaiting review)

---

## Post-Approval: Implementation Notes

This section will be filled during Phase 3 (Development) with:
- Actual code snippets
- Edge cases encountered
- Adjustments made to the plan
- Useful patterns discovered

(To be completed after approval)
