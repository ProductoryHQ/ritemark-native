## [1.5.0] - 2026-03-15

### Added
- Settings `Update Center` with manual check, update actions, and component readiness
- Dedicated `Claude Account` and `ChatGPT Account` sections in Settings
- Compatibility-aware update feed and resolver implementation
- Claude/Codex setup recovery surfaces in the AI sidebar
- Branded Ritemark welcome page with launch check panel and quick-action buttons
- Windows AI bootstrap hardening: .cmd/.exe shim resolution, prerequisite checks
- New AI Agents documentation guide

### Changed
- **VS Code upstream update (Sprint 41):** Base updated from `1.94.0` to `1.109.5`
- Update handling now resolves the correct next action from canonical release metadata instead of relying only on `latest`
- Claude and Codex setup/auth flows now use explicit state models across Settings and sidebar
- Windows CI workflow restored and hardened with deterministic installs

### Fixed
- Claude chat "spawn EINVAL" on Windows by resolving .cmd wrappers to underlying cli.js
- Claude and Codex binary detection on Windows (filtering unusable shell script shims)
- Claude install file lock when clicking Install/Repair multiple times
- Codex approval dialog -- 4 bugs blocking all user approvals
- Codex screenshot/image attachments now reach the agent instead of failing with `missing field 'url'`
- Removed misleading image token estimates from Codex attachment UI
- Claude and Codex broken-install states no longer masquerade as healthy installs
- Claude logout and auth-state propagation now stay in sync between Settings and sidebar
- CSV editor column headers no longer block sorting; destructive column actions now live behind a dedicated header action menu
