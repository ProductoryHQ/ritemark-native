# Sprint 27 Status

**Sprint:** 27 - RiteMark Flows Phase 1 MVP
**Branch:** feature/ritemark-flows
**Current Phase:** 2 (Plan)
**Status:** Awaiting Jarmo's approval
**Gate:** BLOCKED - Requires approval before Phase 3 (Development)

---

## What's Ready

### Research Complete (Phase 1)
All research documentation is complete and committed:

1. **Existing Architecture Analysis**
   - Location: `research/existing-architecture.md`
   - Findings: UnifiedViewProvider pattern, OpenAI service reuse, file operations

2. **React Flow UI Research**
   - Location: `research/react-flow-ui.md`
   - Findings: Workflow Editor template, 52KB bundle impact, shadcn/ui integration

3. **Image Generation APIs**
   - Location: `research/image-generation-apis.md`
   - Findings: GPT Image 1.5 default, pricing analysis, deferred to Phase 2

### Sprint Plan Complete (Phase 2)
- Location: `sprint-plan.md`
- Feature flag defined
- Implementation checklist with 8 phases
- Success criteria clear
- Deliverables listed
- Risks assessed

---

## Awaiting Approval

**Required from Jarmo:**
- Review sprint plan: `docs/sprints/sprint-27-ritemark-flows/sprint-plan.md`
- Confirm approach (feature flag, experimental status, Phase 1 scope)
- Approve with one of:
  - "approved"
  - "Jarmo approved"
  - "proceed"
  - "go ahead"

**After approval, Phase 3 will begin:**
1. Add feature flag to `flags.ts`
2. Create extension infrastructure (FlowStorage, FlowExecutor, FlowsViewProvider)
3. Add webview dependencies (React Flow, Zustand)
4. Build basic UI (FlowsPanel, RunFlowModal)
5. Implement LLM node executor
6. Test in dev and production

---

## Key Decisions Made

### Scope: Phase 1 MVP Only
- Input + LLM nodes only (validates architecture)
- Simple list + run UI (no visual editor yet)
- Feature flag gated (experimental, opt-in)
- Image generation deferred to Phase 2

### Technical Choices
- React Flow UI for future visual editor
- Zustand for state management (lightweight)
- `.flows/*.flow.json` storage (workspace-local)
- Sequential execution (extension-side)
- Reuse existing OpenAI service

### Dependencies Added
- Webview: reactflow (45KB), @xyflow/react (5KB), zustand (2KB)
- Extension: None (reuse existing)
- **Total bundle impact: ~52KB**

---

## Next Actions After Approval

1. **Phase 1.1:** Feature flag setup (30 min)
2. **Phase 1.2:** Extension infrastructure (4 hours)
3. **Phase 1.3:** Package.json updates (30 min)
4. **Phase 1.4:** Webview dependencies (15 min)
5. **Phase 1.5:** Webview components (3 hours)
6. **Phase 1.6:** Message bridge (1 hour)
7. **Phase 1.7:** Testing (2 hours)
8. **Phase 1.8:** Documentation (1 hour)

**Estimated total effort:** 12 hours (1.5 days)

---

## Files That Will Be Created

### Extension
```
extensions/ritemark/src/flows/
├── FlowStorage.ts
├── FlowExecutor.ts
├── FlowsViewProvider.ts
├── types.ts
└── nodes/
    └── LLMNodeExecutor.ts
```

### Webview
```
extensions/ritemark/webview/src/components/flows/
├── FlowsPanel.tsx
├── RunFlowModal.tsx
├── types.ts
└── index.ts
```

### Documentation
```
docs/features/flows.md  (user-facing)
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Feature flag doesn't work | Low | High | Test immediately in Phase 1.1 |
| React Flow theme issues | Medium | Medium | Use VS Code CSS variables |
| Bundle size too large | Low | Medium | Only 52KB added, acceptable |
| User confusion | Medium | Low | Clear docs, empty state messages |

---

## Questions for Jarmo

1. **Scope:** Is Phase 1 (Input + LLM only) acceptable for MVP?
2. **UI Location:** Flows panel in AI sidebar OK, or prefer separate activity bar icon?
3. **Experimental status:** Good with opt-in feature flag for initial release?
4. **Image generation:** Defer to Phase 2, or critical for Phase 1?

---

## Sprint Phases (6-Phase Workflow)

- [x] **Phase 1: Research** - Architecture, React Flow, image APIs
- [x] **Phase 2: Plan** - Sprint plan created
- [ ] **Phase 3: Develop** - BLOCKED (awaiting approval)
- [ ] **Phase 4: Test & Validate** - qa-validator check
- [ ] **Phase 5: Cleanup** - Code review, docs
- [ ] **Phase 6: Deploy** - Commit, push, tag

**Current gate:** Phase 2 → 3 requires Jarmo's explicit approval.

---

**Last Updated:** 2026-01-31
**Sprint Manager:** Claude (sprint-manager agent)
