# Sprint 106 Scenarios (★ = live-validated 2026-08-04)

- ★ Home tab appears persistently in the Activity Bar (fresh profile, Welcome untouched)
- ★ Primary action reads "New document / Markdown (.md)" and invokes `ritemark.newDocument` (created + opened an untitled .md)
- ★ Quick actions render: New AI task (`ritemark.newChat`), Open document…, New table (`ritemark.newTable`), Open folder… — all existing commands, no duplicate creation logic
- ★ Recent documents list = most recently modified workspace .md files (existing filesystem source; pricing post listed first after edits)
- ★ Kill-switch: with `ritemark.features.home-launcher` false the view renders a one-line disabled notice (verified live before the config default landed)
- No-folder state: explanatory copy + "Open folder…" only (code path; verify in Gate walk)
- Command allow-list: the webview can only trigger the fixed launcher commands (`_isAllowedCommand`)
- Placement: extension-contributed (appears after built-in entries). Exact first-position pinning would need a shell patch — NOT taken, per the approved escalation rule.
