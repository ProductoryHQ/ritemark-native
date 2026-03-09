## [1.5.0] - 2026-XX-XX

### Added
- Settings `Update Center` with manual check, update actions, and component readiness
- dedicated `Claude Account` and `ChatGPT Account` sections in Settings
- compatibility-aware update feed and resolver implementation
- Claude/Codex setup recovery surfaces in the AI sidebar

### Changed
- **VS Code upstream update (Sprint 41):** Base updated from `1.94.0` to `1.109.5`
- update handling now resolves the correct next action from canonical release metadata instead of relying only on `latest`
- Claude and Codex setup/auth flows now use explicit state models across Settings and sidebar

### Fixed
- Codex screenshot/image attachments now reach the agent instead of failing with `missing field 'url'`
- removed misleading image token estimates from Codex attachment UI
- Claude and Codex broken-install states no longer masquerade as healthy installs
- Claude logout and auth-state propagation now stay in sync between Settings and sidebar
