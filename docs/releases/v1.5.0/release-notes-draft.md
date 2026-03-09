# Ritemark v1.5.0 — Release Notes (DRAFT)

**Target Version:** 1.5.0
**Drafted:** 2026-03-08
**Status:** DRAFT — scope assembled from implemented work, still pending final release cut

---

## Summary

Ritemark v1.5.0 is the next planned full release. It currently combines two major tracks:

- **Sprint 41:** VS Code foundation update from `1.94.0` to `1.109.5`
- **Sprint 42:** update-platform and agent-bootstrap hardening, including Codex and Claude reliability work

## Confirmed Scope So Far

### VS Code Upstream Update (Sprint 41)

- Updated the bundled VS Code OSS base to `1.109.5`
- Revalidated the Ritemark patch stack against the new upstream
- Fixed upgrade regressions found during smoke testing
- Preserved Ritemark-specific layout and branding behavior

### Unified Update Platform (Sprint 42)

- added canonical update feed generation and compatibility-aware update resolution
- added Settings `Update Center` with clearer update actions and status
- separated full app updates from extension-only updates in the user-facing model
- made voice model, Claude, and Codex readiness visible in Settings

### Claude and Codex Hardening

- Claude and Codex now expose explicit install/auth states instead of optimistic booleans
- Settings now includes dedicated account/setup surfaces for `Claude.ai` and `ChatGPT`
- sidebar setup/recovery flows are simpler and action-first
- fixed Codex screenshot/image delivery to the agent
- removed per-image token estimation from Codex chat attachments

## Open Items

- finalize end-user wording and screenshots for release notes
- complete final local release QA on macOS and Windows 11
- attach real installer/download links once artifacts exist

### Technical Details

- Base: VS Code OSS `1.109.5`
- Update model: canonical feed + compatibility resolver
- Agent auth scope in UI: `Claude.ai`, `Anthropic API key`, `ChatGPT`

### Sprint Credits

- Sprint 41: VS Code Upstream Update
- Sprint 42: Unified Update Platform
