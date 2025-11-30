# Project Context for Sibling Agents

## Quick Reference

### Repository URLs

| Repo | URL | Purpose |
|------|-----|---------|
| ritemark | https://github.com/jarmo-productory/ritemark | Web app (reference) |
| ritemark-native | https://github.com/jarmo-productory/ritemark-native | **You work here** |
| ritemark-shared | https://github.com/jarmo-productory/ritemark-shared | Shared packages (future) |

### Local Paths

```
/Users/jarmotuisk/Projects/ritemark          # Web app source
/Users/jarmotuisk/Projects/ritemark-native   # Native app (your workspace)
/Users/jarmotuisk/Projects/ritemark-shared   # Shared packages
```

### Key Documentation Locations

| Document | Path |
|----------|------|
| Master Plan | `ritemark/docs/research/vscode-native-app/README.md` |
| Technical Spec | `ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md` |
| Week 1 Workplan | `ritemark-native/docs/handover/WEEK-1-WORKPLAN.md` |

---

## Team Structure

**Jarmo** = Product Owner
- Makes all product decisions
- Tests and validates builds
- Approves releases

**Claude Agents** = Engineering
- Implement everything
- Ask Jarmo when uncertain
- Document progress

---

## Decision Protocol

1. **Clear task?** → Execute
2. **Uncertain?** → Ask Jarmo
3. **Architectural choice?** → Check locked decisions in README.md
4. **Not in locked decisions?** → Propose options to Jarmo

---

## Locked Decisions (Do Not Change)

- VS Code as git submodule (not fork)
- Custom Editor Provider for .md files
- 3 separate repositories
- Marketplace hidden by default
- Minimal telemetry, opt-out
- MIT license

---

## Communication Style

**With Jarmo:**
- Concise updates
- Show, don't tell (screenshots, demos)
- Ask specific questions
- No jargon unless necessary

**In commits:**
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Reference task: `feat: add VS Code submodule (Task 1)`

---

## Week 1 Timeline

| Task | Description | Est. Hours |
|------|-------------|------------|
| 1 | Add VS Code OSS submodule | 1-2 |
| 2 | Set up build environment | 2-3 |
| 3 | Create branding overrides | 1-2 |
| 4 | Create built-in extension | 2-3 |
| 5 | Wire extension into build | 1-2 |
| 6 | Create macOS build | 2-3 |
| **Total** | | **9-15** |

---

## Before You Start

1. Read `WEEK-1-WORKPLAN.md` completely
2. Read master plan in ritemark repo
3. Verify Node 18+ installed
4. Ask Jarmo if unclear on anything

---

## After Completing Week 1

1. Commit all changes
2. Push to GitHub
3. Create `WEEK-2-WORKPLAN.md`
4. Notify Jarmo for testing
