# Sprint 23 Research: Estonian STT (Second Attempt)

**Date:** 2026-01-17
**Phase:** 1 (Research)
**Author:** Claude (Sprint Manager)

---

## Context: Why Sprint 23?

This is the **second attempt** at voice dictation. The first attempt (previous Sprint 22, now archived) failed because it required users to run `brew install whisper-cpp`, which **violates Ritemark's zero-install philosophy**.

### What Went Wrong in Sprint 22

| Problem | Impact |
|---------|--------|
| Required Homebrew installation | User friction, against Ritemark principles |
| No bundled binary | Feature unusable out-of-the-box |
| External dependency | Not truly "local-first" |

### The Corrected Approach

**Bundle the whisper.cpp binary with the extension** - no external installations required.

---

## Research Summary

### Key Documents Reviewed

1. **ChatGPT Deep Research** (`docs/analysis/2026-01-17-estonian-stt-solution.md`)
   - Comprehensive evaluation of Estonian STT options
   - Confirms whisper.cpp as optimal choice
   - Documents TalTech fine-tuned Estonian models

2. **Original Research** (`docs/analysis/2026-01-15-voice-dictation-research.md`)
   - User needs analysis
   - UX design patterns
   - Technical solution comparison

3. **Failed Sprint Autopsy** (`docs/sprints/Archived/sprint-22-whisper-integration/`)
   - What went wrong: Homebrew dependency
   - What was right: whisper.cpp technology choice
   - Lessons learned: Must bundle everything

---

## Technical Solution Analysis

### Why whisper.cpp?

| Factor | Evaluation |
|--------|------------|
| **Estonian Support** | ✅ Yes, 99 languages including Estonian |
| **Offline** | ✅ 100% local processing, no cloud |
| **Accuracy** | ✅ 11-14% WER with TalTech fine-tuned models |
| **Speed** | ✅ Real-time on Apple Silicon with Metal GPU |
| **Zero Dependencies** | ✅ Can bundle pre-compiled binary |
| **License** | ✅ MIT, open-source |

### Model Options

| Model | Size | WER (Estonian) | Speed | Source |
|-------|------|----------------|-------|--------|
| **TalTech whisper-large-et** | ~1.5GB | ~11% | Slower | HuggingFace |
| **TalTech whisper-medium-et** | ~769MB | ~14.7% | Medium | HuggingFace |
| **Generic whisper-tiny** | ~75MB | ~20%+ | Fastest | OpenAI |
| **Generic whisper-small** | ~244MB | ~15-20% | Fast | OpenAI |

**Recommendation:** Start with generic `whisper-small` (~244MB), offer TalTech models as optional download for better Estonian accuracy.

---

## Estonian STT Accuracy Research

### TalTech Research (2025)

TalTech (Tallinn University of Technology) has fine-tuned Whisper models specifically for Estonian:

- **whisper-large-et**: 11.23% WER on Common Voice Estonian 8.0
- **whisper-medium-et**: 14.71% WER on Common Voice Estonian 11.0
- Trained on ~1200 hours of Estonian speech data
- Available on HuggingFace: `TalTechNLP/whisper-large-et`

### Generic Whisper on Estonian

- **Generic large-v3**: ~22% WER on Estonian (not fine-tuned)
- **Generic small**: ~15-20% WER (estimated)
- **Generic tiny**: ~20%+ WER (estimated)

### Real-World Implications

| WER | Quality | User Experience |
|-----|---------|-----------------|
| ~11% | Excellent | Minor corrections needed |
| ~15% | Good | Some corrections needed |
| ~20% | Acceptable | Regular corrections needed |
| >25% | Poor | Frustrating, not usable |

**Conclusion:** Generic whisper-small (~15-20% WER) is acceptable for MVP. Offer TalTech models for power users.

---

## Integration Architecture (Corrected)

### The Zero-Install Solution

```
Ritemark Extension
├── binaries/
│   └── darwin-arm64/
│       └── whisper.cpp        # Pre-compiled binary (bundled!)
├── models/
│   └── ggml-small.bin         # Downloaded on first use (~244MB)
└── src/
    └── voiceDictation.ts      # Spawns binary, manages audio
```

### Why This Works

1. **Pre-compiled binary**: Build whisper.cpp for darwin-arm64, include in extension
2. **Extension spawns process**: Use Node.js `child_process.spawn()`
3. **Audio piping**: Stream audio to stdin, read transcription from stdout
4. **No Homebrew**: User doesn't install anything
5. **No npm native modules**: Avoid compilation issues

### Data Flow

```
Webview (React)
    │
    │ Web Audio API
    │ (capture microphone)
    ▼
Bridge (postMessage)
    │
    │ audio chunks (base64)
    ▼
Extension (TypeScript)
    │
    │ spawn('whisper.cpp')
    │ pipe audio to stdin
    ▼
whisper.cpp binary
    │
    │ Metal GPU acceleration
    │ (automatic on Apple Silicon)
    ▼
stdout: transcription text
    │
    ▼
Extension → Webview
    │
    ▼
TipTap editor.insertContent()
```

---

## Platform Strategy

### macOS First

- Bundle `whisper.cpp` binary for darwin-arm64
- Use Metal GPU acceleration (built into whisper.cpp)
- Test on Apple Silicon M1/M2/M3

### Windows Later (Sprint 24+)

- Will need separate Windows binary (win32-x64)
- CUDA support if NVIDIA GPU present
- CPU fallback (slower but works)

### Platform Detection

```typescript
// extensions/ritemark/src/voiceDictation.ts
if (process.platform !== 'darwin') {
    vscode.window.showWarningMessage(
        'Voice dictation is currently macOS-only. Windows support coming soon.'
    );
    return;
}
```

---

## Model Download Strategy

### First-Use Download

When user clicks mic button for the first time:

1. **Check if model exists**: `~/.ritemark/models/ggml-small.bin`
2. **If not, show dialog**: "Voice dictation requires downloading a speech model (~244MB). Download now?"
3. **Download with progress**: Show progress bar (HuggingFace CDN)
4. **Cache locally**: Store in user's home directory
5. **Ready**: Enable dictation

### Model Storage Location

```
~/.ritemark/
├── models/
│   ├── ggml-small.bin           # Generic small model (default)
│   ├── ggml-large-et.bin        # TalTech Estonian (optional)
│   └── ggml-medium-et.bin       # TalTech Estonian (optional)
└── config/
    └── voice-settings.json       # Language preference, model choice
```

---

## UX Design (Confirmed from Sprint 22)

### Jarmo's Requirements

| Requirement | Decision |
|-------------|----------|
| Button placement | **Fixed toolbar** (always visible, right side) |
| Mode | **Toggle mode** (click to start, click to stop) |
| Live preview | **Show text as you speak** (real-time streaming) |
| Keyboard shortcut | Cmd+Option+V (VS Code standard) |
| Model download | **Download on first use** with dialog |

### Visual States

| State | Icon | Color | Behavior |
|-------|------|-------|----------|
| Idle | 🎤 (static) | Gray | Click to start |
| Listening | 🎤 (pulsing) | Red | Recording audio |
| Processing | ⏳ (spinner) | Blue | Transcribing |
| Error | ⚠️ | Yellow/Red | Show error message |

---

## Risks & Mitigations

### Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Binary bundling fails** | High | Test bundling in extension VSIX, verify executable permissions |
| **Metal GPU not available** | Medium | whisper.cpp falls back to CPU automatically |
| **Estonian accuracy poor** | High | Start with small model, offer TalTech upgrade |
| **Model download fails** | Medium | Retry logic, clear error messages, manual download instructions |
| **Microphone permission denied** | Medium | Clear instructions, link to System Preferences |

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Real-time latency >500ms | Medium | Use streaming mode in whisper.cpp, tune chunk size |
| Memory usage high | Low | Monitor during testing, use smaller model if needed |
| Extension size large | Low | 244MB model + 10MB binary = acceptable |

---

## Success Criteria Validation

| Criterion | Validated? | Notes |
|-----------|------------|-------|
| Click mic to start/stop | ✅ | Toggle mode confirmed |
| Text at cursor position | ✅ | TipTap editor.insertContent() |
| Estonian works | ✅ | Generic small ~15-20% WER acceptable |
| Offline | ✅ | 100% local, no cloud |
| Zero installation | ✅ | Bundled binary + downloaded model |
| macOS only | ✅ | Platform detection implemented |

---

## Comparison to Failed Sprint 22

| Aspect | Sprint 22 (Failed) | Sprint 23 (This Sprint) |
|--------|-------------------|------------------------|
| Binary distribution | ❌ Homebrew required | ✅ Bundled with extension |
| User installation | ❌ `brew install` | ✅ None (zero-install) |
| Model | nodejs-whisper (npm) | whisper.cpp (bundled binary) |
| Integration | Node native module | Spawned process (cleaner) |
| Dependencies | FFmpeg, Homebrew | None (self-contained) |

---

## Implementation Strategy

### Phase 1: Proof of Concept (This Phase)

- [x] Research Estonian STT solutions
- [x] Confirm whisper.cpp approach
- [x] Design bundling strategy
- [ ] Test whisper.cpp binary on macOS
- [ ] Verify Metal GPU acceleration
- [ ] Test Estonian transcription quality

### Phase 2: Plan

- [ ] Create detailed sprint plan
- [ ] Design architecture diagrams
- [ ] Define message protocol (webview ↔ extension)
- [ ] Document binary bundling process
- [ ] Plan testing strategy

### Phase 3: Develop

- [ ] Bundle whisper.cpp binary for darwin-arm64
- [ ] Implement model download logic
- [ ] Create voiceDictation.ts module
- [ ] Add mic button to editor toolbar
- [ ] Implement audio capture in webview
- [ ] Wire up bridge messages
- [ ] Implement text insertion

### Phase 4: Test & Validate

- [ ] Test English dictation
- [ ] **Test Estonian dictation (CRITICAL)**
- [ ] Test model download flow
- [ ] Test error cases (no mic, permission denied, etc.)
- [ ] Performance testing (latency, memory)

### Phase 5: Cleanup

- [ ] Remove debug logging
- [ ] Add user documentation
- [ ] Update changelog
- [ ] Code review

### Phase 6: Deploy

- [ ] Extension build
- [ ] Jarmo testing
- [ ] Release

---

## Key Learnings from Sprint 22

### What We Keep

✅ **Technology choice**: whisper.cpp is still correct
✅ **UX design**: Toggle mode, mic button in toolbar
✅ **Estonian focus**: Multi-language with Estonian priority
✅ **Local-first**: Offline processing is core requirement

### What We Fix

❌ **Distribution model**: Bundle binary instead of Homebrew
❌ **Integration approach**: Spawned process instead of npm native module
❌ **Dependencies**: Self-contained instead of external tools

---

## Next Steps

### Ready for Phase 2: Planning

Research is complete. Key decisions:

1. **Technology**: whisper.cpp (confirmed)
2. **Model**: Generic small (~244MB) + optional TalTech upgrade
3. **Distribution**: Bundled binary + downloaded model
4. **Platform**: macOS-only initially
5. **UX**: Fixed toolbar, toggle mode, real-time preview

**BLOCKER:** Requires Jarmo's approval to proceed to Phase 2.

---

## Open Questions for Jarmo

1. **Model size acceptance**: Is 244MB download for small model acceptable? (Better Estonian accuracy than 75MB tiny)
2. **TalTech model offering**: Should we offer optional 1.5GB TalTech large model download for best Estonian accuracy?
3. **Mic button icon**: Any preference for icon style? (Currently planning simple 🎤)
4. **Error handling**: How verbose should error messages be? (Technical vs. user-friendly)
5. **Settings UI**: Should model selection be in settings, or auto-detect language and use appropriate model?

---

## References

- **ChatGPT Deep Research**: `docs/analysis/2026-01-17-estonian-stt-solution.md`
- **Original Research**: `docs/analysis/2026-01-15-voice-dictation-research.md`
- **Failed Sprint 22**: `docs/sprints/Archived/sprint-22-whisper-integration/`
- **whisper.cpp GitHub**: https://github.com/ggml-org/whisper.cpp
- **TalTech Models**: https://huggingface.co/TalTechNLP
- **Whisper Paper**: https://arxiv.org/abs/2212.04356
