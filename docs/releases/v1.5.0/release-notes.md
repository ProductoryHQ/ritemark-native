# Ritemark v1.5.0

**Released:** 2026-03-15
**Type:** Full release
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.5.0)

## Highlights

Ritemark v1.5.0 is a foundation-and-reliability release. It upgrades the VS Code base to `1.109.5`, adds a proper Update Center, redesigns the welcome experience, and makes AI agent setup much more reliable -- especially on Windows.

## What's New

### VS Code Upstream Update (Sprint 41)

- New upstream base: VS Code OSS `1.109.5`
- Patch stack revalidated on the new base
- Upgrade regressions fixed during smoke testing

### Unified Update Platform (Sprint 42)

- Canonical update feed generation and feed-based update resolution
- New `Update Center` in Settings with manual check, install/download, skip, pause, resume, and restart-required handling
- Full-release vs extension-update handling is now compatibility-aware instead of `latest`-only
- Component readiness cards for voice model, Claude, and Codex

### Welcome Page and Onboarding (Sprint 43)

- New branded Ritemark welcome page with quick-action buttons
- Launch check panel showing Claude, ChatGPT, Git, and Node status at a glance

### Claude and Codex Reliability

- Dedicated `Claude Account` and `ChatGPT Account` boxes in Settings
- Broken install, needs-auth, auth-in-progress, and ready states are handled explicitly in the sidebar and Settings
- Claude install/login/logout state now refreshes automatically across surfaces
- Codex pasted screenshots and image attachments are now delivered correctly to the agent
- Removed misleading image token estimation UI from Codex chat input

### Windows AI Bootstrap Hardening (Sprint 44)

- Claude and Codex binaries detected reliably on Windows (resolves .cmd/.exe shims)
- Claude chat "spawn EINVAL" fixed by resolving .cmd wrappers to their underlying cli.js
- Install file lock prevention for concurrent install attempts
- Environment prerequisite checks for Git, PowerShell, and Node.js

## Support

**Issues:** [GitHub Issues](https://github.com/jarmo-productory/ritemark-public/issues)
**Documentation:** [docs/](https://github.com/jarmo-productory/ritemark-public)
