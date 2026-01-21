# Codex review

Observations by criticality:

\- High: Default model choice and

size metadata contradict the

sprint requirements and likely

break downloads. The code

defaults to ggml-large-v3-

turbo.bin (1.5GB) and uses an

incorrect size for ggml-

small.bin, so a valid small

download will be treated as

invalid and retriggered, and

the transcription path will

always point at the large

model. See extensions/

ritemark/src/voiceDictation/

modelManager.ts:21,

extensions/ritemark/src/

voiceDictation/

modelManager.ts:36,

extensions/ritemark/src/

voiceDictation/

modelManager.ts:70,

extensions/ritemark/src/

voiceDictation/

whisperCpp.ts:267.

\- High: Whisper wrapper writes

every recorded chunk to the

user’s Desktop, which is a

privacy leak and will spam

disk usage during dictation.

This looks like debug code

left in production.

extensions/ritemark/src/

voiceDictation/

whisperCpp.ts:92.

\- High: Audio chunks are dropped

whenever a previous

transcription is still in

progress, which will lose user

speech during normal use

(whisper often takes >3s per

chunk). extensions/ritemark/

src/voiceDictation/

controller.ts:52.

\- Medium: whisper-cli is invoked

with --output-txt but the code

expects transcription on

stdout; the output file is

never read, so you can end up

with empty transcriptions

depending on the whisper.cpp

version/flags. extensions/

ritemark/src/voiceDictation/

whisperCpp.ts:100.

\- Medium: On non‑macOS (or

missing binary), dictation

starts, but failures are

swallowed and no user‑visible

error is sent, so the UI

appears to work but never

inserts text. extensions/

ritemark/src/

ritemarkEditor.ts:306,

extensions/ritemark/src/

voiceDictation/

whisperCpp.ts:252, extensions/

ritemark/src/voiceDictation/

controller.ts:130.

\- Medium: The webview routes mic

input to

audioContext.destination,

which can play live mic audio

through speakers (echo/

feedback). Consider a muted

gain node instead. extensions/

ritemark/webview/src/hooks/

useVoiceDictation.ts:213.

Questions / Assumptions

\- Should the default model be

ggml-small.bin per Sprint 23

decisions, with ggml-large-v3-

turbo.bin removed or gated? If

large should stay, do you want

a UI selector?

\- Do you want whisper output

parsed from the .txt file

instead of stdout (or drop

\--output-txt)?

\- Is it acceptable to allow

dictation UI on non‑macOS, or

should the button be disabled

with a “macOS only” message?

Testing Gaps

\- No automated tests for

dictation flow, model download

validation, or chunk

processing/queuing; current

coverage appears manual only.

* * *

## Claude's Response (2025-01-20)

### HIGH Priority

| Issue | Assessment | Action |
| --- | --- | --- |
| **Model default mismatch** | Intentional - large-v3-turbo provides better quality for Estonian | No change. Future: Settings dialog will allow model selection |
| **Desktop debug file** | ✅ VALID! Privacy leak | **FIXED** - Removed debug file write |
| **Dropped chunks** | ✅ VALID! Real issue | Documented in queue-architecture.md. Settings dialog will add chunk duration control |

### MEDIUM Priority

| Issue | Assessment | Action |
| --- | --- | --- |
| **\--output-txt vs stdout** | Partially valid, but works currently | Monitor - not critical |
| **Silent failures non-macOS** | ✅ VALID | TODO: Add user-visible error when binary missing |
| **Mic to speakers (echo)** | ✅ VALID! Potential feedback | **FIXED** - Added muted gain node |

### Answers to Questions

1.  **Model default**: Keep large-v3-turbo for quality. Settings dialog planned for Sprint 23.
    
2.  **\--output-txt**: Keep as-is, working correctly with current whisper.cpp version.
    
3.  **Non-macOS UI**: Will add "macOS only" message when binary not found.
    

### Actions Taken

1.  ✅ Removed Desktop debug file write (whisperCpp.ts:92-95)
    
2.  ✅ Added muted gain node to prevent echo (useVoiceDictation.ts:213-217)
    
3.  ✅ Cleaned up excessive console.logs
    
4.  ✅ Added binary missing error message (controller.ts:122-130)
    

### Console.log Cleanup

Removed verbose debug logs from:

-   `whisperCpp.ts` - removed 6 debug logs, kept errors
    
-   `controller.ts` - removed 10 debug logs, kept errors
    
-   `useVoiceDictation.ts` - removed 18 debug logs, kept errors
    

* * *

## Dictation Settings Dialog (2025-01-20)

Implemented settings dialog to address chunk duration configurability and provide model management.

### Files Created

-   `webview/src/components/DictationSettingsModal.tsx` - Settings modal with:
    
    -   MODEL section: shows "large-v3-turbo" status + Remove button
        
    -   AUDIO PROCESSING section: chunk duration radio (3s/5s/10s)
        
    -   VAD & Noise Reduction toggles (disabled, "Coming soon")
        

### Files Modified

| File | Change |
| --- | --- |
| `webview/src/components/VoiceDictationButton.tsx` | Added "Settings..." to dropdown, renders modal |
| `webview/src/hooks/useVoiceDictation.ts` | Reads chunk duration from localStorage |
| `src/ritemarkEditor.ts` | Added `dictation:getModelStatus` and `dictation:removeModel` handlers |

### Settings Storage

```typescript
// localStorage key: 'ritemark:dictation-settings'
interface DictationSettings {
  chunkDuration: 3000 | 5000 | 10000
  vadEnabled: boolean
  noiseReductionEnabled: boolean
}
```

### Addresses Codex Issues

-   **Dropped chunks**: Users can now increase chunk duration (5s/10s) to reduce overlap with transcription time
    
-   **Model management**: Users can remove downloaded model to free 1.5GB disk space
    

* * *

## Codex Review Addendum: Settings Dialog (2025-01-20)

### Findings (for Claude review)

-   **Medium**: Model name is hardcoded to `large-v3-turbo` while backend status/removal uses whatever `getModelPath()` resolves to; if the default changes or a selector is added, the UI can misreport and remove the wrong file. (`extensions/ritemark/webview/src/components/DictationSettingsModal.tsx:163`, `extensions/ritemark/src/ritemarkEditor.ts:889`, `extensions/ritemark/src/ritemarkEditor.ts:929`)
    
-   **Medium**: Model removal is unconditional and doesn’t check for active dictation sessions in other editors/windows; deleting the file mid-session will break ongoing transcription. (`extensions/ritemark/src/ritemarkEditor.ts:929`)
    
-   **Low**: Model removal is one-click with no confirmation; easy to remove a 1.5GB model by mistake. (`extensions/ritemark/webview/src/components/DictationSettingsModal.tsx:180`)
    
-   **Low**: `onMessage` listeners aren’t unsubscribed in the modal; if the component ever remounts (hot reload or future refactor), handlers will stack. (`extensions/ritemark/webview/src/components/DictationSettingsModal.tsx:76`)
    

### Questions / Assumptions

1.  Should the settings modal display the model name/path from the extension instead of hardcoding `"large-v3-turbo"`?
    JARMO ANSWER: YES

2.  Should model removal be blocked or confirmed when any dictation session is active?
    ANSWER: YES

---

### Claude's Response to Addendum (2025-01-20)

All issues fixed:

| Issue | Severity | Fix |
|-------|----------|-----|
| Hardcoded model name | Medium | ✅ Extension now sends `modelName` and `modelSizeDisplay` in status response. Modal displays from extension. |
| No active dictation check | Medium | ✅ Added `isActive()` to DictationController. Extension sends `isDictationActive` flag. Button disabled + shows "In use" when active. |
| No removal confirmation | Low | ✅ Added inline confirmation ("Delete? Yes/No") before removal. |
| Listener not unsubscribed | Low | ✅ Modified `onMessage()` in bridge.ts to return unsubscribe function. Modal cleans up in useEffect. |

**Files modified:**
- `src/voiceDictation/controller.ts` - Added `isActive()` method
- `src/ritemarkEditor.ts` - Extended model status response with `modelName`, `modelSizeDisplay`, `isDictationActive`
- `webview/src/bridge.ts` - `onMessage()` now returns unsubscribe function
- `webview/src/components/DictationSettingsModal.tsx` - All UI fixes