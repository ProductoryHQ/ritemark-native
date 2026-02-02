# Sprint 01: Feature Flag System

## Goal

Implement a minimal, type-safe feature flag system that supports platform filtering, user preferences for experimental features, and future extensibility for remote config and premium licensing - without changing how features are called.

## Success Criteria

- [x] `isEnabled(flagId)` function works correctly for all status types
- [x] Platform filtering prevents platform-specific features on wrong OS
- [x] Experimental features appear as toggles in VS Code Settings UI
- [x] Voice dictation is gated (experimental, darwin-only, default OFF)
- [x] Markdown export flag defined (stable, no runtime gate - always true)
- [x] TypeScript compilation succeeds with no errors
- [x] Documentation updated (CLAUDE.md, sprint-manager agent)
- [ ] Dev mode runs successfully and features behave correctly
- [ ] All currently working features continue to work (no regressions)

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

### Phase 2: Plan (COMPLETED)
- [x] Review sprint plan with Jarmo
- [x] Get approval to proceed to Phase 3

### Phase 3: Implementation (COMPLETED)
- [x] `src/utils/platform.ts` - `getCurrentPlatform()` with fallback
- [x] `src/features/flags.ts` - FeatureFlag interface, FlagId type, FLAGS register
- [x] `src/features/featureGate.ts` - `isEnabled()` with full evaluation logic
- [x] `src/features/index.ts` - Public API exports
- [x] `package.json` - "Ritemark Features" config section with voice-dictation toggle

### Phase 4: Integration (COMPLETED)
- [x] Single early-return gate for all `dictation:*` messages
- [x] Feature state sent to webview in load message
- [x] No runtime gate for markdown-export (stable = always on, flag for kill-switch only)

### Phase 5: Documentation (COMPLETED)
- [x] CLAUDE.md - Feature flag guidelines section
- [x] sprint-manager.md - Flag checklist in sprint template

### Phase 6: Validation
- [x] TypeScript compilation passes
- [ ] Dev mode testing (Settings UI, toggle behavior)
- [ ] Regression testing (all features still work)

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
