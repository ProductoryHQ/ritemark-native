# Sprint 59: Google Drive Export — Phase 1 Discovery

**Date:** 2026-05-03
**Source:** `docs/development/analysis/2026-05-02-gdrive-export.md` (synthesized PM + ENG analysis)
**Status:** Complete — all decisions locked in analysis doc

---

## Sprint Goal

Enable users to export any markdown file as a Google Docs document directly from the Export menu, with automatic create-or-update behavior tracked via flat frontmatter keys.

---

## Scope (MVP, locked)

### In scope

- Settings → Connections section (Connect / Disconnect Google Drive)
- Export menu: "Export to Google Drive" item
- Export menu: "Open in Google Docs" conditional item (when `gdrive_doc_id` present)
- Word/PDF v2 parity via HTML pipeline reuse (all 11 element types)
- Conflict detection before overwrite (`gdrive_modified_time` comparison)
- Flat frontmatter keys: `gdrive_doc_id`, `gdrive_doc_url`, `gdrive_modified_time`, `gdrive_exported_at`
- Error handling: 401 (auto-refresh), 403, 404, 429/5xx, offline
- Feature flag `gdrive-export` (experimental, default OFF)

### Explicitly out of scope (Phase B+)

- Two-way sync
- Drive Picker dialog for folder selection
- Auto-export on save (`gdrive_auto_export` frontmatter key)
- Sharing opt-in (`gdrive_share_with`)
- Docs API `documents.batchUpdate` precision fallback (Phase C)
- `gdrive_folder_id` frontmatter key
- Google verification / production OAuth consent (post-MVP)

---

## Technical Decisions (locked — do not re-litigate)

| Decision | Choice | Reason |
|----------|--------|--------|
| Conversion strategy | HTML pipeline reuse (`exportToPDFV2` / `exportToWordV2`) | Local images and Mermaid PNGs already resolved as data URLs; server-side markdown conversion would lose them |
| OAuth flow | Loopback IP (`http://127.0.0.1:0`) + PKCE S256 | RFC 8252 standard for desktop apps; no client_secret needed |
| OAuth scope | `drive.file` + `openid email` | Minimal permissions; Ritemark can only access files it creates |
| Token storage | `vscode.SecretStorage` | Matches existing `apiKeyManager.ts` pattern |
| Frontmatter format | Flat snake_case (`gdrive_*` prefix) | Properties UI does not support nested objects |
| Drive SDK | `googleapis@^144` | Auto-refresh, TypeScript types, resumable uploads |
| Upload format | `text/html` → `application/vnd.google-apps.document` | Google converts HTML to Docs natively |
| Large file handling | Stream body | `googleapis` auto-activates resumable upload for streams |
| Update strategy | `files.update` (overwrite) + conflict prompt | Compare `gdrive_modified_time` before overwrite |

---

## Codebase Dependencies

### New files (extension host)

```
extensions/ritemark/src/gdrive/
  index.ts             public API surface
  auth.ts              OAuth loopback + PKCE + state CSRF
  tokenStore.ts        SecretStorage wrapper (model: apiKeyManager.ts:22)
  client.ts            googleapis Drive client factory
  exporter.ts          exportToGDrive() entry point
  conflictDetector.ts  modifiedTime comparison + Overwrite prompt
  htmlRenderer.ts      reuses existing HTML pipeline
  types.ts             StoredTokens, GDriveExportResult interfaces
```

### Modified files (extension host)

```
extensions/ritemark/src/extension.ts                    register commands + init tokenStore
extensions/ritemark/src/ritemarkEditor.ts               add gdrive:* message handlers
extensions/ritemark/src/settings/RitemarkSettingsProvider.ts  gdrive:connect/disconnect/status
extensions/ritemark/src/features/flags.ts               add gdrive-export flag
extensions/ritemark/package.json                        + commands + googleapis dependency
```

### Modified files (webview)

```
extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx  new Connections section
extensions/ritemark/webview/src/components/header/ExportMenu.tsx           2 new items
```

### New files (docs)

```
docs/user/google-drive-export.md   user-facing guide (Phase 3 Polish sub-phase)
```

### No patch changes

Extension-only sprint — `patches/vscode/` and `vscode/` submodule untouched.

---

## Existing Pattern References

| Pattern | Location | Used for |
|---------|----------|---------|
| SecretStorage wrapper | `src/ai/apiKeyManager.ts:22` | `tokenStore.ts` model |
| HTML export pipeline | `src/` (exportToPDFV2 / exportToWordV2) | `htmlRenderer.ts` reuse |
| WorkspaceEdit for document update | `src/ritemarkEditor.ts:299` | frontmatter write-back |
| Feature flag definition | `src/features/flags.ts` | `gdrive-export` flag |
| Settings message handler | `src/settings/RitemarkSettingsProvider.ts` | gdrive connect/disconnect |

---

## Feature Flag Decision

**YES — add `gdrive-export` as `experimental` (default OFF).**

Rationale:
- First external OAuth integration in the codebase — kill-switch warranted
- Feature is non-functional until `client_id` is configured in GCP and embedded in `auth.ts`
- Experimental default protects users who haven't set up GCP from a broken Connect button

Flag spec:

```
id: 'gdrive-export'
label: 'Google Drive Export'
description: 'Export markdown files as Google Docs via Google Drive'
status: 'experimental'
platforms: ['darwin', 'win32', 'linux']
```

VS Code setting: `ritemark.experimental.gdriveExport` (boolean, default false)

Promotion path: `experimental` → `stable` after Google OAuth consent screen passes production verification and one full release cycle completes without issues.

---

## Dependencies on Other Sprints

- **Sprint 58** (design-agents-skills-ui): No code overlap expected. Sprint 59 adds a new section to `RitemarkSettings.tsx` before API Keys — verify Sprint 58 does not restructure that file before starting Phase 3.

---

## Google Cloud Console Prerequisites (Jarmo must complete before Phase 3)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select project "Ritemark Native"
3. APIs & Services → Library → enable **Google Drive API**
4. APIs & Services → OAuth consent screen:
   - User type: External
   - App name: Ritemark Native
   - Scopes: `https://www.googleapis.com/auth/drive.file`, `openid`, `email`
   - Test users: Jarmo + any other testers
5. APIs & Services → Credentials → Create credentials → **OAuth client ID**
   - Application type: **Desktop app**
   - Name: Ritemark Native (Desktop)
6. Copy the `client_id` and provide it to Claude before Phase 3 — it goes hardcoded into `auth.ts`

The `client_id` is safe to commit (Desktop app + PKCE; no `client_secret`).

---

## Assumptions

- HTML export pipeline is callable from extension-host code without webview round-trips. Exact import path to verify in Phase 3.
- `vscode.SecretStorage` is available in extension context (confirmed: used by `apiKeyManager.ts`).
- `ritemarkEditor.ts` has an extensible `onDidReceiveMessage` dispatcher.
- Sprint 58 does not structurally refactor `RitemarkSettings.tsx` or `ExportMenu.tsx`.
- `googleapis` is pure JS — no native bindings; installs on arm64 without issue.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| HTML→Docs edge cases (deeply nested lists) | Visual difference vs PDF/Word | Accepted for MVP; Phase C is `documents.batchUpdate` |
| "Unverified app" OAuth warning | User friction | Testing mode (up to 100 users) fine for MVP |
| File >5MB HTML body | Upload failure | Stream body; `googleapis` activates resumable automatically |
| Refresh token revoked externally | User must reconnect | 401 catch → delete tokens → "Reconnect in Settings" toast |
| Conflict on multi-device edit | Silent overwrite | `gdrive_modified_time` check + Overwrite prompt covers 80% |
| Sprint 58 merge conflict in `RitemarkSettings.tsx` | Phase 3 blocked | Verify diff before starting development |
