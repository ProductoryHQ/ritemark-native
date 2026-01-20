# Voice Dictation UX Design

**Date:** 2025-01-19  
**Status:** DRAFT - Awaiting Jarmo approval

* * *

## Current Problem

User clicks mic, speaks, but doesn't know what's happening. Text only appears when dictation is stopped.

**User feedback:** "I can see Listening and Processing but no text appearing - only when I turn off the dictation from header button"

* * *

## Research Summary

From web research on whisper.cpp optimal chunk sizes:

| Chunk Size | Accuracy | Hallucination Risk | User Experience |
| --- | --- | --- | --- |
| 1-2 seconds | Lower | HIGH | Feels "real-time" |
| 5 seconds | Good | Low | Delayed feedback |
| 10-30 seconds | Best | Lowest | Long wait |

**Key insight:** Whisper pads all audio to 30 seconds internally. Very short chunks (1-2s) cause hallucinations because the model gets confused by the padding.

**Recommendation:** Keep 5-second chunks for accuracy, improve UX feedback.

* * *

## UX Options

### Option A: Incremental Text (Pseudo-Streaming)

```plaintext
[Click mic]
→ "" appears at cursor

[After 5 seconds]
→ "" briefly
→ "Hello my name" inserted
→ "" appears again

[After 5 more seconds]
→ "" briefly
→ "is Jarmo and I" appended
→ "" appears again

[Click mic to stop]
→ Final chunk processed
→ "am testing voice" appended
→ Placeholder removed
```

**Pros:**

-   User sees progress
    
-   Feels responsive
    
-   Can stop early if seeing errors
    

**Cons:**

-   5-second delay per chunk
    
-   Possible word boundary issues (cutting mid-sentence)
    
-   Multiple undo steps needed to fix
    

* * *

### Option B: Batch at End

```plaintext
[Click mic]
→ "" appears at cursor
→ Stays showing while user speaks

[Click mic to stop]
→ "" appears
→ All text inserted at once: "Hello my name is Jarmo and I am testing voice"
→ Placeholder removed
```

**Pros:**

-   Single transcription = better context = better accuracy
    
-   Simpler undo (one action)
    
-   No word boundary issues
    

**Cons:**

-   User doesn't see progress until the end
    
-   No feedback that audio is being captured
    
-   If recording was bad, user only finds out at the end
    

* * *

### Option C: Batch + Audio Level Feedback (RECOMMENDED)

```plaintext
[Click mic]
→ "" appears at cursor
→ Mic button shows audio level animation (pulsing/bars)
→ User can see their voice is being captured

[While speaking]
→ "" stays in editor
→ Mic button pulses with voice level
→ Small "5s | 10s | 15s" timer or chunk count indicator

[Click mic to stop]
→ "" replaces "Listening..."
→ After ~2 seconds: all text inserted
→ Placeholder removed
```

**Pros:**

-   User knows audio is being captured (via visual feedback on button)
    
-   Single transcription = best accuracy
    
-   Simple undo
    
-   Clear state machine
    

**Cons:**

-   Longer wait for result
    
-   Need to implement audio level visualization
    

* * *

## Recommended UX Flow

### State Machine

```plaintext
[IDLE]
    │
    │ User clicks mic
    ▼
[PREPARING] ──── "Checking model..."
    │           (only first time or if model missing)
    │
    │ Model ready
    ▼
[LISTENING] ──── "" in editor
    │           Mic button: animated/pulsing
    │           Audio being captured
    │
    │ User clicks mic to stop
    ▼
[PROCESSING] ── "" in editor
    │           Mic button: spinner/loading
    │           Whisper transcribing
    │
    │ Transcription complete
    ▼
[INSERTING] ─── Remove placeholder
    │           Insert transcribed text
    │
    │ Done
    ▼
[IDLE]
```

### Visual States

| State | Editor | Mic Button | Header |
| --- | --- | --- | --- |
| IDLE | (normal) | 🎤 grey | Ready |
| PREPARING | (normal) | ⏳ spinner | Preparing... |
| LISTENING | "" italic grey | 🔴 pulsing red | Recording... |
| PROCESSING | "" italic grey | ⏳ spinner | Processing... |
| INSERTING | (text appears) | ✓ brief green | Done |

### Mic Button Behavior

1.  **Idle state:** Grey microphone icon
    
2.  **Listening state:** Red pulsing indicator (like a recording light)
    
3.  **Processing state:** Spinner animation
    
4.  **Success flash:** Brief green checkmark (200ms)
    

### Audio Level Indicator (Nice to Have)

While listening, show audio level bars or a pulse that responds to voice:

-   Silent: Small pulse
    
-   Talking: Larger pulse / bars moving
    

This reassures user that mic is capturing their voice.

* * *

## Implementation Plan

### Phase 1: Fix Current Bug (Immediate)

1.  Ensure transcription text appears immediately when received (not batched to end)
    
2.  Remove placeholder → insert text → re-show "Listening..." if still active
    

### Phase 2: Batch Mode (This Sprint)

1.  Switch to batch mode: collect ALL audio, transcribe at end
    
2.  Only process when user clicks to stop
    
3.  Remove incremental 5-second chunk sending
    

### Phase 3: Visual Feedback (Future)

1.  Add audio level indicator to mic button
    
2.  Add recording timer
    
3.  Add success/error visual feedback
    

* * *

## Questions for Jarmo

1.  **Incremental vs Batch?**
    
    -   Option A: See text every 5 seconds (current attempt)
        
    -   Option B/C: See all text at end (better accuracy)
        
2.  **Is audio level indicator important?**
    
    -   Yes: Add pulsing/bars to mic button
        
    -   No: Keep simple, just color change
        
3.  **Maximum recording length?**
    
    -   Unlimited?
        
    -   60 seconds?
        
    -   5 minutes?
        
    -   Should show warning approaching limit?
        

* * *

## Decision Log

| Decision | Choice | Rationale |
| --- | --- | --- |
| Chunk size | 5 seconds | Research shows best accuracy/hallucination tradeoff |
| Streaming | **Option A - Incremental** | Jarmo: "closer to real time the better" |
| Audio level indicator | No | Not needed |
| Max recording time | No limit | Not needed |

**Jarmo decisions (2025-01-19):**

1.  Option A (incremental text every 5s) - closer to real-time is better
    
2.  No audio level animation needed
    
3.  No max recording time limitKõik!Kõik!