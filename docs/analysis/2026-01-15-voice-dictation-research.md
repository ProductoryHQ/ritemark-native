# Voice Dictation Research for RiteMark

**Date:** 2026-01-15  
**Status:** Research Complete  
**Author:** Claude (Engineering)

* * *

## Executive Summary

This document explores adding real-time voice dictation to RiteMark, enabling users to dictate notes directly into the markdown editor. The research focuses on local-first solutions that align with RiteMark's offline-first philosophy.

**Key Finding:** WhisperKit (Swift/CoreML) and whisper.cpp are the most promising solutions for local, fast, privacy-preserving voice dictation on macOS.

* * *

## 1\. User Needs Analysis

### Primary Use Cases

| Use Case | Description | Priority |
| --- | --- | --- |
| Quick Capture | Rapidly capture fleeting thoughts before they fade | High |
| Long-form Dictation | Dictate entire documents hands-free | Medium |
| Accessibility | Enable users who have difficulty typing | High |
| Mobile Workflow | Dictate while walking/commuting (future) | Low |

### User Pain Points (Current State)

1.  **Friction in note-taking** - Typing interrupts thought flow
    
2.  **Speed limitation** - Average typing: 40 WPM vs. speaking: 150 WPM
    
3.  **Context switching** - Using external dictation tools breaks workflow
    
4.  **Privacy concerns** - Cloud-based dictation sends audio to external servers
    

### Target User Profiles

| Profile | Needs | Constraints |
| --- | --- | --- |
| Knowledge Workers | Fast capture, accurate transcription | May work offline, privacy-conscious |
| Writers | Long-form dictation, minimal editing | Need punctuation handling |
| Accessibility Users | Reliable, low-latency recognition | Must work consistently |
| Power Users | Keyboard shortcuts, customizable | Want control over when dictation is active |

### Requirements Matrix

| Requirement | Must Have | Nice to Have |
| --- | --- | --- |
| Local processing (no cloud) | ✅ |  |
| Real-time transcription | ✅ |  |
| Low latency (<500ms) | ✅ |  |
| Works offline | ✅ |  |
| Punctuation handling |  | ✅ |
| Multiple language support |  | ✅ |
| Voice commands (formatting) |  | ✅ |
| Continuous dictation mode | ✅ |  |

* * *

## 2\. User Experience Design

### Interaction Patterns

#### 2.1 Activation Methods

| Method | Description | Pros | Cons |
| --- | --- | --- | --- |
| **Keyboard Shortcut** | e.g., `⌥⌘V` (VS Code standard) | Fast, familiar | Requires keyboard |
| **Push-to-Talk** | Hold key to dictate, release to stop | Clear boundaries | Can't multitask |
| **Toggle Mode** | Click to start, click to stop | Hands-free after activation | May forget to stop |
| **Voice Activation** | "Hey RiteMark, start dictating" | Fully hands-free | False positives, always listening |

**Recommendation:** Keyboard shortcut with push-to-talk option (matches VS Code Speech extension pattern).

#### 2.2 Visual Feedback

```plaintext
┌─────────────────────────────────────────────────┐
│  Editor                                         │
│                                                 │
│  The quick brown fox jumps over...              │
│                                    ▌            │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 🎤 Listening...  "the lazy dog"         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

Essential feedback elements:

-   **Microphone indicator** - Shows dictation is active
    
-   **Live transcription preview** - Shows what's being recognized
    
-   **Confidence indicator** - Subtle visual for uncertain words
    
-   **Audio level meter** - Confirms microphone is picking up sound
    

#### 2.3 Error Handling

| Situation | User Feedback | Action |
| --- | --- | --- |
| No microphone | "No microphone detected. Check System Preferences." | Open settings link |
| Permission denied | "Microphone access required. Click to enable." | Request permission |
| Model not loaded | "Loading speech model... (first time only)" | Show progress |
| Recognition failed | "Couldn't understand. Try again." | Keep cursor position |

#### 2.4 Dictation Flow

```plaintext
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Idle    │────▶│ Listening│────▶│Processing│────▶│ Inserted │
│          │     │          │     │          │     │          │
│ ⌥⌘V to   │     │ Speaking │     │ Brief    │     │ Text in  │
│ start    │     │ detected │     │ delay    │     │ editor   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      ▲                                                  │
      └──────────────────────────────────────────────────┘
                    Continue or ESC to stop
```

### UX Best Practices

1.  **Keep it simple** - Single keyboard shortcut to toggle
    
2.  **Provide clear feedback** - Always show when listening
    
3.  **Fail gracefully** - Never lose user's existing text
    
4.  **Respect context** - Insert at cursor, don't replace selection (unless intended)
    
5.  **Support undo** - Cmd+Z should undo dictated text as a single unit
    

### Punctuation Handling Options

| Approach | Example | Complexity |
| --- | --- | --- |
| Spoken punctuation | User says "period", "comma" | Low |
| Auto-punctuation | AI infers from pauses/tone | High |
| Post-processing | AI adds punctuation after | Medium |

**Recommendation:** Start with spoken punctuation ("period", "comma", "new paragraph"), consider AI auto-punctuation as enhancement.

* * *

## 3\. Technical Solutions

### 3.1 Solution Comparison Matrix

| Solution | Local | Speed | Accuracy | Integration | Maintenance |
| --- | --- | --- | --- | --- | --- |
| **WhisperKit (Swift)** | ✅ | Fast (CoreML) | High | Native macOS | Low |
| **whisper.cpp** | ✅ | Medium | High | Node.js addon | Medium |
| **macOS Speech Framework** | ✅ | Fast | Good | Native API | Low |
| **Web Speech API** | ❌\* | Fast | Good | Browser native | Low |
| **VS Code Speech Extension** | ✅ | Fast | Good | Already exists | None |

\*Web Speech API sends audio to cloud in most browsers

### 3.2 Detailed Solution Analysis

#### Option A: WhisperKit (Swift/CoreML)

**Description:** Native Swift package for on-device Whisper inference using Apple's CoreML, optimized for Apple Silicon.

**Pros:**

-   Optimized for Apple Silicon (M1/M2/M3)
    
-   Very fast inference (CoreML acceleration)
    
-   High accuracy (2.44% WER on LibriSpeech)
    
-   Supports real-time streaming
    
-   Active development (v0.15.0, 765K downloads/month)
    

**Cons:**

-   Requires Swift/native code integration
    
-   macOS 14+ required
    
-   Would need Node.js ↔ Swift bridge
    

**Integration Approach:**

```plaintext
RiteMark Extension (TypeScript)
        │
        ▼
    VS Code API (spawn process)
        │
        ▼
    WhisperKit CLI / Local Server
        │
        ▼
    CoreML (Apple Neural Engine)
```

**Model Sizes:**

| Model | Size | Speed | Accuracy |
| --- | --- | --- | --- |
| tiny.en | ~75MB | Fastest | Good |
| base.en | ~150MB | Fast | Better |
| small.en | ~500MB | Medium | High |

#### Option B: whisper.cpp

**Description:** C++ port of OpenAI's Whisper, works on CPU with optional GPU acceleration.

**Pros:**

-   Cross-platform (macOS, Windows, Linux)
    
-   Node.js bindings available (whisper-node)
    
-   Very active community
    
-   Supports WASM (browser execution)
    
-   Voice Activity Detection (VAD) built-in
    

**Cons:**

-   Requires compilation (FFmpeg dependency)
    
-   Slightly slower than CoreML on Apple Silicon
    
-   More complex setup
    

**Integration Approach:**

```plaintext
RiteMark Extension (TypeScript)
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

#### Option C: macOS Speech Framework

**Description:** Apple's native Speech framework for on-device recognition.

**Pros:**

-   Built into macOS, no downloads
    
-   Fast, well-optimized
    
-   Privacy-friendly
    
-   Simple API
    

**Cons:**

-   Less accurate than Whisper
    
-   Limited language support with on-device mode
    
-   Less customizable
    
-   May conflict with system dictation
    

**Integration Approach:**

```plaintext
RiteMark Extension (TypeScript)
        │
        ▼
    Native Node module (node-ffi / Neon)
        │
        ▼
    Speech.framework
```

#### Option D: Leverage VS Code Speech Extension

**Description:** Microsoft's official speech extension already provides local dictation.

**Pros:**

-   Already works in VS Code
    
-   Maintained by Microsoft
    
-   Keyboard shortcuts defined
    
-   26 languages supported
    

**Cons:**

-   May not work in RiteMark webview context
    
-   Less control over UX
    
-   Dependent on Microsoft updates
    

**Integration Approach:**

-   Test if extension works in RiteMark fork
    
-   If yes, bundle or recommend installation
    
-   If no, fork and adapt
    

### 3.3 Implementation Complexity

| Solution | Dev Time | Risk | Dependencies |
| --- | --- | --- | --- |
| VS Code Speech (test/adapt) | Low | Low | Extension system |
| macOS Speech Framework | Medium | Low | Native bridge |
| whisper.cpp | Medium | Medium | whisper-node, FFmpeg |
| WhisperKit | High | Medium | Swift toolchain |

* * *

## 4\. Recommendations

### Primary Recommendation: Phased Approach

#### Phase 1: Evaluate VS Code Speech Extension

-   Test if VS Code Speech extension works in RiteMark
    
-   Minimal effort, immediate result if successful
    
-   Fallback: understand what breaks, inform Phase 2
    

#### Phase 2: whisper.cpp Integration

-   Use whisper-node npm package
    
-   Bundle tiny.en model (~75MB) for fast startup
    
-   Implement push-to-talk with keyboard shortcut
    
-   Add visual feedback in editor
    

#### Phase 3: Native Enhancement (Optional)

-   Consider WhisperKit if performance is insufficient
    
-   Or macOS Speech Framework for smaller footprint
    

### Technical Architecture

```plaintext
┌─────────────────────────────────────────────────────────┐
│                    RiteMark Extension                   │
├─────────────────────────────────────────────────────────┤
│  Voice Dictation Module                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Audio       │  │ Speech      │  │ Text            │ │
│  │ Capture     │──│ Recognition │──│ Insertion       │ │
│  │ (Web Audio) │  │ (whisper)   │  │ (TipTap)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  UI Components                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Status      │  │ Transcript  │  │ Settings        │ │
│  │ Indicator   │  │ Preview     │  │ Panel           │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Success Metrics

| Metric | Target |
| --- | --- |
| Latency (speech to text) | < 500ms |
| Word Error Rate | < 5% |
| First-use setup time | < 30 seconds |
| Model download size | < 100MB |
| Memory usage | < 500MB during dictation |

* * *

## 5\. Open Questions for Jarmo

1.  **Priority:** Is voice dictation a near-term priority or future consideration?
    
    1.  A: Immediate
        
2.  **Scope:** Should we support only macOS initially, or plan for cross-platform?
    
    1.  Inititally Mac (so add Mac detection to code), Win in future
        
3.  **Model size:** Is ~75MB download acceptable for the "tiny" model?
    
    1.  Totally - dont worry about the size
        
4.  **UX preference:** Push-to-talk or toggle mode for dictation?
    
    1.  Toggle
        
5.  **Language:** English-only initially, or multi-language from start?
    
    1.  Immediatey multi-lang - Estonian lang is MUST!
        

* * *

## 6\. Next Steps

If proceeding:

1.  **Spike: VS Code Speech Extension** - Test compatibility with RiteMark fork
    
2.  **Prototype: whisper.cpp** - Build minimal working demo with whisper-node
    
3.  **UX Design** - Create mockups for dictation UI in RiteMark
    
4.  **Sprint Planning** - Define scope for MVP implementation
    

* * *

## Sources

### Speech Recognition Technologies

-   [whisper.cpp - GitHub](https://github.com/ggml-org/whisper.cpp)
    
-   [WhisperKit - GitHub](https://github.com/argmaxinc/WhisperKit)
    
-   [faster-whisper - GitHub](https://github.com/SYSTRAN/faster-whisper)
    
-   [VS Code Speech Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-speech)
    
-   [VS Code Voice Support Documentation](https://code.visualstudio.com/docs/configure/accessibility/voice)
    

### macOS Local Solutions

-   [VoiceInk - Mac Voice Recognition](https://tryvoiceink.com/)
    
-   [MacWhisper](https://goodsnooze.gumroad.com/l/macwhisper)
    
-   [Handy - Open Source Speech-to-Text](https://github.com/cjpais/Handy)
    
-   [hear - macOS CLI](https://github.com/sveinbjornt/hear)
    
-   [Apple Speech Framework](https://developer.apple.com/documentation/speech)
    

### Node.js/Electron Integration

-   [Offline Speech Recognition with Whisper - AssemblyAI](https://www.assemblyai.com/blog/offline-speech-recognition-whisper-browser-node-js)
    
-   [whisper-node - npm](https://www.npmjs.com/package/whisper-node)
    
-   [electron-voice - GitHub](https://github.com/orthagonal/electron-voice)
    

### UX Design

-   [Voice UX Design - UX Design Institute](https://www.uxdesigninstitute.com/blog/voice-ux-design/)
    
-   [VUI Design Best Practices - Designlab](https://designlab.com/blog/voice-user-interface-design-best-practices)
    
-   [How to Design Voice User Interfaces - IxDF](https://www.interaction-design.org/literature/article/how-to-design-voice-user-interfaces)
    

### Voice Dictation in Note Apps

-   [AI Dictation + Note Apps - Speechify](https://speechify.com/blog/ai-dictation-note-apps-voice-first-second-brain-notion-obsidian-evernote/)
    
-   [Voice Dictation for Notion & Obsidian - Weesper](https://weesperneonflow.ai/en/blog/2025-10-23-voice-dictation-notion-obsidian-productivity-apps-integration/)
    
-   [Best Voice to Notes Apps Guide 2025](https://voicetonotes.ai/blog/best-voice-to-notes-app/)
    

### Web Speech API

-   [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
    
-   [SpeechRecognition - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)