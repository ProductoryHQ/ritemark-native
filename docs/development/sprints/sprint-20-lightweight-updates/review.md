# Sprint 20 Review: Lightweight Extension-Only Updates

## Findings (ordered by severity)

1) App bundle writes break code signing
- Updating files under `Ritemark.app/Contents/Resources/app/extensions/ritemark` will invalidate the app signature and can trigger Gatekeeper or launch failures on macOS.
- This is incompatible with a "production macOS builds" success criterion unless the app is re-signed after update or the update target moves outside the bundle.

2) Backup location mismatch
- The plan uses `app.getPath('userData')` for backups, but the locked decision says "app bundle parent directory."
- This mismatch can cause restore failures or leave stale backups across updates.

3) Write permissions and elevation are underspecified
- App bundles installed under `/Applications` are often read-only for non-admin users.
- The plan needs an explicit fallback path when write access fails, beyond "check permissions."

4) Manifest authenticity
- The manifest is only protected by HTTPS and per-file hashes; the manifest itself is unsigned.
- A compromised release could redirect downloads with matching hashes; consider signing the manifest or pinning to expected asset IDs.

5) Downgrade and type mismatch handling
- The version comparison and update type detection should explicitly prevent downgrades and reject mismatched `type` vs version format.

## Suggested Solution (extension updates without touching the app bundle)

### A) Install updates to user extension directory

- Use the user extension location (e.g. `~/Library/Application Support/<app>/extensions/`) instead of the app bundle.
- Keep the bundled extension as a fallback baseline.
- VS Code already prioritizes user extensions over bundled ones; leverage that ordering.

Suggested layout:
```
<userData>/extensions/
└── ritemark-1.0.1-ext.5/
    ├── out/
    ├── media/
    └── package.json
```

### B) Use VS Code extension management APIs when possible

- If the fork exposes extension management services, use them to install/update.
- Otherwise, implement a minimal "folder install" that mirrors VS Code's expected structure and metadata.

### C) Manifest adjustments

- Add `installType: "user-extension"` to distinguish from full updates.
- Include `extensionId` and `extensionVersion` (already present) and an `extensionDirName` to avoid ambiguity.
- Optional: include a signed `manifest.sig` or embed a signature field for verification.

### D) Update flow changes

1. Fetch manifest
2. Determine update type (full vs extension)
3. If extension update:
   - Download to a staging directory in userData
   - Verify SHA-256 checksums
   - Move into `<userData>/extensions/ritemark-<version>`
   - Remove previous user extension version (optional, keep one backup)
   - Prompt "Reload Window"
4. If full update:
   - Open DMG (existing flow)

### E) Backup / rollback strategy (user space)

- Backup is optional if the update writes to a new versioned folder.
- On failure, delete the staging folder and keep the previous version intact.
- On success, keep the previous version for one launch and delete after a successful load.

## Required Plan Changes

- Replace app bundle update target with the user extension directory.
- Align backup location with the new strategy (userData staging + versioned installs).
- Add explicit downgrade protection and manifest authenticity checks.
- Update success criteria to reflect the new update target and fallback behavior.

## Open Questions

- What is the exact user extension path for this build (do you already set a custom `userData` or `extensions` dir)?
- Do you want to support signed manifest verification in this sprint, or defer to a follow-on?

