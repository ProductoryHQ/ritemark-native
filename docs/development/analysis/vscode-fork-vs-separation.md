# VS Code Fork vs Separation: Sprint 57 Architecture Preparation

Date: 2026-04-30  
Sprint: `docs/development/sprints/sprint-57-windows-onboarding/`

## Decision Needed

Sprint 57 started from a Windows onboarding failure, but the research raised a larger architecture question:

Should Ritemark continue as a VS Code OSS fork, or should it separate into a smaller product shell?

This document separates the immediate onboarding decision from the larger shell architecture decision.

## Current Assessment

Ritemark's immediate Windows onboarding failures are not caused by VS Code OSS itself alone. They are caused by the combination of:

- VS Code defaults that are wrong for a document-first product, especially Workspace Trust.
- Claude auth status relying on credential presence instead of validation.
- Codex depending on a globally installed external CLI.
- clean Windows machines missing Git/Node prerequisites.

The first two can be fixed inside the current fork. The Codex dependency can be fixed either inside the current fork or by a larger agent architecture change. A shell rewrite is not required to solve the first-run Windows blocker.

## Options

| Option | Description | Solves Sprint 57 onboarding? | Cost | Risk |
| --- | --- | --- | --- | --- |
| A: Stay on VS Code OSS fork, fix onboarding | Keep current shell, patch Workspace Trust/auth/runtime dependency | Yes | Low-medium | Continued upstream patch maintenance. |
| B: VS Code OSS fork + bundled agent runtimes | Keep shell, remove external Claude/Codex CLI install dependency | Yes | Medium | Runtime update cadence and release-time legal review. |
| C: VS Code OSS fork + in-process agent | Keep shell, remove external Codex CLI dependency | Yes | Medium-high | Agent rewrite and ChatGPT OAuth decision. |
| D: Separate Electron shell | Build smaller app around editor/webview stack | Eventually | High | Rebuild workbench, file handling, updates, native integration. |
| E: Tauri shell | Smaller native app with web UI | Eventually | Very high | Rebuild almost everything; extension host assumptions break. |
| F: Hybrid VS Code Server / custom shell | Keep VS Code services behind custom shell | Unclear | Very high | Complex integration with uncertain payoff. |

## Option A: Stay On VS Code OSS Fork For Now

### Benefits

- Lowest path to fixing current user blockers.
- Preserves existing custom editor, webview, update, installer, and extension-host behavior.
- Avoids mixing onboarding fixes with a shell migration.
- Keeps existing QA and release process meaningful.

### Costs

- Upstream sync and patch maintenance continue.
- Product inherits developer-tool concepts that need hiding or disabling.
- Installer size and first-run feel remain heavier than a purpose-built app.

### Best Use

Use this for Phase 1 and for any fast Phase 3 bundled-runtime path.

## Option B: Keep Shell, Bundle Agent Runtimes

### Benefits

- Selected for Sprint 57 Path A.
- Attacks the Windows onboarding blocker without rewriting the app shell.
- Removes global npm, PATH, PowerShell installer, Node-version, and architecture detection from first-run setup.
- Matches the official Anthropic Claude Code VSIX pattern for Claude runtime packaging.
- Preserves the current Codex app-server integration if a redistributable runtime artifact is selected.

### Costs

- Requires runtime provenance, checksums, and update policy.
- Legal/redistribution review is deferred to release readiness for Sprint 57.
- Package size increases, especially for Claude native runtime.
- Subprocess lifecycle remains.
- Does not simplify long-term agent architecture as much as an in-process replacement.

### Best Use

Use this for Sprint 57 Phase 3.

## Option C: Keep Shell, Replace External Codex Runtime

### Benefits

- Attacks the main Windows agent blocker without rewriting the app shell.
- Removes global npm, PATH, PowerShell, Node-version, and architecture detection from user setup.
- Keeps Ritemark's existing VS Code integration surface.
- Lets the team learn whether a Ritemark-owned agent loop is sufficient before attempting a shell migration.

### Costs

- Requires a meaningful rewrite of `extensions/ritemark/src/codex/`.
- Requires careful compatibility with flows and the AI sidebar.
- Product/legal decision is needed for ChatGPT OAuth if subscription-based auth remains a goal.

### Best Use

Use this if the goal is a durable Windows-native AI experience while avoiding a full app rewrite.

## Option D: Separate Electron Shell

### Benefits

- Product can feel like a document editor instead of a developer IDE.
- Full control over onboarding, navigation, update UX, and dependency packaging.
- Can reduce inherited VS Code complexity over time.

### Costs

- Rebuilds a large amount of currently working infrastructure.
- Existing extension/webview assumptions may not transfer cleanly.
- Does not automatically solve agent/runtime architecture; that still needs Path A or B from the runtime bundling analysis.
- Too large for Sprint 57 unless scoped as research only.

### Best Use

Consider after Windows onboarding is stable and the agent runtime direction is chosen.

## Option E: Tauri Shell

### Benefits

- Smaller app footprint is possible.
- Stronger native packaging story for some use cases.

### Costs

- Highest migration risk.
- VS Code extension host and workbench behavior do not map directly.
- Requires rethinking editor embedding, native dialogs, filesystem, updates, and extension services.

### Best Use

Not recommended for Sprint 57. Treat as a separate product architecture research project if app size becomes the dominant constraint.

## Option F: Hybrid Custom Shell + VS Code Server

### Benefits

- Might preserve parts of VS Code service behavior while allowing a custom UI.

### Costs

- Complex, uncertain, and likely harder to support than either staying on VS Code OSS or fully separating.
- Onboarding problems still need separate fixes.

### Best Use

Not recommended unless a future technical spike proves a specific advantage.

## Recommendation

Do not make Sprint 57 a full shell migration.

Recommended sequence:

1. **Phase 1:** Fix Workspace Trust and Claude auth truthfulness in the current fork.
2. **Phase 2:** Use the analysis docs to decide agent runtime direction.
3. **Phase 3:** Implement selected Path A: bundled Claude/Codex runtimes. Keep the VS Code OSS shell during this phase.
4. **Later sprint:** Revisit shell separation only after the Windows onboarding and agent runtime paths are stable.

The strategic direction should be **less external runtime dependency first, less VS Code shell dependency later**.

## Decision Gate

Before Phase 3, Jarmo should choose one:

- **Path A:** keep VS Code OSS and bundle Claude/Codex runtimes. **Selected for Sprint 57.**
- **Path B:** keep VS Code OSS and replace external Codex CLI with an in-process OpenAI agent.
- **Path C:** ship Phase 1 only and split Codex architecture into a new sprint.

Shell separation should not be selected as Sprint 57 Phase 3 unless the sprint is explicitly re-scoped away from Windows onboarding.

## Follow-Up Work If Separation Remains Interesting

- Quantify patch maintenance: count active patches, conflict rate, and upstream sync time.
- Quantify product cost: first-run friction, app size, startup time, and hidden VS Code concepts.
- Prototype one document-open/edit/save flow outside VS Code OSS before committing to migration.
- Decide whether TipTap, Monaco, or a hybrid editor model is the real target.
