# Voice Dictation UX Design

**Sprint:** 22 - Voice Dictation
**Date:** 2026-01-17
**Status:** Phase 1 Research

---

## Design Principles

1. **Discoverability** - Mic button should be visible but not intrusive
2. **Clear Feedback** - User always knows dictation state (idle/listening/processing)
3. **No Surprises** - Predictable behavior, text inserted at cursor
4. **Fail Gracefully** - Errors don't lose user's work
5. **Accessible** - Works with keyboard shortcuts and screen readers

---

## Mic Button Placement

### Option A: FormattingBubbleMenu (Context-Sensitive)

**Location:** Appears in bubble menu when text is selected, alongside Bold/Italic/Heading buttons.

**Pros:**
- Consistent with existing formatting controls
- Reduces clutter when not selecting text
- User already familiar with bubble menu pattern

**Cons:**
- Only visible when text is selected (less discoverable)
- User must select text first, then click mic (extra step)
- Toggle state harder to show when menu disappears

**Visual:**
```
Text selection in editor
           ▼
┌──────────────────────────────────────────┐
│ [B] [I] [H1] [H2] [H3] │ [🎤] [Link] [Table] │
└──────────────────────────────────────────┘
```

**Implementation:**
- Add mic button to `FormattingBubbleMenu.tsx` after list buttons
- Use Lucide icon: `<Mic />` (idle) or `<MicOff />` (stopped)
- Show pulsing red circle when listening

---

### Option B: Fixed Editor Toolbar (Always Visible)

**Location:** Fixed position toolbar above editor content, always visible.

**Pros:**
- Always discoverable (no need to select text)
- Can show persistent dictation state
- User can start dictating without selecting anything
- Better for "start from blank page" use case

**Cons:**
- Adds permanent UI element (more clutter)
- Not implemented yet (would need new component)
- Inconsistent with current minimal toolbar approach

**Visual:**
```
┌──────────────────────────────────────────┐
│ Editor Toolbar                     [🎤]  │
├──────────────────────────────────────────┤
│                                          │
│ The quick brown fox... ▌                 │
│                                          │
└──────────────────────────────────────────┘
```

**Implementation:**
- Create new `EditorToolbar.tsx` component
- Position: `position: sticky; top: 0;` in editor
- Render in `Editor.tsx` above `<EditorContent />`

---

### Option C: Document Header (Next to Export/Properties)

**Location:** Add to existing DocumentHeader component (top-right corner).

**Pros:**
- Leverage existing toolbar area
- Consistent with other document-level actions (Export, Properties)
- Always visible without adding new UI element

**Cons:**
- Semantically disconnected (mic is input, not document action)
- User might not look in top-right for text insertion feature
- Harder to show "listening" state in relation to cursor

**Visual:**
```
┌──────────────────────────────────────────┐
│ Document Title          [🎤] [Export] [⚙] │
├──────────────────────────────────────────┤
│                                          │
│ The quick brown fox... ▌                 │
└──────────────────────────────────────────┘
```

**Implementation:**
- Add button to `DocumentHeader.tsx` component
- Use existing header button styles

---

### Recommendation

**Start with Option A (FormattingBubbleMenu)** for Sprint 22:
- Quickest implementation (add to existing component)
- Consistent with existing UI patterns
- Low risk of clutter

**Future consideration (Sprint 23+):**
- If usage data shows high adoption, consider Option B (fixed toolbar)
- User feedback will reveal if discoverability is an issue

**Decision Point for Jarmo (Phase 2):**
- Review mockups of both options
- Test Option A in Sprint 22
- Iterate to Option B if needed based on user testing

---

## Button States

### State 1: Idle (Default)
```
┌──────┐
│  🎤  │  ← Gray mic icon, no animation
└──────┘
```
- **Icon:** `<Mic />` (Lucide)
- **Color:** Gray (#9ca3af)
- **Tooltip:** "Start voice dictation (Cmd+Option+V)"
- **Behavior:** Click to start recording

---

### State 2: Listening (Active Recording)
```
┌──────┐
│  🎤  │  ← Red mic with pulsing animation
└──────┘
   ○○○   ← Audio level indicator (optional)
```
- **Icon:** `<Mic />` (Lucide)
- **Color:** Red (#ef4444) with pulsing glow
- **Animation:** CSS pulse (scale 1.0 → 1.1 → 1.0, repeat)
- **Tooltip:** "Listening... (click to stop)"
- **Behavior:** Click to stop recording and finalize transcription

**CSS Animation:**
```css
@keyframes pulse-red {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

.mic-button-listening {
  animation: pulse-red 1.5s infinite;
}
```

---

### State 3: Processing (Transcribing)
```
┌──────┐
│  ⏳  │  ← Spinner animation
└──────┘
```
- **Icon:** `<Loader2 />` (Lucide) with rotation
- **Color:** Blue (#3b82f6)
- **Animation:** Continuous rotation
- **Tooltip:** "Transcribing..."
- **Behavior:** No click action (wait for completion)

---

### State 4: Error
```
┌──────┐
│  ⚠️  │  ← Warning icon
└──────┘
```
- **Icon:** `<AlertTriangle />` (Lucide)
- **Color:** Yellow/Red (#f59e0b or #ef4444)
- **Tooltip:** Error message (e.g., "Microphone permission denied")
- **Behavior:** Click to retry or open settings

---

## Keyboard Shortcuts

### Primary Shortcut: Cmd+Option+V (macOS)
- **Action:** Toggle dictation (start if idle, stop if listening)
- **Rationale:** Matches VS Code Speech extension standard
- **Implementation:** Register in `Editor.tsx` keyboard handler

### Alternative: Push-to-Talk (Future)
- **Action:** Hold Cmd+Option+V to record, release to stop
- **Rationale:** User requested toggle, not push-to-talk
- **Status:** Not implemented in Sprint 22, consider for future

---

## Visual Feedback Flow

### Scenario 1: Successful Dictation

```
1. Idle State
   [🎤 gray] ← User clicks mic button

2. Requesting Permission (first time only)
   [🎤 gray] + System dialog "Allow microphone?"

3. Listening
   [🎤 red pulsing] ← User speaks: "The quick brown fox"

4. Processing
   [⏳ spinner] ← whisper.cpp transcribing (500ms)

5. Text Inserted
   [🎤 gray] + Editor shows: "The quick brown fox▌"

6. Ready for Next
   [🎤 gray] ← User can click again to continue
```

---

### Scenario 2: Error - Permission Denied

```
1. Idle State
   [🎤 gray] ← User clicks mic button

2. Permission Request
   [🎤 gray] + System dialog "Allow microphone?"

3. User Denies
   [⚠️ yellow] + Tooltip: "Microphone permission denied"

4. Error Dialog (VS Code notification)
   "Voice dictation requires microphone access.
    Open System Preferences > Privacy > Microphone
    and enable Ritemark."

5. Return to Idle
   [🎤 gray] ← User can retry after fixing permission
```

---

### Scenario 3: Error - Model Loading Failed

```
1. Idle State
   [🎤 gray] ← User clicks mic button (first time)

2. Loading Model
   [⏳ spinner] + Tooltip: "Loading speech model... (first time only)"

3. Model Load Failed
   [⚠️ red] + Tooltip: "Failed to load speech model"

4. Error Dialog
   "Voice dictation setup failed.
    Please check your internet connection and try again."

5. Return to Idle
   [🎤 gray] ← User can retry
```

---

## Text Insertion Behavior

### Insert at Cursor Position
```
Before: "Hello |world"  (| = cursor)
Dictate: "beautiful "
After:  "Hello beautiful |world"
```

### Handle Selection (Optional Enhancement)
```
Before: "Hello [world]"  ([...] = selection)
Dictate: "universe"
After:  "Hello universe|"
```
**Note:** Not in Sprint 22 scope, consider for future.

---

### Undo Behavior
```
Before dictation: "Hello world"
After dictation:  "Hello world The quick brown fox"
User presses Cmd+Z:
After undo:       "Hello world"  ← Entire dictation removed as one action
```

**Implementation:** Insert text as single TipTap transaction.

---

## Live Transcription Preview (Optional)

### Floating Preview Tooltip
```
┌─────────────────────────────────────────┐
│ [🎤 red pulsing]                        │
│   ┌───────────────────────────────────┐ │
│   │ "The quick brown..."              │ │
│   └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Pros:**
- Shows what's being recognized in real-time
- User can stop if recognition is wrong

**Cons:**
- Adds complexity
- May be distracting
- Not essential for MVP

**Decision:** NOT in Sprint 22 scope. Evaluate based on user feedback.

---

## Error Messages

### Microphone Permission Denied
```
Title: Microphone Access Required
Message: Ritemark needs microphone access for voice dictation.

Allow access in System Preferences:
1. Open System Preferences > Security & Privacy
2. Click "Privacy" tab
3. Select "Microphone" from the list
4. Check the box next to "Ritemark"

[Open System Preferences]  [Cancel]
```

---

### Model Loading Failed
```
Title: Voice Dictation Setup Failed
Message: Could not load the speech recognition model.

Possible causes:
- Insufficient disk space (~75MB required)
- Corrupted model file

Try restarting Ritemark or reinstalling the app.

[Retry]  [Cancel]
```

---

### Transcription Failed
```
Notification: Could not transcribe audio. Please try again.
```
(Simple toast notification, no modal dialog)

---

### Platform Not Supported
```
Notification: Voice dictation is currently only supported on macOS.
Windows support is coming soon!
```

---

## Accessibility

### Screen Reader Support
```html
<button
  aria-label="Start voice dictation"
  aria-pressed="false"
  role="button"
  title="Start voice dictation (Cmd+Option+V)"
>
  <Mic />
</button>
```

### Keyboard Navigation
- Mic button should be focusable via Tab key
- Space or Enter should activate button (same as click)
- ESC should stop dictation if listening

---

## Mobile Considerations (Future)

**Note:** Sprint 22 is desktop-only (macOS). Mobile UX requires separate design.

**Potential mobile approach:**
- Larger touch target (48x48px minimum)
- Simpler visual feedback (no hover states)
- Consider voice activation instead of button ("Hey Ritemark")

---

## Implementation Checklist (Phase 2)

- [ ] Create mockups for Option A (BubbleMenu) and Option B (Fixed Toolbar)
- [ ] Review mockups with Jarmo, decide on placement
- [ ] Design mic button component with 4 states (idle/listening/processing/error)
- [ ] Design CSS animations (pulse, spinner)
- [ ] Write error messages and tooltips
- [ ] Plan keyboard shortcut implementation (Cmd+Option+V)
- [ ] Design permission request flow
- [ ] Plan undo behavior (single transaction)

---

## Open Questions for Jarmo (Phase 2)

1. **Button placement:** BubbleMenu (quick to implement) or Fixed Toolbar (more discoverable)?
2. **Live preview:** Show transcription in real-time or wait until final?
3. **Keyboard shortcut:** Cmd+Option+V acceptable or prefer different?
4. **First-time UX:** Show tutorial/tooltip on first use?
5. **Language switching:** Should user be able to switch language mid-dictation? (e.g., English → Estonian)

---

## Next Steps

1. **Create visual mockups** (use Figma or simple HTML prototype)
2. **Test button placement** with real editor content
3. **Validate animation performance** (ensure pulse doesn't lag editor)
4. **Review with Jarmo** before implementing in Phase 3
