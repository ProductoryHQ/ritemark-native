# Sprint 115 Specification — Reliable Editor–Disk Synchronization

## Outcome

An open Ritemark document always converges to an explainable disk/model/view state. Agent and other external writes appear without closing and reopening the file, ordinary local typing never masquerades as an external change, and no timer can discard unconfirmed local work.

## Definitions

- **Disk revision:** the latest content revision confirmed by reading the file.
- **Model revision:** the content and version held by VS Code's `TextDocument`/working copy.
- **View revision:** the external/base revision TipTap has acknowledged as visibly applied.
- **Local edit:** a user edit based on the current acknowledged external base; it may make the model/view newer than disk while autosave is pending.
- **Unresolved external revision:** a disk revision newer than the view's external base that has not been acknowledged, failed to apply, or conflicts with local edits.
- **True conflict:** disk and local content both changed independently from the same confirmed base.

## Requirements

### R1 — One explicit synchronization authority

The extension host owns a per-document synchronization state machine. For each open Markdown or CSV URI it tracks the disk, VS Code model, external base, and acknowledged view revisions. Watchers, document events, and polling only request reconciliation; they do not directly set UI state or declare successful application.

Each transition is serialized per URI. Reopening a document creates a new epoch so late messages from an older webview cannot affect the new view.

### R2 — Revisioned delivery with visible-apply acknowledgement

Every host-to-webview document update carries a document epoch, monotonically increasing revision, base revision, content identity, reason, and full file-type payload. TipTap replies with `document:applied` only after the new content and associated Markdown properties/image mappings or CSV data are present in the active view.

The host does not advance the acknowledged view revision when `postMessage` resolves. Missing acknowledgement triggers a bounded retry and then an explicit apply-error state. Duplicate updates are idempotent; stale epochs/revisions are rejected.

### R3 — Clean external writes converge while focused

When the model has no local divergence, an external agent or process write is applied automatically even if TipTap is focused. Focus is not a reason to skip the update. Selection and scroll position are preserved when their positions remain meaningful and are safely clamped otherwise.

After acknowledgement, the document shows the new content without close/reopen and no persistent file-change action remains.

### R4 — Local work is never discarded implicitly

When disk and local content diverge from the same base, synchronization enters a true conflict state. The ten-second forced reload path is removed. No retry, poll, watcher event, blur, autosave, or panel disposal may choose a version for the user.

The user receives non-destructive **Review changes**, **Keep my version**, and **Use disk version** paths. Both write-producing resolutions recheck the exact disk validator immediately before changing state: if disk has already advanced, the conflict is recalculated instead of overwriting that observed revision. Public local-filesystem APIs do not provide atomic content-hash CAS, so **Keep my version** remains an explicit overwrite with a named residual compare→write interval.

### R5 — Truthful, derived file-change affordance

The header action is derived from synchronization state rather than an independent React boolean.

- Synced state: hidden.
- Local edits with no newer external disk revision: hidden.
- Clean external revision: auto-apply; hidden after acknowledgement.
- Unacknowledged/failed external apply: visible as a retry/review state until resolved.
- True two-sided conflict: visible as **Review changes** until explicitly resolved.

Clicking the action cannot clear it before the host confirms convergence. The action has an accessible name, keyboard focus, and a state-specific tooltip; it does not rely on indigo color alone.

### R6 — Deterministic detection and ordering

Content identity and explicit base revisions replace the bounded 20-hash self-content heuristic. Rapid external writes are coalesced or processed in order so an older revision cannot win after a newer one. Local edits carry the base revision they were created from.

The solution works for watcher delivery, VS Code model events, and the polling fallback in folder workspaces and single-file windows. It does not require all agents or external tools to use a Ritemark-specific write API.

### R7 — Markdown, CSV, and multi-view integrity

The synchronization contract covers both editable file types served by `RitemarkEditorProvider`: Markdown and CSV. Markdown updates preserve front matter, document properties, comments, and image mappings; CSV updates preserve table data and current save semantics.

Multiple views of the same URI either share the same coordinator state or receive the same ordered revisions independently. Disposing one view must not stop synchronization for another.

### R8 — Regression proof and architectural truth

Automated tests cover the state machine, protocol ordering, retries, focused apply, autosave lag, true conflict, explicit resolutions, rapid writes, close/reopen, single-file mode, and multiple views. Tests assert that no local content is lost and that the affordance is visible only for an unresolved external revision or conflict.

Sprint close updates `docs/development/architecture.md`, `docs/CHANGELOG.md`, v1.10.0 release notes, and release test evidence. Diagnostic logging may record epoch/revision/state transitions and timing, but never document content.

## Non-Requirements

- Full migration of every `bridge.ts` message under architectural debt issue #106.
- CRDT, Operational Transformation, ProseMirror collaboration service, multi-user editing, or cloud sync.
- A new VS Code custom editor provider or a VS Code OSS patch.
- Requiring Codex, Claude, ACP, formatters, or other external writers to call a new Ritemark-only API.
- A new feature flag. This is a correctness and data-integrity fix; disabling it must not restore the destructive legacy path.
- Pixel-level redesign of the document header beyond the synchronization/conflict affordance.

## Release Blockers

Any of the following blocks v1.10.0 feature complete:

- an acknowledged agent write remains invisible in an open focused editor;
- closing and reopening is required to see the latest confirmed disk revision;
- ordinary local typing/autosave lag shows an external-change action;
- local edits can be replaced by a timer or background retry;
- a stale or unacknowledged message is recorded as visible;
- Markdown or CSV loses content, front matter, properties, mappings, or table data during reconciliation;
- architecture and release documentation still describe send-as-success behavior.
