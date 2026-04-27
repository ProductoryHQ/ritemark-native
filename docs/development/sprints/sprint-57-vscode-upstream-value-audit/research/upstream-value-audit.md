# Upstream Value Audit: VS Code 1.110-1.118

Date: 2026-04-25

## Baseline

- Ritemark local base observed in the main worktree: VS Code OSS `1.109.5`.
- Previous upstream update sprint: `docs/development/sprints/sprint-41-vscode-upstream-update/sprint-plan.md`.
- Latest official release archive observed: `1.118` is listed in the 2026 archive, with the `1.118` page last updated on April 24, 2026.
- Latest stable tag observed via `git ls-remote`: `refs/tags/1.117.0`.

Recommendation at audit start: treat `1.117.0` as the practical implementation target until a `1.118.0` tag is available and confirmed. Track `1.118` as near-term follow-up intelligence, not as the first implementation target.

Audit checkpoint after local spike:

- `vscode/` submodule initialized successfully in the Sprint 57 worktree.
- Local base confirmed from `vscode/package.json`: `1.109.5`.
- Existing patch stack baseline is healthy: `6/6` patches pass `./scripts/apply-patches.sh --dry-run` on `1.109.5`.
- Target spike on `1.117.0` produced `5` conflicting patches and `1` clean patch.
- Clean patch on `1.117.0`: `004-ritemark-build-system.patch`.
- Conflicted patches on `1.117.0`: `001`, `002`, `003`, `005`, `006`.

## Executive Summary

There is enough user-facing value to justify a new upstream update sprint, but the value is concentrated in agentic workflows rather than traditional editor chrome.

For Ritemark, the interesting upstream work is not "Copilot exists in VS Code". It is the maturing infrastructure around long-running agent sessions, permissions, debug visibility, customizations, terminal/browser tooling, image context, and local sandboxing. Those themes line up with Ritemark's document-first AI workflow and could make the app feel more trustworthy and capable if adopted selectively.

The highest-value path is:

1. Upgrade base to `1.117.0`.
2. Preserve Ritemark's existing UX invariants.
3. Cherry-pick product learnings from upstream agent UX into Ritemark features only after privacy/branding review.
4. Defer `1.118` unless a tag appears before implementation starts.

## Release Delta

| Version | Date / status | Ritemark relevance |
| --- | --- | --- |
| `1.110` | Released March 4, 2026 | Big agent platform jump: plugins, browser tools, session memory, compaction, chat fork, debug panel, accessibility, terminal images, security update. |
| `1.111` | Released March 9, 2026 | Weekly stable cadence starts. Adds agent permissions, Autopilot preview, agent-scoped hooks, debug snapshots, AI CLI terminal grouping. |
| `1.112` | Stable release page | Adds export/import debug logs, image/binary file support for agents, automatic symbol references, parent repo customization discovery, MCP sandboxing. |
| `1.113` | Stable release page | Adds customizations editor, thinking effort in model picker, image carousel improvements, nested subagents, plugin marketplace management. |
| `1.114` | Released April 1, 2026 | Adds video preview in carousel, Copy Final Response, simplified semantic workspace search, `/troubleshoot` previous sessions, TypeScript 6.0. |
| `1.115` | Released April 8, 2026 | Introduces VS Code Agents preview app in Insiders; improves integrated browser and background terminal interaction. |
| `1.116` | Stable release page | Adds previous-session debug logs, Copilot CLI thinking effort, customization welcome page, tool confirmation carousel, foreground terminal support, integrated browser entry points, built-in Copilot, agent network policies. |
| `1.117` | Released April 22, 2026 | BYOK for Copilot Business/Enterprise, incremental chat rendering, system notifications for background terminal commands, better agent CLI terminal titles, TypeScript 6.0.3. |
| `1.118` | Rolling update page, last updated April 24, 2026 | Early changes around Agents app session switching, session titles, auto model support, customization menu descriptions, TypeScript 7 nightly opt-in. No `1.118.0` tag observed at audit time. |

## Opportunity Ranking

### 1. Agent workflow control and trust

Relevant upstream changes:

- `1.110`: Agent Debug panel, session memory, manual context compaction, chat fork, agent plugins, browser tools.
- `1.111`: agent permissions, Autopilot preview, agent-scoped hooks, debug event snapshots.
- `1.112`: export/import agent debug logs and MCP sandboxing.
- `1.116`: confirmation carousel, previous-session debug logs, network-domain policies.
- `1.117`: system notifications for long-running background commands.

Ritemark value:

- Helps users understand what the assistant did and why.
- Makes longer writing/research/editing jobs safer.
- Could support a Ritemark "activity trail" or "session diagnostics" experience without inventing everything from scratch.
- Fits enterprise/admin needs if Ritemark targets teams later.

Product stance:

- Ship underlying base improvements where passive.
- Explore Ritemark-specific UX for session debug/activity history.
- Be careful with Autopilot-style autonomy; it should not silently bypass Ritemark safety expectations.

### 2. Better document and media context

Relevant upstream changes:

- `1.112`: agents can read image files and binary files; image outputs can open in a carousel.
- `1.113`: chat attachment images open in a fuller viewer.
- `1.114`: image carousel supports video previews.
- `1.115`: integrated browser pinch-to-zoom on macOS.

Ritemark value:

- Strong fit for document workflows: screenshots, exported images, PDFs converted to images, visual QA, and generated media review.
- Could make Ritemark feel more multimodal without building a full custom media browser immediately.
- Helps support visual debugging and document review loops.

Product stance:

- Explore whether upstream image/video carousel can be surfaced in Ritemark flows.
- Do not expose generic VS Code wording if it clashes with Ritemark's document-product language.

### 3. Integrated browser and terminal agent tooling

Relevant upstream changes:

- `1.110`: agentic browser tools.
- `1.115`: fewer duplicate browser tabs, long-running Playwright support, better tool labels.
- `1.116`: foreground terminal support, improved terminal input handling, integrated browser menu/shortcut entry points.
- `1.117`: custom terminal profile launch for Copilot CLI; better terminal titles for agent CLIs.

Ritemark value:

- Useful for validating web content, local previews, generated exports, and app workflows.
- Background/foreground terminal improvements may reduce reliability issues when agents run long commands.
- Better terminal titles and notifications may improve clarity in agent-heavy sessions.

Risks:

- Sprint 41 had terminal placement regressions. Any terminal-related upstream change needs explicit smoke coverage.
- Integrated browser entry points may need Ritemark menu cleanup decisions.

Product stance:

- Ship passive reliability gains.
- Audit menu/command visibility so Ritemark does not accidentally become a generic dev IDE again.

### 4. Customizations, plugins, and skills

Relevant upstream changes:

- `1.110`: agent plugins and chat-created customizations.
- `1.111`: agent-scoped hooks.
- `1.112`: parent repository customization discovery.
- `1.113`: customizations editor, plugin marketplace management, URL handlers for plugin installation.
- `1.116`: customization welcome page.
- `1.118`: descriptions in customization creator menu.

Ritemark value:

- Potentially strong if Ritemark wants user/team-specific writing agents, editorial policies, brand voice rules, or workflow packages.
- Parent-repo discovery maps well to monorepos, but Ritemark's document users may need a simpler mental model.

Risks:

- Plugin marketplaces and URL installation can be confusing or risky in a branded product.
- Needs a product decision about what customization surfaces Ritemark should own versus hide.

Product stance:

- Explore as a future Ritemark "writing policies / team instructions" layer.
- Do not enable marketplace-style discovery without trust and UX review.

### 5. Language/platform improvements

Relevant upstream changes:

- `1.110`: unified `js/ts.*` settings, Python Environments rollout, stable portable mode API, ThemeIcon for webview/custom editor tab icons.
- `1.114`: TypeScript 6.0.
- `1.117`: TypeScript 6.0.3 recovery release.
- `1.118`: TypeScript 7 nightly opt-in.

Ritemark value:

- Mostly maintenance and developer experience.
- ThemeIcon tab icons may reduce custom webview icon friction.
- Portable mode API may help future portable builds.

Product stance:

- Include in upgrade, but do not market unless it unlocks a visible Ritemark improvement.

## User-Value Shortlist

### Ship

- Better agent debug/logging foundation:
  - useful for Ritemark session diagnostics and supportability
  - low product risk if kept mostly infrastructural
- Background command clarity:
  - terminal titles and system notifications for long-running tasks help users trust agent workflows
- Image/binary context handling:
  - strong fit for screenshot review, export QA, and multimodal document work
- MCP / network / permission controls:
  - valuable for trust, enterprise posture, and calmer defaults
- Terminal reliability and browser-tooling base improvements:
  - ship as passive platform quality, not as noisy new UI

### Explore

- Ritemark-owned agent activity trail or debug history UI
- Ritemark-specific customizations / team writing policies layer
- Using upstream carousel/browser/media primitives inside flows and review workflows
- Selective exposure of integrated browser entry points where they clearly help content workflows

### Ignore For Now

- Generic Copilot positioning or marketing-style upstream AI surfaces
- Plugin marketplace-style discovery/install flows
- Autopilot-like autonomy that weakens Ritemark's safety or editorial control model
- TypeScript 7 nightly / early experimental model-selection surfaces with no user-facing Ritemark value

## Specific Ritemark Watchpoints

### Terminal placement invariant

Sprint 41 fixed terminal restoration into the editor area. Upstream terminal work in `1.115` through `1.117` is beneficial, but it also makes terminal behavior a high-risk smoke area.

Required checks:

- New window startup does not open terminal as an editor tab.
- Reload window does not restore terminal as an editor tab.
- AI/chat terminal tools do not move the panel into editor area.
- Terminal profile dropdown changes do not expose unwanted generic AI CLI affordances.

### Menu and command surface

Upstream added integrated browser entry points, plugin marketplace management, customizations commands, and Agents app commands. Ritemark should audit whether these commands belong in menus, command palette, or hidden/internal state.

Required checks:

- Ritemark menu cleanup patch still applies.
- View menu remains product-appropriate.
- Command palette does not become noisy with upstream experimental surfaces unless deliberately allowed.

### Built-in Copilot

`1.116` says GitHub Copilot Chat is now built in. In an OSS-derived branded app, this needs careful inspection:

- Does the built-in extension appear in OSS builds?
- Is it bundled into Ritemark distributions?
- Does it conflict with Ritemark's own AI sidebar or positioning?
- Are there licensing, auth, telemetry, or expectation risks?

Product stance:

- Treat as a risk and integration question, not a feature to celebrate by default.

### Patch stack size

Sprint 41 ended with six VS Code patches. Any upstream update should try to shrink custom patch surface where upstream now provides a setting/API. Candidate areas:

- webview/custom editor tab icons via ThemeIcon
- terminal behavior if upstream now has cleaner APIs/settings
- startup metadata guards if upstream OSS defaults changed
- menu/browser command visibility

## Recommended Target

Use `1.117.0` as the initial implementation target.

Reasons:

- It is a dated Stable release page: April 22, 2026.
- A matching upstream tag exists: `refs/tags/1.117.0`.
- It includes the main wave of user-value features from `1.110` through `1.117`.
- `1.118` appears to be a rolling page updated April 24, 2026, but no `1.118.0` tag was observed during this audit.

Fallback target: `1.116.0` if `1.117.0` creates patch or build instability disproportionate to the incremental value.

## Implementation Checkpoint

Upgrade spike result as of 2026-04-25:

- `1.117.0` patch stack repaired successfully.
- `001` through `006` are all applied in the Sprint 57 worktree.
- `./scripts/apply-patches.sh --dry-run` reports all patches as already applied.
- `./scripts/validate-qa.sh` passes on the upgraded tree.

Validation also surfaced two workflow-level requirements for future implementation/review work:

1. `vscode/.nvmrc` now expects Node `22.22.1`.
2. Fresh Sprint 57-style worktrees need both:
   - `extensions/ritemark` dependencies installed
   - `vscode/` dependencies installed

## Patch Spike Summary

Observed local dry-run results:

| Base | Result |
| --- | --- |
| `1.109.5` | `6/6` patches apply cleanly |
| `1.117.0` | `1/6` patches apply cleanly; `5/6` conflict |

Initial interpretation:

- The upgrade is still feasible.
- It is not a low-touch patch refresh.
- Most of the work is concentrated in branding/chrome/menu/startup patches rather than the build-system patch.
- This matches the product risk profile already suspected from release-note review: upstream changed agent/titlebar/menu/welcome/terminal surfaces materially between `1.109.5` and `1.117.0`.

## Implementation Prep Checklist

- [ ] Initialize `vscode/` submodule in sprint worktree.
- [ ] Confirm current base from `vscode/package.json` and submodule SHA.
- [ ] Fetch upstream VS Code tags.
- [ ] Create a checkpoint before moving the submodule.
- [ ] Move `vscode/` to `1.117.0`.
- [ ] Run `./scripts/apply-patches.sh --dry-run`.
- [ ] Classify patch failures before editing.
- [ ] Write up patch-risk classifications for `001`, `002`, `003`, `005`, `006`.
- [ ] Repair patches in order, smallest patch first.
- [ ] Run compile checks relevant to VS Code shell.
- [ ] Smoke test dev app startup, markdown editor, AI sidebar, terminal placement, About dialog, and menu cleanup.
- [ ] Run `./scripts/validate-qa.sh` before readiness handoff.

## Follow-Up Implementation Checklist

1. Capture a merge-ready summary of what was preserved versus intentionally changed in `002` and `003`.
2. Decide whether the worktree-local setup fixes should become scripted:
   - recreate `vscode/extensions/ritemark` link automatically
   - document or automate `extensions/ritemark` install
   - document or automate `vscode/` install
3. Add local workflow note that Sprint 57 upgrade work expects Node `22.22.1` from `vscode/.nvmrc`.
4. Run targeted smoke tests for:
   - startup and reload
   - terminal placement invariants
   - AI sidebar / auxiliary bar behavior
   - About dialog and branding
   - menu cleanup and `View > Advanced`
5. Decide which upstream agent/media/browser capabilities become explicit Ritemark product bets in the next sprint slice.

## Source Notes

- Release archive: https://code.visualstudio.com/updates/archive
- `1.110`: https://code.visualstudio.com/updates/v1_110
- `1.111`: https://code.visualstudio.com/updates/v1_111
- `1.112`: https://code.visualstudio.com/updates/v1_112
- `1.113`: https://code.visualstudio.com/updates/v1_113
- `1.114`: https://code.visualstudio.com/updates/v1_114
- `1.115`: https://code.visualstudio.com/updates/v1_115
- `1.116`: https://code.visualstudio.com/updates/v1_116
- `1.117`: https://code.visualstudio.com/updates/v1_117
- `1.118`: https://code.visualstudio.com/updates/v1_118
