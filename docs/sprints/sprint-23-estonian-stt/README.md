# Sprint 23: Estonian STT (Second Attempt)

**Status:** Phase 1 (Research Complete) - Awaiting Jarmo's Approval

---

## Quick Links

- **Sprint Plan:** [sprint-plan.md](./sprint-plan.md) - Full implementation checklist
- **Research Findings:** [research/findings.md](./research/findings.md) - Technical research and analysis
- **Background Research:** [../../analysis/2026-01-17-estonian-stt-solution.md](../../analysis/2026-01-17-estonian-stt-solution.md) - ChatGPT deep research
- **Original Research:** [../../analysis/2026-01-15-voice-dictation-research.md](../../analysis/2026-01-15-voice-dictation-research.md) - Voice dictation research
- **Failed Sprint 22:** [../Archived/sprint-22-whisper-integration/](../Archived/sprint-22-whisper-integration/) - What went wrong

---

## Sprint Overview

**Goal:** Enable real-time voice dictation in RiteMark using bundled whisper.cpp binary, with Estonian language support and zero user installation required.

### Why Sprint 23? (Second Attempt)

Sprint 22 failed because it required `brew install whisper-cpp`, violating RiteMark's zero-install philosophy.

**Sprint 23 fixes this by:**
- ✅ Bundling whisper.cpp binary with extension
- ✅ Zero user installation
- ✅ Self-contained distribution

---

## Key Requirements (from Jarmo)

| Requirement | Value |
|-------------|-------|
| **Priority** | Immediate |
| **Platform** | macOS initially, Windows later |
| **Model** | Start with small (~244MB), optional TalTech upgrade |
| **UX** | Toggle mode (not push-to-talk) |
| **Languages** | Multi-language, Estonian is MUST |
| **UI** | Mic toggle button in editor toolbar (non-negotiable) |
| **Download** | Model downloads on first use with dialog |
| **Preview** | Show text as you speak (real-time streaming) |

---

## Technical Approach

```
┌────────────────────────────────────┐
│   RiteMark Webview                │
│   ┌────────────────────────────┐   │
│   │ Mic Button (Toggle)        │   │
│   │ Web Audio API (Capture)    │   │
│   └────────────────────────────┘   │
│              ▼                     │
│      sendToExtension('audioChunk') │
└────────────────────────────────────┘
               ▼
┌────────────────────────────────────┐
│   RiteMark Extension               │
│   ┌────────────────────────────┐   │
│   │ whisper.cpp (bundled)      │   │
│   │ Binary: darwin-arm64       │   │
│   │ Model: ~/.ritemark/models/ │   │
│   │ Transcribe via spawn()     │   │
│   └────────────────────────────┘   │
│              ▼                     │
│      postMessage('transcription')  │
└────────────────────────────────────┘
               ▼
┌────────────────────────────────────┐
│   RiteMark Webview                │
│   ┌────────────────────────────┐   │
│   │ editor.insertContent(text) │   │
│   │ Insert at cursor           │   │
│   └────────────────────────────┘   │
└────────────────────────────────────┘
```

### Key Differences from Sprint 22

| Aspect | Sprint 22 (Failed) | Sprint 23 (This) |
|--------|-------------------|------------------|
| Distribution | ❌ Homebrew | ✅ Bundled binary |
| Installation | ❌ Required | ✅ None |
| Integration | npm native module | Spawned process |
| Dependencies | FFmpeg, brew | None |

---

## Success Criteria

- [ ] User clicks mic button → dictation starts
- [ ] User speaks → text appears at cursor in real-time
- [ ] Estonian language transcription works (15-20% WER acceptable for MVP)
- [ ] Works offline (no cloud dependency)
- [ ] Zero installation required (binary bundled)
- [ ] macOS-only initially (Windows gracefully disabled)
- [ ] Model downloads on first use with progress indicator
- [ ] Cmd+Z undoes dictated text as single action

---

## Current Phase: 1 (Research)

### ✅ Completed
- [x] Review ChatGPT deep research on Estonian STT
- [x] Review original voice dictation research
- [x] Analyze failed Sprint 22
- [x] Confirm whisper.cpp is correct choice
- [x] Validate zero-install strategy (bundled binary)
- [x] Research TalTech Estonian models (11-14% WER)
- [x] Document Jarmo's requirements

### ⏸️ Next: Phase 2 (Plan & Build Binary)

**BLOCKER:** Requires Jarmo's approval to proceed to Phase 2.

Open questions for Jarmo:
1. **Model size acceptance**: Is 244MB download for small model acceptable? (Better Estonian accuracy than 75MB tiny)
2. **TalTech model offering**: Should we offer optional 1.5GB TalTech large model download for best Estonian accuracy?
3. **Mic button icon**: Any preference for icon style? (Currently planning simple 🎤)
4. **Error handling**: How verbose should error messages be? (Technical vs. user-friendly)
5. **Settings UI**: Should model selection be in settings, or auto-detect language and use appropriate model?

---

## Model Strategy

### Default: ggml-small.bin (~244MB)

| Attribute | Value |
|-----------|-------|
| Estonian WER | ~15-20% (good) |
| Speed | Fast (real-time on M1) |
| Languages | 99 languages |
| Download | On first use |

### Optional: TalTech whisper-large-et (~1.5GB)

| Attribute | Value |
|-----------|-------|
| Estonian WER | ~11% (excellent) |
| Speed | Slower |
| Languages | Estonian-optimized |
| Download | User choice in settings |

---

## Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| 1 | Research (✅ Complete) | 1 day |
| 2 | Plan & Build Binary | 2 days |
| 3 | Backend Implementation | 3 days |
| 4 | Frontend Implementation | 3 days |
| 5 | Integration & Polish | 2 days |
| 6 | Testing & Validation | 2 days |
| **Total** | | **13 days** |

---

## Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Binary not executable in VSIX** | High | Test early, use post-install script |
| **Metal GPU not available** | Medium | whisper.cpp auto-falls back to CPU |
| **Estonian accuracy <15% WER** | High | Test early, offer TalTech upgrade |

---

## Key Learnings from Sprint 22

### ✅ What We Keep
- Technology choice: whisper.cpp is correct
- UX design: Toggle mode, mic button in toolbar
- Estonian focus: Multi-language with Estonian priority
- Local-first: Offline processing is core requirement

### ❌ What We Fix
- Distribution: Bundle binary instead of Homebrew
- Integration: Spawned process instead of npm native module
- Dependencies: Self-contained instead of external tools

---

## Sprint History

| Date | Event |
|------|-------|
| 2026-01-15 | Original voice dictation research completed |
| 2026-01-17 | Sprint 22 failed (Homebrew dependency) |
| 2026-01-17 | Sprint 23 created, Phase 1 research documented |
| TBD | Jarmo approval for Phase 2 |

---

## References

- **ChatGPT Deep Research**: [docs/analysis/2026-01-17-estonian-stt-solution.md](../../analysis/2026-01-17-estonian-stt-solution.md)
- **Original Research**: [docs/analysis/2026-01-15-voice-dictation-research.md](../../analysis/2026-01-15-voice-dictation-research.md)
- **Failed Sprint 22**: [docs/sprints/Archived/sprint-22-whisper-integration/](../Archived/sprint-22-whisper-integration/)
- **whisper.cpp**: https://github.com/ggml-org/whisper.cpp
- **TalTech Models**: https://huggingface.co/TalTechNLP
- **Whisper Paper**: https://arxiv.org/abs/2212.04356

---

## Contact

**Sprint Manager:** Claude (Engineering)
**Product Owner:** Jarmo
**Approval Required:** Yes (Phase 2→3 gate)

---

## Status Summary

```
Sprint: 23 - Estonian STT (Second Attempt)
Phase: 1 (Research - Complete)
Status: Awaiting Jarmo's approval for Phase 2
Gate: BLOCKED - Requires approval
```

**Next Action:** Jarmo reviews sprint plan and provides approval to proceed with Phase 2 (Plan & Build Binary).
