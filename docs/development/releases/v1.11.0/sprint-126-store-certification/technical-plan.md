# Sprint 126 Technical Plan

**Parent:** [spec.md](./spec.md) · **Evidence:** [research/phase-0-audit.md](./research/phase-0-audit.md)

## Architecture overview

Two independent changes that share nothing but the release.

**Reporting (RQ1–RQ5)** is a webview dialog reached two ways, with a thin host edge. The host owns the status bar item, the command behind it, and the two things a webview cannot do — opening a mail handler and reporting whether one exists. The webview owns the window and composes the text. No runtime touches any of it.

**Acquisition promotion (RQ6)** is two text edits inside `patches/vscode/`. No TypeScript in `extensions/ritemark/` changes.

The transcript is deliberately untouched. Dropping the per-turn control removed the need to introduce a per-turn action affordance — something the transcript has never had — and to attach it separately to `AgentResponse` and `CodexTurn`, since there is no shared assistant-output component to anchor to (`RenderedMarkdown` takes `{ content, className }` and also renders user text). The status bar item is always on screen, which is a better answer to "discoverable" than a control that only exists once a turn does.

It also collapses the payload problem. With no turn in hand, the builder is never given conversation content, so RQ5 is enforced by construction rather than by filtering.

## Host files

| File | Change |
|---|---|
| `src/reporting/reportTransport.ts` | New. Resolves whether a mail handler exists and opens it. Sole owner of the `mailto:` URL construction and its encoding limits. |
| `src/reporting/protocol.ts` | New. Typed inbound message + result, validated field by field, in the shape `src/commentTasks/protocol.ts` established. |
| `src/reporting/reportStatusBar.ts` | New. The status bar item at right/priority 99 — between the AI status (100) and the scheduled-tasks item (98) — plus its command, which reveals the AI panel and asks the webview to open the report window. |
| `src/views/UnifiedViewProvider.ts` | Wire the message pair and the open-report request. No other behaviour. |
| `package.json` | Contribute the command. |

`mailto:` length is the one real hazard: handlers and the OS truncate long URLs, silently. `reportTransport` measures the encoded URL and, above a conservative bound, returns the fallback outcome instead of opening a handler that would drop the body. The fallback is a first-class state (RQ3), so this degrades into a supported path rather than an error.

## Webview files

| File | Change |
|---|---|
| `webview/src/components/ai-sidebar/reporting/composeReport.ts` | New. Pure builder: turn + context → report text. Where RQ5's bound is enforced; unit-tested against each excluded category. |
| `webview/src/components/ai-sidebar/reporting/ReportDialog.tsx` | New. The composition window: editable body, primary action, cancel, and the fallback state with the address and Copy. |
| `webview/src/components/ai-sidebar/reporting/reportCopy.ts` | New. Every user-visible string, so RQ4's language is assertable in one test rather than scattered across JSX. |
| `AIInformation.tsx` | Add the report entry. |
| `index.css` | Styles for the new control and dialog. |

Using `ui/dialog.tsx` (shadcn) is mandatory per CLAUDE.md — no hand-rolled modal. The primary action uses `ui/button.tsx`.

## Workstreams

### W0 — Freeze (RQ1–RQ8)
Confirm the audit against the current `main`, and confirm in Partner Center which asset `StoreLogo2` actually is before any artwork is prepared. Blocks W4.

### W1 — Report composition (RQ2, RQ5)
`composeReport.ts` and `reportCopy.ts`. The builder accepts only a timestamp, version and platform, and the user text — so the bound is its signature, not a filter. Negative tests per excluded category still run, to catch a later caller widening it. No UI yet.

### W2 — Transport (RQ3, RQ4)
`reportTransport.ts`, `protocol.ts`, the provider wiring, and the URL-length bound that degrades to the fallback. Host tests run without VS Code, in the pattern `CommentTaskController.test.ts` uses.

### W3 — UI (RQ1, RQ2, RQ4)
`ReportDialog.tsx`, the status bar item and its command, the AI Information entry, styles, and accessibility: keyboard reach, accessible names, focus handling in the dialog. Both entry points open the same window in the same state; there is one implementation, not two.

### W4 — Acquisition promotion (RQ6)
Patch the three `scm.missing.*` strings and the two welcome-page launch checks. Add the applicability check that fails loudly on an upstream drift. Independent of W1–W3 and can run in parallel.

### W5 — Evidence and closeout (RQ7, RQ8)
Packaged-app evidence per finding on Windows, with and without Git, with and without a mail handler. Partner Center changes for Freemium and the artwork. Reviewer reproduction instructions naming the monitored mailbox. Store documentation under `docs/microsoft-store-submission/` updated with the final asset mapping.

## Implementation order

W0 → (W1 → W2 → W3) and W4 in parallel → W5.

W4 is the only shell-tier change here, and the release is already shell-tier from the Sprint 116 runtime binaries, so it adds no release cost. It is deliberately sequenced early: it needs a packaged Windows build to verify, and that build takes the longest to obtain.

## Architecture gate

- No fourth runtime, no runtime-specific dispatch, no second host/webview message contract for content that already has one.
- Model identifiers come from `src/ai/modelConfig.ts`; the report records the identifier it was given with the turn and does not hardcode one.
- `architecture.md` is updated only if the message contract or module structure changes — it does, so it will be.
- No new feature flag. If a kill-switch is ever wanted for reporting, that is a later decision; shipping one now would contradict RQ1.
