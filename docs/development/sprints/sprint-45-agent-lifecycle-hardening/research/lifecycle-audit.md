# Lifecycle Audit

## Summary

The sprint begins with an audit because the bug is not isolated to one component.

Affected layers:

- Claude SDK integration
- extension-side session lifecycle
- webview store and rendering
- plan approval semantics
- Codex protocol capability mapping

## Audit Outcome

### Claude

- `AskUserQuestion` support exists in the SDK, but Ritemark was not surfacing it to the sidebar.
- `ExitPlanMode` approval must be handled as a pending tool interaction, not as a new user prompt.
- Plan content should be tracked as explicit lifecycle state.
- Implementation now follows that model in the sidebar bridge and store; remaining risk is runtime validation of approve/reject/cancel transitions.
- Reproduced runtime bug: `onPlanApproval` and `onQuestion` were emitted before the pending resolver state was registered, so immediate answers could be dropped.
- Reproduced SDK integration detail: approved `ExitPlanMode` should return `updatedInput: input`; omitting it is risky because the SDK docs show the original input should be forwarded on allow decisions.

### Codex

- Current `codex app-server` protocol in this repo exposes approvals and turn events.
- Fresh audit correction: the installed Codex CLI `0.114.0` can generate a richer app-server protocol than the simplified subset checked into this repo.
- A local `codex app-server generate-ts --out <tmpdir>` run includes `item/tool/requestUserInput`, `turn/plan/updated`, and `item/plan/delta`.
- So the current Codex lifecycle gap is partly in Ritemark's stale protocol/client layer, not purely in the dependency.
- Ritemark should not pretend the providers are identical, but it also should not keep assuming Codex lacks lifecycle features that the current CLI may already expose.

### MCP

- Claude MCP loading was blocked by our own SDK launch options: `settingSources: ['project']` excluded user/local MCP config, so user-scope servers like `pencil` never appeared in the session.
- Fix direction is to load `user`, `project`, and `local` by default, while still allowing overrides.
- Codex MCP configuration follows a different model: official materials point to `~/.codex/config.toml`, and project-specific MCP support is still an open gap in the Codex repo.

## Mandatory Rule For This Sprint

No more lifecycle implementation should be treated as ad hoc patching.

Every change must be checked against the target lifecycle:

1. enter running turn
2. optionally enter plan mode
3. optionally ask questions
4. optionally request plan approval
5. exit plan mode correctly
6. continue in the same turn
7. finish with a stable final result

## Reference

Use the main analysis doc as the source of truth:

- `/Users/jarmotuisk/Projects/ritemark-native/docs/development/analysis/2026-03-17-agent-lifecycle-planmode-analysis.md`
