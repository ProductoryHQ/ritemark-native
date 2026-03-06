# Sprint 07: Governor Refactor - CLAUDE.md as CEO

## Goal

Transform CLAUDE.md from a monolithic documentation file into a "Governor/CEO" pattern that:
1. Knows critical business facts (architecture, structure, invariants)
2. Delegates technical execution to expert subagents
3. Enforces approval gates and quality checkpoints
4. Self-checks before every response

## Success Criteria

- [x] CLAUDE.md reduced to ~143 lines (from 175) - contains CEO-level knowledge
- [x] 4 expert agents operational: vscode-expert, sprint-manager, qa-validator, webview-expert
- [x] HARD enforcement: Cannot proceed with sprint dev without approval
- [x] HARD enforcement: qa-validator runs before any commit
- [x] Knowledge vacuum: Technical details ONLY in agents/skills, not CLAUDE.md

---

## Deliverables

### 1. New Agents

| Agent | File | Purpose |
|-------|------|---------|
| sprint-manager | `.claude/agents/sprint-manager.md` | Sprint workflow, phase gates, approval enforcement |
| qa-validator | `.claude/agents/qa-validator.md` | Quality checks before commits, build validation |
| webview-expert | `.claude/agents/webview-expert.md` | TipTap, Vite, React, bundle troubleshooting |

### 2. Enhanced Agents

| Agent | Enhancement |
|-------|-------------|
| vscode-expert | Add MANDATORY trigger keywords, clarify when NOT to use |

### 3. Refactored Files

| File | Change |
|------|--------|
| `CLAUDE.md` | Slim to governor pattern (~80 lines) |
| `.claude/skills/vscode-development/SKILL.md` | Absorb technical details from CLAUDE.md |

---

## Implementation Checklist

### Phase 1: Create New Agents

- [x] **1.1** Create `sprint-manager.md` agent
  - 6-phase workflow definition
  - HARD gate at Phase 2→3 (requires "Jarmo approved")
  - HARD gate at Phase 4→5 (requires qa-validator pass)
  - Trigger keywords: sprint, phase, plan, implement

- [x] **1.2** Create `qa-validator.md` agent
  - Symlink integrity check
  - Webview bundle size check (>500KB)
  - TypeScript compilation check
  - Commit message format enforcement
  - Trigger keywords: commit, push, done, ship, merge, PR

- [x] **1.3** Create `webview-expert.md` agent
  - TipTap editor knowledge
  - Vite bundling
  - React in VS Code webview context
  - CSP and asset URI handling
  - Trigger keywords: webview, tiptap, react, vite, bundle

### Phase 2: Enhance Existing Agents

- [x] **2.1** Update `vscode-expert.md`
  - Add MANDATORY invocation language
  - Add trigger keywords to description
  - Clarify scope boundaries with other agents

### Phase 3: Refactor CLAUDE.md

- [x] **3.1** Create new governor-pattern CLAUDE.md
  - Project Identity section
  - Architecture (locked decisions) section
  - Repository Structure section
  - Critical Invariants section
  - Team section
  - Expert Agents routing table (MANDATORY)
  - Approval Gates (HARD enforcement)
  - Self-Check Protocol

- [x] **3.2** Remove technical details
  - Development commands → vscode-expert
  - Common issues → TROUBLESHOOTING.md
  - Sprint routine → sprint-manager
  - Webview rebuild → webview-expert

### Phase 4: Update Skills

- [x] **4.1** Ensure vscode-development skill has all technical details
  - Verified: development commands present in SKILL.md
  - Verified: environment setup present
  - Verified: TROUBLESHOOTING.md has Ritemark-specific issues

### Phase 5: Validation

- [x] **5.1** Test agent invocation
  - All agents have MANDATORY + IMMEDIATELY language
  - Trigger keywords in descriptions
  - Scope boundaries defined

- [x] **5.2** Test HARD gates
  - sprint-manager refuses Phase 3 without approval
  - qa-validator BLOCKS commits if checks fail

- [x] **5.3** Test knowledge vacuum
  - CLAUDE.md routing table points to agents
  - Technical details only in agents/skills

### Phase 6: Documentation

- [ ] **6.1** Update ROADMAP.md with sprint completion
- [ ] **6.2** Commit all changes

---

## Agent Design Specifications

### sprint-manager.md

```yaml
name: sprint-manager
description: >
  MANDATORY for all sprint work. Invoke IMMEDIATELY when user mentions:
  sprint, phase, plan, implement, develop, build feature.
  Enforces 6-phase workflow with HARD approval gates.
tools: Read, Write, Edit, Glob, Grep
model: sonnet
```

**Key behaviors:**
- Knows the 6-phase workflow
- Creates sprint directory structure
- Writes sprint-plan.md template
- REFUSES to proceed to Phase 3 without "Jarmo approved" or "@approved"
- Tracks phase transitions
- Invokes qa-validator at Phase 4→5 and Phase 6

### qa-validator.md

```yaml
name: qa-validator
description: >
  MANDATORY before any commit or release. Invoke when user mentions:
  commit, push, done, ship, merge, PR, ready, complete.
  Validates build quality and enforces standards.
tools: Read, Bash, Glob, Grep
model: sonnet
```

**Checks performed:**
1. Symlink: `vscode/extensions/ritemark` → `../../extensions/ritemark`
2. Webview size: `media/webview.js` > 500KB
3. TypeScript: `npm run compile` exits 0 (in extension dir)
4. No console.log/debugger in production code
5. Commit message format (conventional commits)

**Behavior:**
- BLOCKS commit if any check fails
- Reports failures with fix instructions
- Can be bypassed ONLY with explicit "skip qa" (logs warning)

### webview-expert.md

```yaml
name: webview-expert
description: >
  Specialist for Ritemark webview/editor issues. Invoke when user mentions:
  webview, tiptap, react, vite, bundle, editor blank, editor not loading.
  Knows TipTap, Vite bundling, React in VS Code context.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
```

**Knowledge domains:**
- TipTap editor configuration and extensions
- Vite build for VS Code webview
- Content Security Policy for webviews
- Asset URI handling (`webview.asWebviewUri()`)
- The 900KB bundle size requirement
- Webview ↔ Extension message passing

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Claude ignores routing table | Knowledge vacuum + specific trigger keywords |
| Agents overlap in scope | Clear boundaries in each agent description |
| Too much friction from gates | Gates only at critical points, not every action |
| Lost knowledge during refactor | Keep old CLAUDE.md as backup until validated |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: New agents | 3 agents, ~100 lines each |
| Phase 2: Enhance existing | Minor updates |
| Phase 3: Refactor CLAUDE.md | ~80 lines new, careful migration |
| Phase 4: Update skills | Minor additions |
| Phase 5: Validation | Manual testing |
| Phase 6: Documentation | Quick |

---

## Status

**Current Phase:** 6 (DOCUMENTATION) - Ready to commit

**Approval Required:** No - implementation complete

---

## Approval

- [x] Jarmo approved this sprint plan (2024-12-06)

## Completion Summary

All phases completed:
- 3 new agents created (sprint-manager, qa-validator, webview-expert)
- 1 agent enhanced (vscode-expert)
- CLAUDE.md refactored to governor pattern
- All validation checks passed
