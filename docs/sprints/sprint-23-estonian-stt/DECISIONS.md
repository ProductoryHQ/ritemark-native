# Sprint 23 Design Decisions

**Date**: 2026-01-17
**Status**: All decisions finalized, awaiting Jarmo's approval to proceed to Phase 3

---

## Open Questions RESOLVED

All design questions have been answered by Jarmo:

### 1. Binary Bundling Strategy
**Question**: Bundle whisper.cpp binary or require user to brew install?
**Decision**: ✅ **Bundle binary with extension (~5-10MB)**
- Zero installation required
- Self-contained distribution
- Aligns with RiteMark philosophy

### 2. Model Download Timing
**Question**: Bundle model or download on first use?
**Decision**: ✅ **Download on first mic click**
- Model size: 244MB (acceptable)
- Show progress dialog during download
- Reduces initial extension size

### 3. TalTech Large Model Option
**Question**: Offer TalTech large-et model as optional download?
**Decision**: ✅ **DO NOT OFFER - Keep it simple**
- Only one model option for MVP
- Avoids choice paralysis
- Can be revisited in future sprint if needed

### 4. Mic Button Icon
**Question**: Which icon library to use?
**Decision**: ✅ **Lucide icons (lucide-react)**
- Project already uses Lucide
- Icons to use:
  - Idle/Listening: `Mic` or `Mic2`
  - Processing: `Loader2`
  - Error: `AlertTriangle`

### 5. Button Placement
**Question**: Where to place mic button?
**Decision**: ✅ **Fixed top toolbar (non-negotiable)**
- Always visible
- Consistent with other toolbar items
- Easy to access

### 6. Error Message Style
**Question**: Technical or user-friendly errors?
**Decision**: ✅ **User-friendly messages**
- No technical jargon
- Clear actionable guidance
- Example: "Microphone not available" not "navigator.mediaDevices.getUserMedia() rejected"

### 7. Model Selection
**Question**: Where to configure model?
**Decision**: ✅ **Settings panel**
- (Currently only one model, but allows for future expansion)

---

## Technical Implementation Summary

Based on these decisions, the implementation will:

1. **Bundle whisper.cpp binary** in `extensions/ritemark/binaries/darwin-arm64/`
2. **Download ggml-small.bin** (244MB) on first mic button click
3. **Use Lucide icons** for UI states
4. **Place button** in fixed top toolbar
5. **Show user-friendly errors** throughout
6. **Store model** in `~/.ritemark/models/`
7. **Support macOS only** initially (Windows gracefully disabled)

---

## Ready for Approval

All design decisions are now locked in. Sprint plan is complete and ready for Phase 2→3 approval.

**Next Step**: Jarmo reviews and approves with "approved" to proceed to implementation.
