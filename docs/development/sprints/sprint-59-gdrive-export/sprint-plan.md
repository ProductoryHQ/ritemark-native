# Sprint 59: Google Drive Export

## Goal

Ship MVP Google Drive export: users can publish any markdown file as a Google Docs document from the Export menu, with OAuth connect/disconnect in Settings → Connections, conflict detection on re-export, and full Word/PDF v2 content parity.

---

## Feature Flag Check

- [x] This sprint needs a feature flag.
  - First external OAuth integration in the codebase — kill-switch is required
  - Feature is non-functional until a GCP `client_id` is embedded; experimental default (OFF) protects users from a broken Connect button until the integration is ready for general use
  - Flag: `gdrive-export` | status: `experimental` | platforms: all

---

## Success Criteria

- [ ] User can connect Google Drive via OAuth from Settings → Connections; email displayed after connect
- [ ] User can disconnect; tokens fully cleared from SecretStorage
- [ ] "Export to Google Drive" appears in Export menu (gated by `gdrive-export` flag)
- [ ] First export creates a new Google Docs file and writes `gdrive_doc_id`, `gdrive_doc_url`, `gdrive_modified_time`, `gdrive_exported_at` to frontmatter
- [ ] Subsequent export updates the same file (identified by `gdrive_doc_id`)
- [ ] If Google Docs version is newer than `gdrive_modified_time`, user is prompted "Overwrite?" before proceeding
- [ ] "Open in Google Docs" menu item appears (conditional on `gdrive_doc_id` present) and opens the correct URL
- [ ] All 11 Word/PDF v2 content elements render correctly in the exported Google Doc (parity audit)
- [ ] Error states handled gracefully: 401 auto-refresh, 403 reconnect prompt, 404 re-create, 429/5xx retry with backoff, offline toast without frontmatter mutation
- [ ] Feature flag `gdrive-export` gates all UI and extension-host code paths
- [ ] `npx tsc --noEmit` passes with no errors

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `src/gdrive/` module (8 files) | auth, tokenStore, client, exporter, conflictDetector, htmlRenderer, types, index |
| Feature flag `gdrive-export` | Defined in `flags.ts`; `experimental`; VS Code setting `ritemark.experimental.gdriveExport` |
| Settings → Connections section | Connect/Disconnect UI in `RitemarkSettings.tsx` |
| Export menu additions | "Export to Google Drive" + "Open in Google Docs" in `ExportMenu.tsx` |
| Extension wiring | Commands registered in `extension.ts`; message handlers in `ritemarkEditor.ts` and `RitemarkSettingsProvider.ts`; `googleapis` in `package.json` |
| User guide | `docs/user/google-drive-export.md` |

---

## Implementation Checklist

### Sub-phase A: Auth + Settings (~2 days)

- [ ] **GCP prerequisite** — Jarmo provides `client_id` (see prerequisites below)
- [ ] Add `googleapis@^144.0.0` to `extensions/ritemark/package.json` dependencies; run `npm install`
- [ ] Add `gdrive-export` flag to `extensions/ritemark/src/features/flags.ts` (experimental, all platforms)
- [ ] Add VS Code setting `ritemark.experimental.gdriveExport` to `package.json` contributes.configuration
- [ ] Create `src/gdrive/types.ts` — `StoredTokens`, `GDriveExportResult`, `GDriveConnectionStatus` interfaces
- [ ] Create `src/gdrive/tokenStore.ts` — SecretStorage wrapper (model: `apiKeyManager.ts:22`); expose `store()`, `get()`, `delete()`, `hasConnection()`, `connectionChanged` event
- [ ] Create `src/gdrive/auth.ts` — loopback OAuth server on `127.0.0.1:0`, PKCE S256, state CSRF, 5-min timeout, decode `id_token` for email; embed `client_id`
- [ ] Create `src/gdrive/index.ts` — re-export public surface
- [ ] Add `gdrive:connect`, `gdrive:disconnect`, `gdrive:status` message handlers to `RitemarkSettingsProvider.ts`
- [ ] Wire `tokenStore` init in `extension.ts` (pass `context.secrets`)
- [ ] Add Connections section to `RitemarkSettings.tsx` (Connected / Not connected states; Connect / Disconnect buttons)
- [ ] Send `features:state` with `gdrive-export` flag and connection status to webview on init
- [ ] Manual test: Connect → email shown → Disconnect → state cleared

### Sub-phase B: Export pipeline (~2 days)

- [ ] Create `src/gdrive/htmlRenderer.ts` — identify exact import path for the existing HTML pipeline; wrap it so `exporter.ts` gets a complete HTML string with data-URL images and Mermaid PNGs
- [ ] Create `src/gdrive/client.ts` — `googleapis` OAuth2Client factory; wire `tokens` event → `tokenStore.store()` for automatic refresh persistence
- [ ] Create `src/gdrive/conflictDetector.ts` — fetch remote `modifiedTime`, compare against `gdrive_modified_time` in frontmatter, return `{ conflict: boolean, remoteTime: string }`
- [ ] Create `src/gdrive/exporter.ts` — full `exportToGDrive(document)` flow:
  - Check token (no token → send `gdrive:notConnected`)
  - Extract frontmatter + content
  - Render HTML via `htmlRenderer.ts`
  - Build OAuth2Client + Drive client via `client.ts`
  - CREATE or UPDATE (`gdrive_doc_id` branch)
  - Conflict check before UPDATE (prompt "Overwrite?" / "Cancel")
  - Write back four flat frontmatter keys via existing `WorkspaceEdit` flow (`ritemarkEditor.ts:299`)
  - Send `gdrive:exportSuccess` with `webViewLink`
- [ ] Add `gdrive:export` and `gdrive:openInDocs` message handlers to `ritemarkEditor.ts`
- [ ] Register `ritemark.exportToGDrive` command in `extension.ts`
- [ ] Add "Export to Google Drive" item to `ExportMenu.tsx` (spinner during export, 2s green check on success, tooltip when not connected)
- [ ] Add "Open in Google Docs" item to `ExportMenu.tsx` (conditional on `gdrive_doc_id` in current document properties)
- [ ] Implement error handling matrix in `exporter.ts`:
  - 401 — `googleapis` auto-refresh; on failure clear tokens + `gdrive:notConnected`
  - 403 `insufficientFilePermissions` — clear tokens, send `gdrive:notConnected`
  - 404 `notFound` — remove `gdrive_doc_id` from frontmatter, re-run CREATE
  - 429 / 5xx — exponential backoff: 2s, 4s, 8s; 3 retries; then error toast
  - Network error — "No internet connection" toast; do not mutate frontmatter
- [ ] Manual test: first export creates file + frontmatter written; second export updates same file

### Sub-phase C: Polish (~1 day)

- [ ] Manual parity audit: export a document containing all 11 element types (see analysis §2); verify each renders correctly in Google Docs
- [ ] Manual conflict test: export → edit in Docs in browser → export again → "Overwrite?" prompt appears
- [ ] Manual auth-edge test: revoke app permissions in Google Account settings → next export triggers clean reconnect prompt
- [ ] Manual offline test: disable network mid-export → graceful error toast, frontmatter unchanged
- [ ] Write `docs/user/google-drive-export.md` (setup, connect, export, re-export, disconnect, known limitations)
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Final review: no `console.log` debug statements, no TODO comments in shipped code

---

## Feature Flag Implementation

### `src/features/flags.ts` addition

```typescript
'gdrive-export': {
  id: 'gdrive-export',
  label: 'Google Drive Export',
  description: 'Export markdown files as Google Docs via Google Drive',
  status: 'experimental',
  platforms: ['darwin', 'win32', 'linux'],
},
```

`FlagId` union type must also include `'gdrive-export'`.

### `package.json` setting

```json
"ritemark.experimental.gdriveExport": {
  "type": "boolean",
  "default": false,
  "description": "Enable Google Drive export (requires Google Cloud project setup)"
}
```

### Gate points

- `extension.ts` — only register `ritemark.exportToGDrive` command if `isEnabled('gdrive-export')`
- `RitemarkSettingsProvider.ts` — only handle `gdrive:connect/disconnect/status` if `isEnabled('gdrive-export')`
- `RitemarkSettings.tsx` — render Connections section only when `features['gdrive-export']` is true
- `ExportMenu.tsx` — render "Export to Google Drive" and "Open in Google Docs" items only when `features['gdrive-export']` is true

---

## Frontmatter Contract

Four flat keys written to document frontmatter after every successful export:

| Key | Source | Purpose |
|-----|--------|---------|
| `gdrive_doc_id` | `result.id` from Drive API | Canonical identifier; drives CREATE vs UPDATE logic |
| `gdrive_doc_url` | `result.webViewLink` | Cached URL so "Open in Docs" needs no API call |
| `gdrive_modified_time` | `result.modifiedTime` (Drive server time) | Conflict detection before next update |
| `gdrive_exported_at` | `new Date().toISOString()` (client time) | UI display ("Exported 5 minutes ago") |

---

## Error Handling Matrix

| HTTP status | Meaning | Behavior |
|-------------|---------|---------|
| 401 | Access token expired | `googleapis` auto-refreshes via refresh token; on failure clear tokens + reconnect prompt |
| 403 `insufficientFilePermissions` | User revoked app permissions | Clear tokens; send `gdrive:notConnected`; show "Reconnect in Settings" |
| 404 `notFound` | Drive file deleted or ownership changed | Remove `gdrive_doc_id` from frontmatter; re-run CREATE flow |
| 429 / 5xx | Rate limit / server error | Exponential backoff: 2s, 4s, 8s; 3 retries; then error toast |
| Network error | Offline | "No internet connection" toast; frontmatter not mutated |

---

## Test Plan

| Test | Type | Pass condition |
|------|------|---------------|
| Connect → email shown → Disconnect → state cleared | Manual | UI reflects each state transition correctly |
| Export new file → frontmatter written with all 4 keys | Manual | `gdrive_doc_id`, `gdrive_doc_url`, `gdrive_modified_time`, `gdrive_exported_at` all present |
| Re-export same file → same `gdrive_doc_id` in Drive | Manual | No duplicate files created in My Drive |
| All 11 content elements render in Docs | Manual parity | Headings, lists, code, blockquote, table, image, Mermaid PNG all visible |
| Edit in Docs then re-export → Overwrite prompt | Manual | Warning dialog appears; Cancel aborts without overwrite |
| Revoke app permissions → re-export | Manual | Clean error + "Reconnect in Settings" prompt |
| Network offline mid-export | Manual | Error toast; frontmatter unchanged |
| Feature flag OFF → UI hidden | Manual | No Connections section, no Drive menu items when flag is disabled |
| `npx tsc --noEmit` | Automated | Zero type errors |
| `tokenStore` unit test with mocked SecretStorage | Unit (Vitest) | store/get/delete/hasConnection behave correctly |
| `exporter` unit test with mocked Drive client | Unit (Vitest) | CREATE path, UPDATE path, conflict abort path all tested |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| HTML→Docs edge cases (deeply nested lists) | Visual difference vs PDF/Word | Accepted for MVP; document in user guide under "Known limitations" |
| "Unverified app" OAuth warning screen | User friction during testing | Testing mode (up to 100 users) sufficient for MVP |
| File >5MB HTML body | Potential upload failure | Use stream body; `googleapis` auto-activates resumable upload |
| Refresh token revoked externally | User must reconnect | 401 catch → clear tokens → reconnect prompt |
| Sprint 58 merge conflict in `RitemarkSettings.tsx` | Phase 3 blocked | Verify Sprint 58 diff before starting development |
| `client_id` not available at Phase 3 start | Auth cannot be tested | Jarmo must complete GCP setup first (see prerequisites) |

---

## Rollback Plan

The `gdrive-export` feature flag is `experimental` and defaults to OFF. If a critical bug is discovered after release:

1. Set `status: 'disabled'` in `flags.ts`
2. The Connect button, Export item, and all message handlers are immediately inert
3. No frontmatter already written is affected (keys are inert without the feature active)
4. No VS Code core changes were made — full rollback is a single `flags.ts` edit + extension-only release

---

## Release Type

Extension-only (`X.Y.Z-ext.N`). No VS Code core changes, no patch changes.

---

## Prerequisites Before Phase 3 Can Start

**Jarmo must complete the following before implementation begins:**

- [ ] Google Cloud Console: create project, enable Drive API, configure OAuth consent screen, create Desktop app OAuth client ID
- [ ] Provide `client_id` to Claude — it will be hardcoded in `src/gdrive/auth.ts`
- [ ] Sprint 58 merged to main (or confirm no structural changes to `RitemarkSettings.tsx` / `ExportMenu.tsx`)

---

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** YES

---

## Approval

- [ ] Jarmo approved this sprint plan
