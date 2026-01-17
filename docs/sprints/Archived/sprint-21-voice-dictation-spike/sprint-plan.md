# Sprint 21: Voice Dictation Spike

## Goal
Validate the feasibility of adding voice dictation to RiteMark by testing if the VS Code Speech extension works in our fork, and determine the technical path forward based on findings.

## Success Criteria
- [ ] VS Code Speech extension tested in RiteMark Native
- [ ] **Estonian language support verified** (MUST HAVE)
- [ ] Toggle mode (not push-to-talk) verified
- [ ] Compatibility documented (works / doesn't work / partially works)
- [ ] If it doesn't work: root cause identified
- [ ] Technical recommendation made for implementation approach

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Spike Report | Document testing results, compatibility findings, and technical recommendation |
| Decision Matrix | Clear path forward based on spike results |
| Implementation Estimate | Rough effort estimate for chosen approach |

## Jarmo's Decisions (2026-01-17)

| Question | Decision | Impact |
|----------|----------|--------|
| Priority | **Immediate** | Full steam ahead |
| Scope | **macOS initially**, Windows later | Add platform detection |
| Model size | **No concerns** (~75MB acceptable) | Can use larger models if needed |
| UX preference | **Toggle mode** | Not push-to-talk |
| Language | **Multi-language immediately, Estonian is MUST** | Critical spike criterion |

## Minimum UX Requirement

**Mic toggle button in editor toolbar** (non-negotiable for MVP)

```
┌─────────────────────────────────────────────────────────┐
│  RiteMark Toolbar                                       │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐         ┌────┐         │
│  │B │ │I │ │H1│ │""│ │••│ │🔗│   ...   │ 🎤 │         │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘         └────┘         │
│                                         ▲              │
│                                    Mic toggle          │
└─────────────────────────────────────────────────────────┘
```

### States

| State | Icon | Behavior |
|-------|------|----------|
| Idle | 🎤 (grey) | Click to start dictation |
| Listening | 🎤 (red/pulsing) | Click to stop dictation |
| Processing | 🎤 (spinner) | Brief, auto-returns to idle |

### Interaction
- Click to toggle on/off (not hold-to-talk)
- Keyboard shortcut also toggles (⌥⌘V or similar)
- Visual feedback when active (color change, pulse animation)

### Critical Implications

**Estonian Language Requirement** changes the spike significantly:
- Must verify VS Code Speech extension supports Estonian
- If not → VS Code Speech option may be ruled out immediately
- Whisper multilingual models support Estonian → likely fallback path

## Implementation Checklist

### Phase 1: Research
- [ ] Review existing research document (2026-01-15-voice-dictation-research.md)
- [ ] Document current VS Code Speech extension architecture
- [ ] Identify RiteMark webview integration points
- [ ] Document potential blockers (extension API, permissions, webview context)

### Phase 2: Plan
- [ ] Define test scenarios for VS Code Speech extension
- [ ] Create test checklist (basic dictation, webview context, keyboard shortcuts)
- [ ] Plan fallback approach if extension doesn't work
- [ ] Document expected outcomes and decision criteria

### Phase 3: Spike Execution
- [ ] **Check Estonian language support in VS Code Speech** (do this FIRST - may be blocker)
- [ ] Install VS Code Speech extension in RiteMark Native
- [ ] Test basic dictation in regular markdown files
- [ ] Test dictation in RiteMark webview editor
- [ ] Test keyboard shortcuts (⌥⌘V)
- [ ] **Test toggle mode** (start/stop, not hold-to-talk)
- [ ] **Test Estonian dictation** if supported
- [ ] Test microphone permissions and setup flow
- [ ] Document all findings with screenshots

### Phase 4: Test & Validate
- [ ] Verify all test scenarios completed
- [ ] qa-validator check before committing findings

### Phase 5: Analysis & Recommendation
- [ ] Analyze compatibility results
- [ ] Document root cause if extension doesn't work
- [ ] Recommend technical approach based on findings
- [ ] Estimate effort for recommended approach
- [ ] Answer open questions or flag what still needs Jarmo's input

### Phase 6: Deliverables
- [ ] Spike report written
- [ ] Decision matrix created
- [ ] Present findings to Jarmo
- [ ] Get approval for next phase (if proceeding)

## Technical Context

### From Research Document

The research identified 4 potential approaches:
1. **VS Code Speech Extension** - Test compatibility (THIS SPIKE)
2. **whisper.cpp** - Cross-platform Node.js integration
3. **WhisperKit** - Swift/CoreML for Apple Silicon
4. **macOS Speech Framework** - Native macOS API

### Phased Approach (from Research)

- **Phase 1 (THIS SPRINT):** Evaluate VS Code Speech Extension
- **Phase 2:** whisper.cpp integration (if Phase 1 fails or is insufficient)
- **Phase 3:** Native enhancement with WhisperKit or macOS Speech Framework

### Key Questions to Answer in Spike

1. Does VS Code Speech extension work in RiteMark webview?
2. If yes, is it good enough for our needs?
3. If no, what breaks? (extension API, webview context, permissions?)
4. What's the recommended path forward?

## Risks

| Risk | Mitigation |
|------|------------|
| **VS Code Speech doesn't support Estonian** | Check FIRST before full testing → if no Estonian, skip to whisper.cpp |
| Extension doesn't work in webview | Already planned - research identified alternatives |
| No toggle mode (only push-to-talk) | Document, may need custom implementation |
| Microphone permissions differ in RiteMark fork | Test early, document permission flow |
| Extension conflicts with RiteMark editor | Document conflicts, plan workarounds |
| Spike inconclusive | Define clear decision criteria upfront |

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes

## Approval

- [ ] Jarmo approved this sprint plan

---

## Notes

This is a **spike sprint** - the goal is learning and decision-making, not production code.

### Decision Flow

```
Check Estonian support in VS Code Speech
         │
    ┌────┴────┐
    │ Yes     │ No
    ▼         ▼
Full test   Skip to whisper.cpp
    │       (supports Estonian)
    │
Works in webview + toggle mode?
    │
┌───┴───┐
Yes     No
▼       ▼
Bundle  whisper.cpp sprint
```

The spike should be time-boxed and focused on answering the key compatibility question.
