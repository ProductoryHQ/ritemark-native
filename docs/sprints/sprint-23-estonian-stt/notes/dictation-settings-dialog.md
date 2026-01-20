# Dictation Settings Dialog

**Date:** 2025-01-20
**Status:** Planning
**Sprint:** 23 - Estonian STT
**Parent:** Voice Dictation Feature

---

## Overview

Add a Settings option to the language dropdown menu that opens a Dictation Settings dialog. This allows users to configure voice dictation behavior and manage downloaded models.

## Entry Point

Location: Language dropdown in document header (same dropdown as language selection)

```
+---------------------------+
| LANGUAGE                  |
|---------------------------|
| Estonian              ET  |
| English               EN  |
|---------------------------|
| More languages...         |
| Settings...           ⚙   |  <-- NEW
+---------------------------+
```

## Settings Dialog Design

```
+-----------------------------------------------+
|  Dictation Settings                       [X] |
+-----------------------------------------------+
|                                               |
|  MODEL                                        |
|  ┌─────────────────────────────────────────┐  |
|  │ large-v3-turbo (1.5 GB)      [Remove]   │  |
|  │ ✓ Downloaded                            │  |
|  └─────────────────────────────────────────┘  |
|                                               |
|  ─────────────────────────────────────────    |
|                                               |
|  AUDIO PROCESSING                             |
|                                               |
|  Chunk duration                               |
|  ┌─────────────────────────────────────────┐  |
|  │ [3 sec] [5 sec] [10 sec]                │  |
|  │  ○        ●        ○                    │  |
|  └─────────────────────────────────────────┘  |
|  Longer = better accuracy, slower feedback    |
|                                               |
|  [ ] Voice Activity Detection (VAD)           |
|      Only process when speech detected        |
|                                               |
|  [ ] Noise Reduction                          |
|      Filter background noise before           |
|      transcription                            |
|                                               |
+-----------------------------------------------+
|                              [Done]           |
+-----------------------------------------------+
```

## Settings Breakdown

### 1. Model Management

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Model status | Display | Downloaded / Not downloaded | - |
| Download model | Button | Triggers download dialog | - |
| Remove model | Button | Deletes model from disk | - |

**Model path:** `~/.ritemark/models/ggml-large-v3-turbo.bin`

### 2. Chunk Duration

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Chunk duration | Radio/Segmented | 3s, 5s, 10s | 5s |

**Trade-off:**
- **3 sec**: Faster feedback, more hallucinations
- **5 sec**: Balanced (recommended)
- **10 sec**: Best accuracy, slower feedback

### 3. Voice Activity Detection (VAD)

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| VAD enabled | Toggle | On/Off | Off |

**When enabled:**
- Only sends audio chunks that contain speech
- Reduces hallucinations from silence/noise
- Requires: Silero VAD or similar

**Implementation complexity:** Medium (requires VAD library)

### 4. Noise Reduction

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Noise reduction | Toggle | On/Off | Off |

**When enabled:**
- Applies noise gate/filter before transcription
- Helps with background noise (keyboard, fan, etc.)

**Implementation complexity:** Medium (Web Audio API filters)

---

## Storage

Settings stored in localStorage:

```typescript
interface DictationSettings {
  chunkDuration: 3000 | 5000 | 10000  // milliseconds
  vadEnabled: boolean
  noiseReductionEnabled: boolean
}

const STORAGE_KEY = 'ritemark:dictation-settings'
```

## Implementation Tasks (Sprint 23)

### Phase 1: Basic Settings Dialog
- [ ] Add "Settings..." option to language dropdown
- [ ] Create DictationSettingsModal component
- [ ] Implement chunk duration setting (3s/5s/10s radio)
- [ ] Store/retrieve settings from localStorage
- [ ] Wire up chunk duration to useVoiceDictation hook

### Phase 2: Model Management
- [ ] Show current model status (downloaded/not)
- [ ] Show model size
- [ ] Add "Remove model" button with confirmation
- [ ] Refresh UI after model removal

### Phase 3: VAD (Voice Activity Detection)
- [ ] Research VAD options for browser (Silero VAD, WebRTC VAD)
- [ ] Integrate VAD into audio capture pipeline
- [ ] Add VAD toggle to settings
- [ ] Only send chunks when speech detected

### Phase 4: Noise Reduction
- [ ] Implement noise gate using Web Audio API
- [ ] Add noise reduction toggle to settings
- [ ] Test with various background noise scenarios

---

## UI Components Needed

1. **DictationSettingsModal.tsx** - Main settings dialog
2. **SegmentedControl.tsx** - For chunk duration selection (or reuse existing)
3. Update **LanguagePickerModal.tsx** - Add Settings entry

## Messages to Extension

```typescript
// Get model status
sendToExtension('dictation:getModelStatus', {})
// Response: { downloaded: boolean, sizeBytes: number, path: string }

// Remove model
sendToExtension('dictation:removeModel', {})
// Response: { success: boolean }
```

---

## Decisions (Jarmo 2025-01-20)

1. **Default chunk duration:** 3 sec (keep current) ✓
2. **VAD:** Yes, implement in Sprint 23 ✓
3. **Noise Reduction:** Yes, implement in Sprint 23 ✓

**Scope:** Full implementation including VAD and Noise Reduction

---

## References

- Current language picker: `extensions/ritemark/webview/src/components/LanguagePickerModal.tsx`
- Voice dictation hook: `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts`
- Dictation controller: `extensions/ritemark/src/voiceDictation/controller.ts`
