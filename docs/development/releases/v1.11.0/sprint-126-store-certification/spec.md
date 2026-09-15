# Sprint 126 Spec — Microsoft Store Certification Gaps

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.11.0](../release-plan.md) · **Evidence:** [research/phase-0-audit.md](./research/phase-0-audit.md) · **Status:** Phase 0 specification, awaiting Jarmo's implementation approval

Requirements are numbered `RQ1…RQ8` so they are never confused with the certification report's own findings, which this document calls **R1–R4** throughout. Every requirement names the finding it serves.

## Purpose

Clear all four findings in Microsoft's 2026-09-15 certification report with evidence a reviewer can reproduce, and leave Ritemark with a reporting mechanism that is worth having on its own merits rather than a compliance prop.

## Principles

1. **Never claim a delivery we cannot observe.** Ritemark can see that it handed a report to a mail client. It cannot see that mail arrive. The words on screen say exactly that much and no more.
2. **The user sees what is sent, and can change it.** The report body is an editable field pre-filled with the content being reported. Minimisation is the user's own act, not a heuristic.
3. **Inform, do not offer.** Ritemark says what is missing from the machine. It does not provide the action that obtains it.
4. **No second dispatch path.** Reporting reuses the existing host/webview message boundary and introduces no runtime-specific handling. The three runtimes differ only in what they produced, never in how a report is raised.
5. **Fix the class, not the instance.** Where a finding names one occurrence of a pattern we own, the sibling occurrences go too.

## Requirements

### RQ1: Two report entry points, always present (R2)

A user can raise a report from the conversation turn in the AI sidebar, and from the AI Information dialog already mounted in the composer.

- The turn-level control covers Claude Code, Codex and OpenCode through one attachment, because all three share the turn model.
- The AI Information entry is surface-independent: it is reachable whenever the sidebar is, regardless of what is on screen or whether any turn exists yet.
- Neither entry point is gated by a feature flag a user can switch off. The three runtime flags they depend on are already `stable`, and no flag promotion is part of this sprint.
- The turn control is keyboard reachable and carries an accessible name that says what it does; it is not an unlabelled icon.

### RQ2: A composition window showing exactly what will be sent (R2)

Choosing to report opens a window containing the report as text, in an **editable** field, before anything leaves Ritemark.

- The field is pre-filled with the reported model output and the minimal context of RQ5.
- Nothing is included that the field does not show. What the user reads is what is sent, character for character.
- The user can edit or delete any part of it, and can cancel outright with nothing transmitted and no trace left.
- Raised from AI Information with no turn in context, the field opens with the context lines and an empty body for the user to describe the problem.

### RQ3: `mailto:` first, copy fallback as a first-class state (R2)

The report reaches `info@productory.eu`, monitored by the Ritemark team.

- When a mail handler exists, Ritemark opens it addressed to `info@productory.eu` with a subject identifying Ritemark and its version, and the composed body.
- When no mail handler exists, Ritemark shows the address and the full report text with a **Copy** button. This is a normal outcome, not an error: it gets its own state, its own copy and its own test.
- No backend service is built, and no report is transmitted by Ritemark itself.
- The failure the reviewer is most likely to produce — a clean Windows machine with no mail account — must end in a complete, visible, copyable report.

### RQ4: Honest language at every step (R2)

- Before: the button says what will happen (the mail app opens), not that a message will be sent.
- After the handoff: Ritemark says the mail app was opened and the report still has to be sent there. It never says "sent", "delivered", "received" or "thank you for your report".
- In the fallback: it says plainly that the report must be pasted into an email and sent by the user.
- No success animation, checkmark or confirmation toast implies receipt.

### RQ5: A bounded, stated payload (R2)

The report carries only: the reported model output, the runtime that produced it, the model identifier, a timestamp, the Ritemark version and platform, and whatever the user writes or edits.

It never carries, automatically: the full conversation, the document, file paths, workspace names, API keys, tokens, or account identifiers. The bound is enforced where the payload is built, not by trusting the caller — and a test asserts each excluded category is absent.

This reverses the posture `CommentTaskProjectionV1` takes elsewhere (`src/commentTasks/types.ts:206-207` excludes prompt text and content hashes). That exclusion stays in force for every non-report path; the difference here is that the user sees and approves the content.

### RQ6: No external acquisition promotion (R4)

Ritemark tells the user that Git or Node is missing and does not offer to obtain it.

- The three `scm.missing.*` strings lose their bare download-link line and keep an informational sentence plus the `reload` and `troubleshoot` commands. Because no line is left that parses to a single link, nothing renders as a button (`viewPane.ts:249-253`).
- The welcome page keeps "Ritemark needs Git." and "Ritemark needs Node." and drops the "Click here to install" action from both.
- Source Control continues to work normally when Git is installed. The `scm.missing.*` contributions are gated on `git.missing`, so this holds by construction.
- The patch carries an applicability check that fails loudly if an upstream bump restores the strings.

### RQ7: Store metadata corrected against the live assets (R1, R3)

- Pricing classification changes from Free to Freemium, and the listing text accurately describes that AI features may require the user's own paid third-party account. No Ritemark subscription or payment feature is invented.
- The **live** `StoreLogo2` asset is identified in Partner Center before any replacement is prepared. A repository logo is not evidence of what is published. Every other submitted image is checked for the same non-Windows imagery.

**The image track is Jarmo's own work** (2026-09-15): identifying the live asset, producing the replacement artwork, and uploading it. The sprint does not generate Store imagery and does not block on it — the implementation work is RQ1-RQ6, and RQ7's artwork half runs alongside on Jarmo's side. No task here should be read as authorizing anyone else to produce or replace Store art.

### RQ8: Evidence a reviewer can reproduce (R1–R4)

Each finding has its own evidence, owned separately: packaged-app reproduction for RQ1–RQ6, saved Partner Center state for RQ7. The reviewer instructions name `info@productory.eu` and say the Ritemark team monitors it, because the finding asks for an owned receiving process and an unattended mailbox does not satisfy it.

## Non-Requirements

- No reporting on Transcribe insights, Flows output, generated images, conversation titles or comment-task summaries. Reasons per surface are in the audit; the short version is that they lack a stable identity or lose provenance before rendering.
- No moderation, classification or automated triage of reports.
- No backend ingestion service, no report history, no in-app status of a submitted report.
- No feature-flag promotion, and no Store-specific build. The submitted package is the same artifact as the public download.
- No change to how agents produce content — this sprint adds a way to report it, not a filter.
- No removal of Source Control, and no upstream VS Code submodule edits outside `patches/vscode/`.

## Phase 0 decisions carried in

All taken 2026-09-15 and evidenced in [the audit](./research/phase-0-audit.md): recipient `info@productory.eu`; content may be included; the user reviews it in an editable field; `mailto:` with a copy fallback; the Ritemark team triages; surfaces are the turn and AI Information; no flag change; inform-don't-offer for Git and Node, with Node included as the same construct.
