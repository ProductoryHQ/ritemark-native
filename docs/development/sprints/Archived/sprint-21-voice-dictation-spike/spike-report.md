# Sprint 21: Voice Dictation Spike Report

**Date:** 2026-01-17
**Status:** Complete
**Result:** BLOCKER - VS Code Speech does not support Estonian

---

## Executive Summary

The spike aimed to test VS Code Speech extension compatibility with Ritemark. However, the **first check revealed a blocker**: VS Code Speech does not support Estonian, which is a MUST requirement.

**Recommendation:** Skip VS Code Speech → Proceed to whisper.cpp implementation.

---

## Findings

### 1. Estonian Language Support

| Solution | Estonian | Notes |
|----------|----------|-------|
| VS Code Speech | ❌ No | Only 26 major languages |
| OpenAI Whisper / whisper.cpp | ✅ Yes | 99 languages including Estonian |

### 2. VS Code Speech Supported Languages

From marketplace language packs found:
- English (US, UK, Ireland)
- German (de-de)
- French (fr-fr)
- Spanish (es-es, es-mx)
- Japanese (ja-jp)
- Chinese (zh-cn, zh-tw)
- ~16 other major languages

**No Baltic languages (Estonian, Latvian, Lithuanian) are supported.**

### 3. Whisper Language Support

OpenAI Whisper supports 99 languages including:
- Estonian ✅
- Finnish ✅
- Latvian ✅
- Lithuanian ✅
- All major European languages

Source: [Whisper API Languages](https://whisper-api.com/docs/languages/)

---

## Decision

Per sprint plan decision flow:

```
Check Estonian support in VS Code Speech
         │
    ┌────┴────┐
    │ Yes     │ No ← WE ARE HERE
    ▼         ▼
Full test   Skip to whisper.cpp ← RECOMMENDED
```

**No further testing of VS Code Speech required** - the Estonian requirement is non-negotiable.

---

## Next Steps

### Recommended: Sprint 22 - whisper.cpp Integration

Build voice dictation using whisper.cpp with:
- Multi-language support (Estonian + others)
- Toggle mode UI (mic button in toolbar)
- Local/offline processing
- macOS first (with platform detection)

### Technical Approach

```
Ritemark Extension (TypeScript)
        │
        ▼
    whisper-node (npm package)
        │
        ▼
    whisper.cpp (native addon)
        │
        ▼
    CPU / Metal acceleration
```

### Model Selection

| Model | Size | Languages | Recommendation |
|-------|------|-----------|----------------|
| tiny | ~75MB | English only | ❌ |
| tiny multilingual | ~75MB | 99 languages | ✅ Start here |
| base multilingual | ~150MB | 99 languages | Consider if quality insufficient |
| small multilingual | ~500MB | 99 languages | Best quality, larger download |

---

## Sources

- [VS Code Speech Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-speech)
- [VS Code Voice Documentation](https://code.visualstudio.com/docs/configure/accessibility/voice)
- [Whisper Supported Languages](https://whisper-api.com/docs/languages/)
- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)

---

## Approval Required

- [ ] Jarmo approves proceeding to whisper.cpp sprint
