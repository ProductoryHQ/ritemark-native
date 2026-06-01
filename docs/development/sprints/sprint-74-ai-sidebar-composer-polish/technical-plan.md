# Sprint 74 Technical Plan

## Architecture Overview

All four workstreams are pure webview changes. No extension-host code changes are required. The files are:

| File | Workstreams |
|------|-------------|
| `extensions/ritemark/webview/src/components/ai-sidebar/AgentResponse.tsx` | W1 (R1) |
| `extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx` | W2 (R2) |
| `extensions/ritemark/webview/src/components/Editor.tsx` (inline `<style>`) | W3 (R3) |
| `extensions/ritemark/webview/src/index.css` | W3 (R3, secondary) |
| `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx` | W4 (R4) |

No new files. No Zustand store changes for W1, W3, W4. W2 adds local `useState` to `ChatInput` only.

---

## Workstream 1: Plan Review Card Fix (R1)

### Root Cause Recap

`AgentResponse.tsx` line 89:
```tsx
const needsApproval = turn.isPlan && !turn.planHandled && !turn.pendingPlanApproval;
```

When the `agent-plan-approval` store message fires, the store sets `turn.pendingPlanApproval` to the `AgentPlanApprovalRequest` object. The `!turn.pendingPlanApproval` makes this `false` at exactly the moment approval is needed.

### Fix

Change the `needsApproval` condition to require `pendingPlanApproval` to be present (not absent):

```tsx
// Before (broken):
const needsApproval = turn.isPlan && !turn.planHandled && !turn.pendingPlanApproval;

// After (correct):
const needsApproval = turn.isPlan && !turn.planHandled && !!turn.pendingPlanApproval;
```

This is a one-character change (`!` → `!!`). Everything downstream (plan text extraction, `RenderedMarkdown`, `approvePlan`/`rejectPlan` calls) is already correct.

### Plan Text Source

`turn.planText` is populated incrementally by `plan_text` progress events in the store (see `store.ts` line ~1356). `extractPlanDisplayText(turn.planText)` extracts the display-worthy portion. The existing code in `AgentResponse` already calls `extractPlanDisplayText` correctly — the only bug is that the surrounding condition suppresses the render.

### Note on Dual Approval UI

`AgentResponse` has a second inline approval UI block (lines ~118-158) that duplicates the functionality of `AgentPlanApproval.tsx`. With the fix, this block will now render for turns where `isPlan && !planHandled && pendingPlanApproval`. However, `AgentView` already renders `AgentPlanApproval` for the same condition via the running-turn path. There is a risk of double rendering during the running phase.

**Mitigation:** `AgentResponse` renders only when `turn.result` is present (`if (!result) return null` at line 45). During an active plan-approval wait, the agent is still running and `turn.result` is `undefined`, so `AgentResponse` returns early. The `AgentResponse` inline approval UI therefore only activates on completed turns — which represents a different scenario (a plan that was not handled before the result arrived). The minimal fix is safe; no double-rendering.

**Optional cleanup (not blocking Phase 3 start):** Remove the inline approval UI from `AgentResponse` and rely solely on `AgentPlanApproval` from `AgentView`. This would be a cosmetic refactor, not a correctness fix. Deferred per R1 Open Question.

---

## Workstream 2: Composer Input Unlock + Queue (R2)

### Level 1 — Unlock textarea

`ChatInput` currently uses `isLoading` to disable the textarea:

```tsx
<textarea
  ...
  disabled={isLoading}
  ...
/>
```

**Change:** Remove `disabled={isLoading}` from the `<textarea>`. This alone achieves Level 1 (user can type during agent run).

The Send button is separately gated by `!value.trim() || !isOnline`. During agent run, `isLoading` is true but the Send button path (`isLoading ? <Stop> : <Send>`) already shows Stop instead of Send — so Send is never clickable while `isLoading` regardless.

**Placeholder change:** Add conditional placeholder:
```tsx
placeholder={isLoading && isAgentMode
  ? 'Agent is running — type your next message…'
  : /* existing placeholder logic */}
```

**Attach-file button:** Keep `disabled={isLoading}` on the attach-file button only (this matches AC2.4).

### Level 2 — Queue state

Add two new `useState` hooks to `ChatInput`:

```tsx
const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
```

(No attachments in queue for MVP — attaching files is already disabled during run, so there is nothing to queue.)

**Queue trigger:** Modify `handleSend` (or `handleKeyDown`) to detect the queue condition:

```tsx
// In handleSend (or before the existing guard):
if (isLoading && isAgentMode) {
  const prompt = buildFinalPrompt();
  if (!prompt) return;
  setQueuedPrompt(prompt);
  setValue('');
  return; // Do not send yet
}
// ... existing send logic
```

**Queue indicator chip:** Render below the textarea (inside the input card container, below the `<textarea>` element):

```tsx
{queuedPrompt && (
  <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-[var(--r-hairline)]">
    <Icon name="clock" size={12} className="shrink-0 text-[var(--r-ink-muted)]" />
    <span className="flex-1 truncate text-[11px] text-[var(--r-ink-muted)]">
      Queued: {queuedPrompt}
    </span>
    <button
      onClick={() => setQueuedPrompt(null)}
      className="shrink-0 rounded hover:text-[var(--r-error)]"
      title="Discard queued prompt"
    >
      <Icon name="x" size={12} />
    </button>
  </div>
)}
```

**Auto-send on agent completion:** Add a `useEffect` that fires when `agentRunning` transitions from `true` to `false`:

```tsx
const prevAgentRunning = useRef(agentRunning);
useEffect(() => {
  if (prevAgentRunning.current && !agentRunning && queuedPrompt) {
    // Restore queued prompt to textarea, then send
    setValue(queuedPrompt);
    setQueuedPrompt(null);
    // handleSend reads from `value` which updates async — use a microtask
    // to let React commit before calling send:
    setTimeout(() => handleSend(), 0);
  }
  prevAgentRunning.current = agentRunning;
}, [agentRunning]); // eslint-disable-line react-hooks/exhaustive-deps
```

Note: `handleSend` reads `value` via the closure. Because `setValue` is async (React batching), the `setTimeout(..., 0)` pattern ensures the state update commits before `handleSend` runs. Alternatively, `handleSend` can be modified to accept an optional `overridePrompt` parameter.

**Preferred approach — override prompt parameter (cleaner):**

```tsx
// handleSend signature change:
const handleSend = useCallback((overridePrompt?: string) => {
  const prompt = overridePrompt ?? buildFinalPrompt();
  if (!prompt || ...) return;
  // ... rest unchanged
}, [...]);

// useEffect auto-send:
useEffect(() => {
  if (prevAgentRunning.current && !agentRunning && queuedPrompt) {
    const prompt = queuedPrompt;
    setQueuedPrompt(null);
    setValue('');
    handleSend(prompt);
  }
  prevAgentRunning.current = agentRunning;
}, [agentRunning, queuedPrompt, handleSend]);
```

**Textarea disabled when prompt is queued:**

Once `queuedPrompt` is set, the textarea should be disabled (AC2.9 — only one queued prompt at a time):

```tsx
<textarea
  ...
  disabled={!!queuedPrompt}   // disabled only while a prompt is queued
  ...
/>
```

This replaces the original `disabled={isLoading}` — the textarea is now disabled only when something is queued, not during the full run duration.

---

## Workstream 3: Code Block Scrollbar Fix (R3)

### Affected Rules

Two CSS locations:

1. **`Editor.tsx` (inline `<style>`, ~line 1201):**
   ```css
   .wysiwyg-editor .ProseMirror pre.tiptap-code-block {
     ...
     overflow-x: auto !important;   /* <-- change this */
     ...
   }
   .wysiwyg-editor .ProseMirror pre.tiptap-code-block code {
     ...
   }
   ```

2. **`index.css` (~line 195):**
   ```css
   .ProseMirror pre {
     ...
     overflow-x: auto;   /* <-- change this */
   }
   ```

### Fix Strategy

**`Editor.tsx`:** Change `pre.tiptap-code-block` rule from `overflow-x: auto` to `overflow-x: hidden`. Add `overflow-x: auto` to the `pre.tiptap-code-block code` rule so that the `<code>` element itself scrolls when lines are long.

```css
/* pre: clip overflow so scrollbar gutter never appears on the container */
.wysiwyg-editor .ProseMirror pre.tiptap-code-block {
  ...
  overflow-x: hidden !important;   /* was: auto */
  ...
}

/* code: scroll when lines are long */
.wysiwyg-editor .ProseMirror pre.tiptap-code-block code {
  display: block !important;
  overflow-x: auto !important;     /* added */
}
```

**`index.css`:** Change `overflow-x: auto` to `overflow-x: hidden` on `.ProseMirror pre`. The `<code>` inside will carry its own scroll.

**Tooltip clipping mitigation:** The copy button tooltip is `position: absolute` and a child of `pre.tiptap-code-block`. Changing `overflow-x` to `hidden` on `pre` will clip the tooltip horizontally. Workaround: use `overflow: hidden` only on the `pre`'s scrollable axis via separate rules, or — simpler — keep `overflow: visible` on `pre` and use `overflow-x: auto` + `min-width: 0` on `code`:

```css
.wysiwyg-editor .ProseMirror pre.tiptap-code-block {
  overflow: visible !important;    /* allows tooltip to escape */
  /* No overflow-x: auto here */
}

.wysiwyg-editor .ProseMirror pre.tiptap-code-block code {
  display: block !important;
  overflow-x: auto !important;
  min-width: 0 !important;
}
```

This is the preferred approach because it avoids any tooltip clipping. **The QA test must verify** that this renders no spurious scrollbar on the `pre` element itself while still scrolling the `code` child when needed.

---

## Workstream 4: Edit Link Dialog — Display Text (R4)

### State Additions (`FormattingBubbleMenu.tsx`)

Add one new state variable:

```tsx
const [linkDisplayText, setLinkDisplayText] = useState('');
```

### Pre-population

In `handleOpenLinkDialog` and the `externalLinkEdit` `useEffect`:

```tsx
// Get selected text (if any)
const { from, to } = editor.state.selection;
const selectedText = from !== to
  ? editor.state.doc.textBetween(from, to)
  : '';

setLinkDisplayText(selectedText);
setLinkUrl(previousUrl || '');
```

### Save Logic Changes (`handleSetLink`)

```tsx
const handleSetLink = () => {
  if (!linkUrl.trim()) {
    setUrlError('Please enter a URL or local file path');
    return;
  }

  const target = classifyLinkTarget(linkUrl);
  if (target.kind === 'dangerous' || target.kind === 'empty') {
    setUrlError('Please enter a valid web URL or relative file path');
    return;
  }

  const displayText = linkDisplayText.trim();

  if (displayText) {
    // Replace selection (or insert at cursor) with display text + link mark
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    editor.chain().focus()
      .command(({ tr, state }) => {
        if (hasSelection) {
          tr.replaceWith(from, to, state.schema.text(displayText, [
            state.schema.marks.link.create({ href: target.href }),
          ]));
        } else {
          tr.insert(from, state.schema.text(displayText, [
            state.schema.marks.link.create({ href: target.href }),
          ]));
        }
        return true;
      })
      .run();
  } else {
    // Existing behaviour: setLink only
    editor.chain().focus().setLink({ href: target.href }).run();
  }

  setShowLinkDialog(false);
  setLinkUrl('');
  setLinkDisplayText('');
  setUrlError('');
};
```

### Dialog JSX Changes

Add the Display text field below the URL row, hidden in file-search mode:

```tsx
{!isFileSearchMode && (
  <div>
    <label className="block text-sm font-medium mb-1 text-ink-muted">
      Display text (optional)
    </label>
    <input
      type="text"
      value={linkDisplayText}
      onChange={(e) => setLinkDisplayText(e.target.value)}
      onKeyDown={handleLinkInputKeyDown}  // same Enter/Esc behaviour
      placeholder="Visible text for the link"
      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
)}
```

### Reset on Dialog Close

Ensure `linkDisplayText` is reset when the dialog closes:

```tsx
// In onOpenChange handler or cancel button:
setLinkDisplayText('');
```

### TipTap Schema Note

The TipTap `Link` mark is defined as `excludes: '_'` (exclusive, not inclusive at boundaries). Using `state.schema.text(displayText, [mark])` is the canonical ProseMirror way to create a text node with a mark. This avoids any TipTap command API ambiguity.

---

## Tests

There are no automated unit tests for these webview components. Manual QA per `scenarios.md` is the verification path. The `qa-validator` hook (pre-commit-validator.sh) checks TypeScript compilation, which will catch any type errors introduced by these changes.

Type-safety note for W2: `handleSend` receives an optional `overridePrompt?: string` parameter — the TypeScript signature change must propagate to the `useCallback` dependency array and any call sites.
