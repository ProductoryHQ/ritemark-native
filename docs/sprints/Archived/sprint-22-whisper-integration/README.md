# Sprint 22: Voice Dictation with whisper.cpp

**Status:** Phase 1 (Research Complete) - Awaiting Jarmo's Approval for Phase 2

---

## Quick Links

- **Sprint Plan:** [sprint-plan.md](./sprint-plan.md) - Full implementation checklist
- **Technical Research:** [research/whisper-node-integration.md](./research/whisper-node-integration.md)
- **UX Design:** [research/ux-design.md](./research/ux-design.md)
- **Background Research:** [../../analysis/2026-01-15-voice-dictation-research.md](../../analysis/2026-01-15-voice-dictation-research.md)

---

## Sprint Overview

**Goal:** Enable real-time voice dictation in RiteMark using whisper.cpp, with toggle mode and multi-language support (including Estonian).

**Why whisper.cpp:**
- VS Code Speech extension does NOT support Estonian (confirmed blocker)
- whisper.cpp supports 99 languages including Estonian
- 100% local/offline processing (aligns with RiteMark philosophy)
- Fast inference on Apple Silicon (~32x realtime with tiny model)

---

## Key Requirements (from Jarmo)

| Requirement | Value |
|-------------|-------|
| **Priority** | Immediate |
| **Platform** | macOS initially, Windows later |
| **Model** | Tiny multilingual (~75MB) |
| **UX** | Toggle mode (not push-to-talk) |
| **Languages** | Multi-language, Estonian is MUST |
| **UI** | Mic toggle button in editor toolbar (non-negotiable) |

---

## Technical Approach

```
┌─────────────────────────────────────────┐
│   RiteMark Webview (React/TipTap)      │
│   ┌─────────────────────────────────┐   │
│   │ Mic Button (Toggle)             │   │
│   │ Web Audio API (Capture)         │   │
│   └─────────────────────────────────┘   │
│              ▼                          │
│      sendToExtension('audioChunk')      │
└─────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│   RiteMark Extension (TypeScript)       │
│   ┌─────────────────────────────────┐   │
│   │ whisper-node                    │   │
│   │   ▼                             │   │
│   │ whisper.cpp (native addon)      │   │
│   │   ▼                             │   │
│   │ Transcribe (Estonian/English)   │   │
│   └─────────────────────────────────┘   │
│              ▼                          │
│      postMessage('transcriptionChunk')  │
└─────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────┐
│   RiteMark Webview (React/TipTap)      │
│   ┌─────────────────────────────────┐   │
│   │ editor.insertContent(text)      │   │
│   │ Insert at cursor position       │   │
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] User clicks mic button → dictation starts
- [ ] User speaks → text appears at cursor in real-time
- [ ] Estonian language transcription works accurately
- [ ] Toggle states visible (idle/listening/processing)
- [ ] Works offline (no cloud dependency)
- [ ] macOS only (Windows gracefully disabled)
- [ ] Cmd+Z undoes dictated text as single action

---

## Current Phase: 1 (Research)

### Completed
- [x] Review voice dictation research document
- [x] Confirm whisper.cpp approach (Jarmo approved)
- [x] Document technical integration plan
- [x] Design UX flow and button states
- [x] Identify risks and mitigations

### Next: Phase 2 (Technical Design)

**Requires Jarmo's approval to proceed to Phase 2.**

Open questions for Phase 2:
1. Mic button placement: BubbleMenu vs. Fixed Toolbar?
2. Model bundling: Include in app (~75MB) or download on first use?
3. Keyboard shortcut: Cmd+Option+V or different?
4. Live preview: Show transcription in real-time or wait for final?

---

## Timeline Estimate

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| 1 | Research (Complete) | 1 day |
| 2 | Technical Design | 1 day |
| 3 | Backend Implementation | 2-3 days |
| 4 | Frontend Implementation | 2-3 days |
| 5 | Integration & Polish | 1-2 days |
| 6 | Testing & Validation | 1-2 days |
| **Total** | | **8-12 days** |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| whisper-node compilation fails | High | Test on clean macOS, document FFmpeg requirements |
| Estonian accuracy insufficient | High | Test early in Phase 2, may need model tuning |
| Real-time latency >500ms | Medium | Tune chunk size, consider smaller model |
| Model size too large | Low | 75MB acceptable per Jarmo |

---

## Dependencies

### npm Packages
- `whisper-node` - Node.js bindings for whisper.cpp
- (All TipTap packages already installed)

### System Requirements
- **macOS:** 11.0+ (for Metal acceleration)
- **FFmpeg:** Required for audio conversion (may need to bundle or document)
- **Disk Space:** ~75MB for tiny multilingual model
- **RAM:** ~500MB during dictation

---

## Sprint History

| Date | Event |
|------|-------|
| 2026-01-15 | Initial voice dictation research completed |
| 2026-01-17 | Sprint 22 created, Phase 1 research documented |
| TBD | Jarmo approval for Phase 2 |

---

## Related Sprints

- **Sprint 21:** Voice dictation spike (VS Code Speech evaluation)
- **Sprint 23:** (Future) Windows support for voice dictation

---

## Contact

**Sprint Manager:** Claude (Engineering)
**Product Owner:** Jarmo
**Approval Required:** Yes (Phase 2→3 gate)

---

## Notes

- This sprint builds on research from Sprint 21 spike
- Estonian language support is non-negotiable
- macOS-only initially, platform detection for Windows graceful disable
- Toggle mode UX (not push-to-talk) per Jarmo's preference
- Mic button in editor toolbar is minimum UX requirement
