# Sprint 115 Scenarios — Reliable Editor–Disk Synchronization

These scenarios are acceptance contracts. Each one maps to the stable requirement IDs in [spec.md](./spec.md).

## S1 — Initial load becomes acknowledged state (R1, R2)

**Given** a Markdown or CSV document is opened in a new webview epoch  
**When** the host sends the initial revision  
**Then** the host records it as sent but not visibly applied  
**And** TipTap/table state applies the complete payload  
**And** `document:applied` advances the acknowledged view revision  
**And** the synchronization affordance is hidden.

## S2 — Agent write appears while the editor is focused (R2, R3)

**Given** the view, model, and disk share one base revision and the editor has focus  
**When** Codex or another process writes different bytes to disk  
**Then** the coordinator detects and sends a newer revision  
**And** focus does not suppress content application  
**And** the new content is visible and acknowledged without close/reopen  
**And** usable selection/scroll context is preserved or safely clamped  
**And** no persistent file-change action remains.

## S3 — Rapid external writes cannot regress the view (R1, R2, R6)

**Given** revisions B and C are detected after base A  
**When** B is delayed and C reaches the webview first  
**Then** C may be applied and acknowledged  
**And** the late B message is ignored  
**And** the host never records B as the current view after C.

## S4 — Lost acknowledgement retries safely (R2, R5)

**Given** a clean external update was sent  
**When** no matching `document:applied` acknowledgement arrives within the bounded deadline  
**Then** the host retries the same idempotent revision  
**And** does not claim synchronized state  
**And** after the retry budget is exhausted, exposes a retry/review state  
**And** a later acknowledgement clears that state only when its epoch/revision still matches.

## S5 — Continuous local typing is not an external conflict (R1, R5, R6)

**Given** the user types continuously and VS Code postpones autosave  
**When** disk temporarily contains the older confirmed base  
**Then** the coordinator recognizes local-only divergence  
**And** does not show “file changed on disk”  
**And** does not schedule any reload  
**And** autosave can converge normally.

## S6 — True two-sided conflict is non-destructive (R4, R5)

**Given** local edits are based on revision A and remain uncommitted  
**When** disk independently advances from A to B  
**Then** the coordinator enters conflict state  
**And** keeps both local and disk snapshots available  
**And** shows **Review changes**  
**And** waiting, polling, focus changes, or panel lifecycle events never choose a version.

## S7 — Keep my version validates the observed disk revision (R4, R6)

**Given** a true conflict between local content and disk revision B  
**When** the user explicitly chooses **Keep my version**  
**Then** the host verifies disk is still B before writing  
**And** writes through the supported document/save path  
**And** waits for disk and view confirmation  
**And** hides the action only after convergence  
**But when** disk has advanced to C  
**Then** no overwrite occurs and the conflict is recalculated against C.

The public filesystem API cannot make the content-hash check and write one atomic operation. A non-cooperating write inside that final interval is a named last-writer boundary and receives a separate release-candidate injection row; this scenario does not claim HTTP-style atomic CAS.

## S8 — Use disk version is explicit and acknowledged (R2, R4)

**Given** a true conflict  
**When** the user explicitly chooses **Use disk version** and confirms local work will be discarded  
**Then** the current disk revision replaces the model and view  
**And** the operation is not completed until the view acknowledges it  
**And** Undo/recovery behavior documented by Phase 0 is honored.

## S9 — Compare is read-only (R4, R5)

**Given** a conflict is open  
**When** the user selects **Compare changes**  
**Then** Ritemark shows immutable local and disk snapshots with clear labels  
**And** opening or closing the comparison changes neither snapshot  
**And** returning to the document preserves the unresolved conflict state.

## S10 — Markdown payload stays complete (R2, R7)

**Given** an externally changed Markdown document contains front matter, properties, comments, and relative images  
**When** the revision is applied  
**Then** content, property state, comment markup, and image mappings all correspond to the same revision  
**And** the acknowledgement cannot describe a partially applied payload.

## S11 — CSV follows the same ordering contract (R1, R2, R7)

**Given** a CSV document is open  
**When** clean external writes, rapid writes, and a true local/disk conflict occur  
**Then** revisions, acknowledgements, stale rejection, and explicit resolution match the Markdown contract  
**And** no table rows or cells are silently lost.

## S12 — Single-file and workspace modes converge (R1, R6)

**Given** the same document is tested once inside a folder workspace and once as a standalone file  
**When** an external process writes it  
**Then** watcher/document-event differences may change the detection path  
**But** both modes reach the same ordered state and visible result within the accepted latency.

## S13 — Multiple views share lifecycle safely (R1, R7)

**Given** two Ritemark views display the same URI  
**When** one view is disposed or one view makes an edit  
**Then** the remaining view continues receiving ordered revisions  
**And** a disposed view's acknowledgement is ignored  
**And** no watcher/poll/coordinator is prematurely destroyed.

## S14 — Close/reopen rejects the previous epoch (R1, R2, R8)

**Given** an update from epoch E1 is still in flight  
**When** the document closes and reopens as epoch E2  
**Then** E1 messages and acknowledgements are ignored  
**And** E2 initializes from the latest confirmed state  
**And** reopening is a verification case, not a required refresh mechanism.

## S15 — Affordance is accessible and truthful (R5, R8)

**Given** each synchronization state is exercised with keyboard navigation, screen reader output, light mode, dark mode, and 200% zoom  
**Then** synced and local-only states have no file-change action  
**And** conflict, retry, and error states have distinct accessible names and copy  
**And** color is not the only state signal  
**And** clicking an action never clears it before confirmed resolution.

## Acceptance Matrix

| Dimension | Required coverage |
|---|---|
| File type | Markdown, CSV |
| Window mode | Folder workspace, multi-root where applicable, standalone file |
| Focus | Focused, blurred, selection spanning text, scroll away from cursor |
| Change source | TipTap local edit, autosave, Codex/Claude/ACP write, generic process write, formatter |
| Ordering | One write, burst writes, delayed message, duplicate message, stale message, missing ACK |
| Conflict | Clean external, local-only, true two-sided, disk advances during resolution |
| Lifecycle | Initial open, panel hide/show, second view, dispose one view, close/reopen |
| Accessibility | Keyboard, screen reader label, tooltip, light/dark, 200% zoom |
