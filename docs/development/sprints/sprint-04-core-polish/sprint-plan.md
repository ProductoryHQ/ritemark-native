# Sprint 04: Core Polish

**Goal:** Strip VS Code chrome to create a clean, focused Ritemark experience

**Status:** ✅ COMPLETE

**Duration:** ~3-5 days estimated

---

## Exit Criteria (Jarmo Validates)

- [x] App feels like "Ritemark" not "VS Code"
- [x] No dev-focused UI elements visible (except Terminal)
- [x] Clean, minimal interface for writing
- [x] Terminal still works (for Claude Code integration)
- [x] Jarmo: "This doesn't feel like VS Code anymore"

---

## Phase Checklist

### Phase 1: RESEARCH ✅
- [x] Identify VS Code UI component locations
- [x] Document modification strategies
- [x] Create research notes (`research/vscode-ui-components.md`)

### Phase 2: PLAN ✅
- [x] Create sprint-plan.md (this file)
- [x] **Jarmo approval to proceed**

### Phase 3: DEVELOP ✅

#### Task 1: Activity Bar Cleanup ✅
- [x] Hide Accounts icon (`globalCompositeBar.ts:106`)
- [x] Hide Settings gear (`globalCompositeBar.ts:109`)
- [x] Verify Explorer, Search, SCM still visible

#### Task 2: Status Bar Simplification ✅
- [x] Hide Language Mode selector
- [x] Hide Encoding selector
- [x] Hide EOL (Line Endings) selector
- [x] Hide Spaces/Tabs indicator
- [x] Hide Remote Indicator ("Open Remote Window")
- [x] Hide Problems indicator
- [x] Hide Ports indicator
- [x] Keep: Line/column position
- [x] Keep: Git branch indicator
- [ ] Decision: Add word count? (deferred)

#### Task 3: Menu Cleanup ✅
- [x] Hide Debug/Run menu (`debug.contribution.ts:242-249`)
- [x] Keep Terminal menu (for Claude Code!)
- [ ] Review View menu - remove dev items? (deferred)
- [ ] Review Help menu - Ritemark-specific? (deferred)

#### Task 4: Panel Cleanup ✅
- [x] Keep Terminal panel
- [x] Hide Problems panel (default hidden via settings)
- [x] Hide Output panel (default hidden via settings)
- [x] Hide Debug Console panel (default hidden via settings)

#### Task 5: Title Bar Cleanup ✅
- [x] Hide Command Center (search bar in title bar)
- [x] Hide layout controls (toggle buttons)

#### Task 6: Branding ✅
- [x] Fix Mac menu bar name (was "Code - OSS", now "Ritemark")
- [x] Fix About dialog branding
- [x] Update product.ts fallback branding

#### Task 7: Design Decisions (During Sprint)
- [ ] Overall look & feel review with Jarmo
- [ ] Color/theme adjustments?
- [ ] Activity bar width/style?
- [ ] Status bar height/style?

### Phase 4: TEST & VALIDATE ✅
- [x] All hidden items actually hidden
- [x] Terminal works correctly
- [x] No broken functionality
- [x] Jarmo design approval

### Phase 5: CLEANUP ✅
- [x] Add Ritemark comments to modified files
- [x] Remove any debug code
- [x] Document changes

### Phase 6: CI/CD DEPLOY ✅
- [x] Commit all changes
- [x] Push to GitHub
- [x] Update roadmap

---

## Additional Work Completed (Welcome Page Branding)

#### Task 8: Welcome Page Branding ✅
- [x] Ritemark logo with "BY PRODUCTORY" tagline
- [x] Productory brand colors (Indigo #4338ca, Cyan #2dd4bf, Magenta #d946ef)
- [x] Brand fonts (Space Grotesk for headers, Sofia Sans for body)
- [x] Left-aligned hero layout
- [x] New tagline: "Write smarter. Think faster."
- [x] Clean Start/Recent sections
- [x] Ghost-style buttons with brand styling
- [x] Removed Get Started section for cleaner look

---

## Files to Modify

```
vscode/src/vs/workbench/browser/parts/
├── activitybar/
│   └── globalCompositeBar.ts      ← Accounts icon (line 106)
├── statusbar/
│   └── editorStatus.ts            ← Language, Encoding, EOL, Indent
└── panel/
    └── (view hiding for Problems, Output)

vscode/src/vs/workbench/contrib/
├── debug/browser/
│   └── debug.contribution.ts      ← Debug/Run menu (lines 242-249)
└── output/browser/
    └── output.contribution.ts     ← Output panel
```

---

## Keep vs Hide Summary

| Component | Action | Reason |
|-----------|--------|--------|
| Explorer | KEEP | File navigation |
| Search | KEEP | Find in files |
| SCM (Git) | KEEP | Version control |
| Accounts | HIDE | Not needed for writing |
| Settings gear | TBD | Discuss during sprint |
| Terminal menu | KEEP | Claude Code integration! |
| Terminal panel | KEEP | Claude Code integration! |
| Debug/Run menu | HIDE | Dev-focused |
| Problems panel | HIDE | Dev-focused |
| Output panel | HIDE | Dev-focused |
| Language selector | HIDE | Always Markdown |
| Encoding selector | HIDE | Rarely needed |
| EOL selector | HIDE | Rarely needed |
| Indent selector | HIDE | Rarely needed |

---

## Design Decisions (To Discuss)

These will be decided during the sprint with Jarmo:

1. **Settings gear** - Keep for user access or hide completely?
2. **Word count** - Add to status bar?
3. **Activity bar style** - Current width ok? Icons only?
4. **Status bar style** - Current height ok? What to show?
5. **Overall theme** - Any color adjustments needed?
6. **Welcome state** - What to show when no file open?

---

## Notes

_Implementation notes will be added during development_
