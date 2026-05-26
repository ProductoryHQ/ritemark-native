# Sprint 72 Adversarial Review Gate

Date: 2026-05-24

## Gate Result

Approved for implementation after baseline recheck.

The first review pass found a blocking zero-byte working-tree state. A follow-up recheck on 2026-05-24 showed the affected files had been restored by the concurrent build process and no modified zero-byte files remained. The SDD clarifications from this review remain in force for implementation.

## Findings

### 1. Current worktree baseline was temporarily unsafe

The repository was on `main` at sprint start. It has now been switched to `codex/sprint-72-markdown-navigation-annotations`, but many pre-existing modified files came along with the working tree.

Several core files are currently zero bytes in the working tree, while `HEAD` still contains the expected implementation:

- `extensions/ritemark/webview/src/App.tsx`
- `extensions/ritemark/webview/src/components/Editor.tsx`
- `extensions/ritemark/webview/src/extensions/CustomLink.ts`
- `extensions/ritemark/webview/src/utils/turndownService.ts`
- many additional webview and extension files reported by `git diff --name-only`

Impact:

- The technical plan references code paths that exist in `HEAD`, but not in the current working tree.
- Any implementation would either fail to compile or accidentally build on top of unrelated destructive deletions.
- Because these are pre-existing user/worktree changes, they must not be silently reverted by an agent.

Follow-up:

- Rechecked after the user's note that another build was running.
- `App.tsx`, `Editor.tsx`, `CustomLink.ts`, `turndownService.ts`, and `media/webview.js` now have non-zero content.
- No modified zero-byte files were found in the working tree.
- The baseline blocker is considered resolved.

### 2. Internal link activation was under-specified

The spec covered creating relative local-file links, but did not say what happens when a user activates one later. Existing `CustomLink` behavior in `HEAD` sends modifier-clicked links through `openExternalUrl`; if reused unchanged, a relative link like `../briefs/q2-plan.md` could be treated as an external URL.

Impact:

- Sprint 72 could successfully insert internal links but produce unsafe or confusing activation behavior.

Resolution:

- Add an explicit requirement that internal relative links must not be routed through external browser opening.
- The MVP may open the target file in Ritemark/VS Code or may keep activation edit-only, but it must not construct an external URL from a relative path.

### 3. No-workspace behavior needed sharper architecture

The sprint plan says no-workspace mode should search near the current file. Requirement R3 says insertion is disabled if no stable current path exists. The technical plan only mentioned `vscode.workspace.findFiles`, which depends on workspace APIs and does not fully describe single-file fallback.

Impact:

- Implementation could accidentally work only in workspace folders, or insert invalid relative paths for untitled/unstable documents.

Resolution:

- Clarify that saved single-file documents can search near the current file, but untitled or otherwise unstable documents must show a clear empty state and disable internal insertion.

### 4. Add Link input type can fight relative-path mode

The Add Link dialog currently uses URL-oriented input and URL normalization. For Sprint 72, the same control needs to accept `@query` while searching and relative paths after selection.

Impact:

- Browser URL input behavior, validation, and the external-open affordance can conflict with internal-file search.

Resolution:

- Use text-input semantics and a shared link-target classifier that distinguishes external URLs, selected safe relative paths, and rejected dangerous protocols.

### 5. Boundary and stale-result tests should be first-class

The spec says `@` opens at a valid text boundary and stale responses should be dropped, but tasks did not require focused checks for email/literal `@` cases or request ordering.

Impact:

- A plausible implementation could interrupt email addresses or insert stale search results after fast typing.

Resolution:

- Add test/QA tasks for `@` boundary behavior and stale search response handling.

## Approved Constraints After Baseline Resolution

- Use `spec.md` requirement IDs in implementation notes where practical.
- Start with file search and link validation helpers before UI.
- Treat comment callouts as audit-first; do not implement #81 unless fixture evidence shows round-trip/export behavior is reliable.
- Phase 0 can close once the implementation order is confirmed and the SDD approval checkbox is marked.
