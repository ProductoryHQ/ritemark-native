# Voice Dictation Spike - Research Summary

**Date:** 2026-01-17
**Sprint:** 01 - Voice Dictation Spike
**Phase:** 1 (Research)

---

## Background

Based on the comprehensive research document at `/docs/analysis/2026-01-15-voice-dictation-research.md`, we are taking a phased approach to adding voice dictation to Ritemark.

### Key Findings from Research

1. **User Need:** Voice dictation enables faster capture (150 WPM speaking vs 40 WPM typing)
2. **Privacy Requirement:** Must be local-first, no cloud processing
3. **Target Users:** Knowledge workers, writers, accessibility users
4. **Must-Have Features:** Local processing, real-time transcription, <500ms latency, offline capability

### Solution Options Identified

| Solution | Pros | Cons | Status |
|----------|------|------|--------|
| VS Code Speech Extension | Already exists, maintained by Microsoft, 26 languages | May not work in webview | **TESTING IN THIS SPIKE** |
| whisper.cpp | Cross-platform, Node.js bindings | Requires compilation, slower than CoreML | Fallback option |
| WhisperKit (Swift/CoreML) | Fast, optimized for Apple Silicon | macOS-only, requires native bridge | Future enhancement |
| macOS Speech Framework | Built-in, no downloads | Less accurate, limited languages | Backup option |

---

## This Spike's Objective

**Question:** Does the VS Code Speech extension work in Ritemark Native's webview editor?

### Why Start Here?

1. **Lowest effort:** Extension already exists and works in standard VS Code
2. **Immediate answer:** Quick test reveals compatibility
3. **Informs next steps:** Whether we bundle, adapt, or build custom solution
4. **Risk mitigation:** Validates extension system works in our fork

### Expected Outcomes

| Scenario | Result | Next Step |
|----------|--------|-----------|
| ✅ Works perfectly | Bundle extension or recommend installation | Add to product (low effort) |
| ⚠️ Partially works | Document what breaks | Fork and adapt extension |
| ❌ Doesn't work | Root cause analysis | Proceed to whisper.cpp integration sprint |

---

## Test Plan

### 1. Extension Installation Test
- [ ] Install VS Code Speech extension in Ritemark Native
- [ ] Verify extension loads without errors
- [ ] Check if extension appears in Extensions panel

### 2. Basic Functionality Test
- [ ] Test dictation in standard markdown file (not webview)
- [ ] Verify keyboard shortcut works (⌥⌘V)
- [ ] Check microphone permissions flow

### 3. Ritemark Webview Test (CRITICAL)
- [ ] Open markdown file in Ritemark editor (webview)
- [ ] Attempt to activate dictation (⌥⌘V)
- [ ] Verify if transcribed text appears in TipTap editor
- [ ] Test cursor positioning and text insertion

### 4. Edge Cases
- [ ] Test with no microphone permission
- [ ] Test during model download (first-time setup)
- [ ] Test in split editor mode
- [ ] Test with multiple markdown files open

### 5. Documentation
- [ ] Screenshot each test scenario
- [ ] Note any console errors
- [ ] Document performance (latency, accuracy)
- [ ] Record user experience observations

---

## Decision Criteria

After testing, we make a recommendation based on:

| Criterion | Weight | Pass/Fail |
|-----------|--------|-----------|
| Works in Ritemark webview | Critical | Must pass |
| Transcription accuracy | High | >95% accuracy |
| Latency | High | <500ms speech-to-text |
| Setup friction | Medium | <1 minute first-time setup |
| Keyboard shortcuts work | Medium | ⌥⌘V activates dictation |

**If 2+ critical/high criteria fail → Proceed to whisper.cpp integration sprint**

---

## Success Metrics for Spike

- [ ] All 5 test categories completed
- [ ] Clear compatibility status documented (works/partial/doesn't work)
- [ ] Root cause identified if failures occur
- [ ] Recommendation made with confidence level (high/medium/low)
- [ ] Effort estimate provided for recommended path

---

## Technical Notes

### VS Code Speech Extension Details

- **Extension ID:** `ms-vscode.vscode-speech`
- **Languages:** 26 supported (English, Spanish, French, German, etc.)
- **Activation:** Keyboard shortcut (⌥⌘V on macOS)
- **Mode:** Push-to-talk and toggle modes supported
- **Local Processing:** Uses OS-level speech recognition (offline-capable)

### Ritemark Context

- **Editor:** TipTap (ProseMirror-based) in webview
- **Integration:** Custom Editor Provider for .md files
- **Command Passing:** VS Code commands need to cross webview boundary
- **Potential Blocker:** Extension may not detect webview focus or TipTap editor state

### Key Questions

1. Can VS Code commands reach the webview context?
2. Does the extension's text insertion work with TipTap?
3. Are microphone permissions handled by Ritemark or extension?
4. Does the extension respect Ritemark's custom editor context?

---

## Next Steps After Spike

### If Extension Works
1. Document installation instructions
2. Consider bundling extension with Ritemark
3. Add voice dictation documentation
4. Gather user feedback

### If Extension Doesn't Work
1. Document root cause
2. Plan whisper.cpp integration sprint
3. Define custom implementation scope
4. Estimate effort for custom solution

---

## References

- Original Research: `/docs/analysis/2026-01-15-voice-dictation-research.md`
- VS Code Speech Extension: https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-speech
- VS Code Voice Support: https://code.visualstudio.com/docs/configure/accessibility/voice
