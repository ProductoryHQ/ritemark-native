# Ritemark v1.5.0

**Status:** In progress  
**Type:** Full release  
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.5.0)

## Highlights

Ritemark v1.5.0 is shaping up as a foundation-and-reliability release:

- VS Code base update from `1.94.0` to `1.109.5`
- new compatibility-aware update platform in Settings
- much stronger Claude and Codex install/auth recovery UX
- Codex screenshot/image attachments now reach the agent correctly

## What's New

### VS Code Upstream Update (Sprint 41)

- New upstream base: VS Code OSS `1.109.5`
- Patch stack revalidated on the new base
- Upgrade regressions fixed during smoke testing

### Unified Update Platform (Sprint 42)

- canonical update feed generation and feed-based update resolution
- new `Update Center` in Settings with manual check, install/download, skip, pause, resume, and restart-required handling
- full-release vs extension-update handling is now compatibility-aware instead of `latest`-only
- component readiness cards for voice model, Claude, and Codex

### Claude and Codex Reliability

- dedicated `Claude Account` and `ChatGPT Account` boxes in Settings
- broken install, needs-auth, auth-in-progress, and ready states are handled explicitly in the sidebar and Settings
- Claude install/login/logout state now refreshes automatically across surfaces
- Codex setup/auth state is clearer and less noisy for normal users
- Codex pasted screenshots and image attachments are now delivered correctly to the agent
- removed misleading image token estimation UI from Codex chat input

## Support

**Issues:** [GitHub Issues](https://github.com/jarmo-productory/ritemark-native/issues)  
**Documentation:** [docs/](https://github.com/jarmo-productory/ritemark-native/tree/main/docs)
