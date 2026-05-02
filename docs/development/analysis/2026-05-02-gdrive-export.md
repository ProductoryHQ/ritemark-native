# Google Drive Export — Tehniline analüüs

**Kuupäev:** 2026-05-02
**Autor:** Claude (engineering)
**Sponsor:** Jarmo (PM)
**Staatus:** Analüüs / pre-sprint

* * *

## 1. User story (kokkulepitud scope)

> **Kasutajana** soovin oma markdown-faili publitseerida Google Drive'i Google Docs formaadis,
> et saaksin seda jagada inimestega, kes ei kasuta Ritemarki.
>
> - Vajutan toolbaril nuppu **Export to Google Docs**
> - Esmakordsel kasutamisel suunab Settings → Connections → Connect Google Drive
> - Kui ühendus olemas → fail uploaditakse Drive'i ja teisendatakse GDocsiks
> - Korduval ekspordil → kirjutatakse sama fail üle (Drive file ID hoitakse frontmatter'is)
> - Kui Drive ID on frontmatter'is → kuvatakse ka **Open in Google Docs** nupp

**MVP scope (Jarmo kinnitas):**
- ✅ Settings → Connections jaotis
- ✅ Open in Docs nupp
- ✅ Export markdown → Docs (one-way)
- ❌ Two-way sync (järgmine sprint)

* * *

## 2. Tehnilised otsused (ENG vastutab)

| Otsus | Valik | Põhjendus |
| --- | --- | --- |
| **OAuth flow** | Loopback IP (`127.0.0.1:0`) + PKCE | RFC 8252 standard native appidele. Google soovitatud Desktop OAuth client'iga. Localhost asemel `127.0.0.1` (firewall-safe). PKCE = pole vaja `client_secret`-i salatuna hoida. |
| **Scope** | `https://www.googleapis.com/auth/drive.file` | **Minimaalne õigus.** Annab ligipääsu AINULT failidele, mille app ise loob või mille kasutaja Drive Picker'is valib. EI saa lugeda kogu Drive'i. Privacy-first. |
| **Konversioon** | Drive API `files.create` + `mimeType: application/vnd.google-apps.document` | Üks API call. Google teeb md→Docs konversiooni serverside (toetab GFM headinguid, listid, tabelid, koodiblokke). Alternatiivid (md→HTML→Docs või Docs API batchUpdate) liiga keerulised MVP jaoks. |
| **Update vs create** | Sama endpoint, eri HTTP meetodid: `POST` uuele, `PATCH` olemasolevale (`/files/{id}`) | Standard REST muster. `googleapis` npm pakett ühtlustab `drive.files.create()` ja `drive.files.update()`. |
| **Token storage** | `vscode.SecretStorage` (OS keychain) | Sama muster, mis `apiKeyManager.ts:98` kasutab OpenAI võtme jaoks. macOS Keychain / Win Credential Manager / libsecret. **Ei kasuta** workspace state'i ega faile (turvaline, cross-workspace). |
| **File ID storage** | YAML frontmatter (`gdrive.id`) | Kood juba töötleb frontmatter'it `gray-matter`-iga (`ritemarkEditor.ts:133, 299`). Liigub failiga kaasa, töötab cross-device, kasutaja näeb. Sidecar fail oleks kohmakas, workspace state laguneks faili liigutamisel. |
| **Upload type** | Multipart (üks request: metadata + body) | MD-failid on ~peaaegu alati <5MB. Resumable lisaks 2 round-tripi ilma kasuta. Kui `Buffer.byteLength(content) > 5_000_000` → fallback resumable. |
| **HTTP klient** | `googleapis` npm | Ametlik Google klient. Ühildub `google-auth-library` OAuth2Client'iga (token refresh automaatne). Lisab ~1MB extension'i bundle'isse — aktsepteeritav. |

* * *

## 3. Existing code patterns (mida taaskasutame)

| Pattern | Asukoht | Kuidas kasutame |
| --- | --- | --- |
| SecretStorage wrapper | `extensions/ritemark/src/ai/apiKeyManager.ts:22` | Kopeerime mustri uue `googleDriveAuth.ts` jaoks: `storeTokens()`, `getTokens()`, `deleteTokens()`. EventEmitter `connectionChanged` → settings UI värskendamine. |
| Frontmatter parse/serialize | `ritemarkEditor.ts:133` (parse), `ritemarkEditor.ts:299-318` (serialize) | Lisame uue mutatsiooni: pärast `files.create/update` lugeme frontmatter'i, mergeme `gdrive` võtme alla, kirjutame tagasi läbi `propertiesChanged` voo. **NB!** Mitte kirjutada faili otse fs.writeFile'iga — VS Code TextDocument API kaudu (`document.getText()` / `WorkspaceEdit`). |
| Settings React UI | `webview/src/components/settings/RitemarkSettings.tsx:268-1040` | Lisame uue `<section>` "Connections" — sama struktuuriga, mis Claude/ChatGPT API key kaardid. Status badge (`Connected as foo@bar.com` / `Not connected`), "Connect" / "Disconnect" nupud. |
| Settings ↔ extension messaging | `RitemarkSettingsProvider.ts:153-186` | Lisame uued message type'id: `gdrive:connect`, `gdrive:disconnect`, `gdrive:status`. Vastus: `gdrive:statusUpdate`. |
| Editor ↔ extension messaging | `ritemarkEditor.ts:284` switch-statement | Lisame uued case'id: `gdrive:export`, `gdrive:openInDocs`. Vastus: `gdrive:exportProgress`, `gdrive:exportSuccess`, `gdrive:exportError`. |
| Toolbar button | Webview `FormattingBubbleMenu.tsx` ei sobi (selection-based). | Lisame **uue toolbari** päise lähedusse VÕI editor title menu kaudu (`package.json` → `menus → editor/title`). Soovitan editor title menu'd — natiivne VS Code muster, töötab koos olemasoleva tab title bar'iga. |
| Feature flag | `extensions/ritemark/src/features/flags.ts` (vt `.claude/skills/feature-flags/SKILL.md`) | Kogu feature `gdrive-export` lipu taha → Jarmo saab kill-switch'i kui Drive API kvoot otsa saab või OAuth client lukus. |

* * *

## 4. OAuth flow (samm-sammuline)

```
┌─────────────────┐                  ┌─────────────────┐                ┌──────────────┐
│ Settings UI     │                  │ Extension host  │                │ Browser      │
│ (webview)       │                  │ (Node.js)       │                │ (system)     │
└────────┬────────┘                  └────────┬────────┘                └──────┬───────┘
         │                                    │                                │
         │ click "Connect Google Drive"       │                                │
         ├───────────────────────────────────►│                                │
         │ postMessage('gdrive:connect')      │                                │
         │                                    │                                │
         │                                    │ 1. Genereeri PKCE              │
         │                                    │    code_verifier (random 64B)  │
         │                                    │    code_challenge = S256(verifier)
         │                                    │                                │
         │                                    │ 2. http.createServer()         │
         │                                    │    .listen(0)  → port 49371    │
         │                                    │                                │
         │                                    │ 3. vscode.env.openExternal(    │
         │                                    │      https://accounts.google.com/o/oauth2/v2/auth?
         │                                    │        client_id=...           │
         │                                    │        redirect_uri=http://127.0.0.1:49371
         │                                    │        scope=drive.file        │
         │                                    │        code_challenge=...      │
         │                                    │        code_challenge_method=S256
         │                                    │        access_type=offline     │
         │                                    │        prompt=consent          │
         │                                    │      )                         │
         │                                    ├───────────────────────────────►│
         │                                    │                                │
         │                                    │                          [user logs in,
         │                                    │                           grants drive.file scope]
         │                                    │                                │
         │                                    │   Google redirects             │
         │                                    │◄───────────────────────────────┤
         │                                    │   GET /?code=4/0AbC...&state=  │
         │                                    │                                │
         │                                    │ 4. POST oauth2.googleapis.com/token
         │                                    │    grant_type=authorization_code
         │                                    │    code, code_verifier, ...    │
         │                                    │    → { access_token, refresh_token, expires_in }
         │                                    │                                │
         │                                    │ 5. SecretStorage.store(        │
         │                                    │      'gdrive-tokens', JSON)    │
         │                                    │                                │
         │                                    │ 6. server.close()              │
         │                                    │    show success page in browser│
         │                                    │                                │
         │ postMessage('gdrive:statusUpdate', │                                │
         │   { connected: true,               │                                │
         │     email: 'user@gmail.com' })     │                                │
         │◄───────────────────────────────────┤                                │
         │                                    │                                │
         │ render "Connected as user@gmail.com"                                │
```

**Email saamine:** Pärast `code → token` exchange'i kasuta `userinfo` scope'i VÕI lihtsalt `id_token` JWT'st `email` claim. Lisa scope'idesse `openid email`.

**Turvanõuded:**
- `state` parameeter — random 32B, kontrolli callback'is (CSRF kaitse)
- `code_verifier` ainult mälus exchange'i hetkeni, mitte kettal
- Refresh token tagasi `SecretStorage` — mitte logidesse, mitte console'i
- Auth server kuulab AINULT `127.0.0.1` (NB: localhost võib resolveda 0.0.0.0 → kuulaks võrgust!)
- Timeout: 5 min, siis sulge server, näita error

* * *

## 5. Export flow (samm-sammuline)

```
User vajutab "Export to Google Docs" nuppu (editor title menu)
         │
         ▼
webview postMessage({ type: 'gdrive:export' })
         │
         ▼
ritemarkEditor.ts onDidReceiveMessage handler
         │
         ▼
1. await getGoogleDriveTokens()   ── pole tokeni? → postMessage('gdrive:notConnected') → Settings päring
         │
         ▼
2. const { content, properties } = extractFrontMatter(document.getText())
         │
         ▼
3. const oauth2Client = new google.auth.OAuth2(...)
   oauth2Client.setCredentials({ access_token, refresh_token })
   const drive = google.drive({ version: 'v3', auth: oauth2Client })
         │
         ▼
4. const fileId = properties?.gdrive?.id
   const fileName = path.basename(document.uri.fsPath, '.md')
         │
         ├─── fileId puudub: ────────────────────────────────────────┐
         │                                                            │
         │   await drive.files.create({                              │
         │     requestBody: {                                         │
         │       name: fileName,                                      │
         │       mimeType: 'application/vnd.google-apps.document'    │
         │     },                                                     │
         │     media: {                                               │
         │       mimeType: 'text/markdown',                           │
         │       body: content                                        │
         │     },                                                     │
         │     fields: 'id, webViewLink, modifiedTime'                │
         │   })                                                       │
         │                                                            │
         └─── fileId olemas: ────────────────────────────────────────┤
                                                                      │
             // Conflict check first                                  │
             const remote = await drive.files.get({                   │
               fileId, fields: 'modifiedTime' })                      │
             if (remote.modifiedTime > properties.gdrive.modifiedTime)│
               → prompt user: "Doc was modified in Drive. Overwrite?" │
                                                                      │
             await drive.files.update({                               │
               fileId,                                                │
               media: { mimeType: 'text/markdown', body: content },   │
               fields: 'id, webViewLink, modifiedTime'                │
             })                                                       │
                                                                      ▼
5. Update frontmatter:
   properties.gdrive = {
     id: result.id,
     url: result.webViewLink,
     modifiedTime: result.modifiedTime,
     exportedAt: new Date().toISOString()
   }
         │
         ▼
6. const newContent = serializeFrontMatter(properties, content)
   await updateDocument(document, newContent)   ← läbi WorkspaceEdit
         │
         ▼
7. webview.postMessage({
     type: 'gdrive:exportSuccess',
     url: result.webViewLink
   })
         │
         ▼
8. Webview näitab toast: "Exported to Google Docs ✓ [Open]"
```

**Error handling:**

| HTTP staatus | Tähendus | Käitumine |
| --- | --- | --- |
| 401 | Token aegunud | `googleapis` refreshib automaatselt (kui refresh_token olemas). Salvesta uus access_token tagasi SecretStorage'i kaudu `tokens` event'i. |
| 403 `insufficientFilePermissions` | Kasutaja kustutas appi õigused | Kustuta tokenid, saada `gdrive:notConnected`, palu uuesti ühendada |
| 404 `notFound` | Drive fail kustutati | Eemalda `gdrive.id` frontmatter'ist, käivita uuesti kui CREATE flow |
| 429 / 5xx | Rate limit / server error | Exponential backoff, 3 retry'd, siis error toast |
| network error | offline | "Pole internetti" toast, ei muuda frontmatter'it |

* * *

## 6. Frontmatter shape (lukku)

```yaml
---
title: My Document
gdrive:
  id: 1abc2def3GHI4jkl5MNO6pqr7STU8vwx9YZ
  url: https://docs.google.com/document/d/1abc.../edit
  modifiedTime: 2026-05-02T14:23:11.000Z
  exportedAt: 2026-05-02T14:23:11.000Z
---

# Document content here
```

**Reeglid:**
- Top-level võti: `gdrive` (mitte `googleDrive`, mitte `google_drive`) — lühike, üks word boundary
- `id` on **kanooniline** — kõik teised väljad tuletatud
- `url` on cache'itud (et `Open in Docs` ei vajaks API call'i)
- `modifiedTime` on **Drive serveri** aeg, mitte kohalik
- `exportedAt` on **kliendi** aeg viimati eksporditud — kasutame UI'is ("Exported 5 minutes ago")
- Pole `name` ega `mimeType` — need tuletatakse failinimest

* * *

## 7. UI komponendid

### 7.1. Settings → Connections

Asukoht: `webview/src/components/settings/RitemarkSettings.tsx` — uus `<section>` enne API Keys jaotist (loogiline grupp: kõigepealt who-am-I, siis tools).

```
┌─ Connections ──────────────────────────────────────────────┐
│  🔗  Connect external services to publish your documents   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ▸ Google Drive          [● Connected]                  │ │
│  │   user@gmail.com                                        │ │
│  │                                                          │ │
│  │   Files exported to Google Docs format.                 │ │
│  │   Scope: drive.file (only files Ritemark creates).     │ │
│  │                                                          │ │
│  │   [Disconnect]                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Disconnected state:

```
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ▸ Google Drive          [○ Not connected]              │ │
│  │                                                          │ │
│  │   Export markdown files as Google Docs.                 │ │
│  │   Re-export overwrites the same Drive file.            │ │
│  │                                                          │ │
│  │   [Connect Google Drive]                                │ │
│  └────────────────────────────────────────────────────────┘ │
```

### 7.2. Editor toolbar

**Asukoht:** `package.json` → `contributes.menus.editor/title` (kõrval kus `exportPDF`, `exportWord` juba elavad).

```json
{
  "command": "ritemark.exportToGoogleDocs",
  "group": "navigation@5",
  "when": "resourceExtname == .md"
}
```

Icon: Google Drive logo (SVG, lisada `extensions/ritemark/media/icons/`).

**Tingimuslik teine nupp** — kui dokumendi frontmatter'is on `gdrive.id`:

```json
{
  "command": "ritemark.openInGoogleDocs",
  "group": "navigation@6",
  "when": "resourceExtname == .md && ritemark.hasGDriveId"
}
```

`ritemark.hasGDriveId` context key — set'itakse `ritemarkEditor.ts:resolveCustomTextEditor` kui frontmatter parsib `gdrive.id` välja.

### 7.3. Toast / progress

Reuse existing toast infra (kui pole — `vscode.window.withProgress` notification API).

* * *

## 8. Failid ja moodulid (mida luua)

```
extensions/ritemark/src/
├── gdrive/                              ← UUS kaust
│   ├── index.ts                         ← public API
│   ├── auth.ts                          ← OAuth flow (loopback server, PKCE)
│   ├── tokenStore.ts                    ← SecretStorage wrapper (kopeeri apiKeyManager mustrist)
│   ├── client.ts                        ← googleapis Drive client factory
│   ├── exporter.ts                      ← exportToGoogleDocs(document) — peamine entry
│   ├── conflictDetector.ts              ← modifiedTime check
│   └── types.ts                         ← GDriveTokens, GDriveFrontmatter, etc
├── extension.ts                         ← MUUDATUS: registreeri commands, init tokenStore
├── ritemarkEditor.ts                    ← MUUDATUS: onDidReceiveMessage 'gdrive:*' case'id
└── settings/RitemarkSettingsProvider.ts ← MUUDATUS: 'gdrive:connect/disconnect/status'

extensions/ritemark/webview/src/components/settings/
└── RitemarkSettings.tsx                 ← MUUDATUS: uus Connections section

extensions/ritemark/webview/src/components/
└── ExportToDocsButton.tsx               ← UUS (kui editor title menu ei ammenda)

patches/vscode/
└── (mitte midagi muuta)                 ← extension-only, pole VS Code coredsi muudatusi

package.json (extension)
└── + commands ritemark.exportToGoogleDocs, ritemark.openInGoogleDocs
└── + dependency: googleapis
```

* * *

## 9. Dependencies

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"
  }
}
```

**NB!** `googleapis` on suur (~5MB unpacked). Alternatiiv: ainult `google-auth-library` + manuaalne `fetch` Drive API'le. Trade-off:
- `googleapis`: täielik tüübitugi, automaatne token refresh, vähem koodi
- `google-auth-library` only: ~500KB, peame ise `fetch` kirjutama

**Soovitan `googleapis`** — kontorist täielik klient, refresh logic on tested. Bundle size pole MVP'le piiritletud.

* * *

## 10. Google Cloud Console seadistus

**Enne arendust peab Jarmo:**

1. Mine [console.cloud.google.com](https://console.cloud.google.com)
2. Loo projekt "Ritemark Native" (või kasuta olemasolevat)
3. **APIs & Services → Library** → enable **Google Drive API**
4. **APIs & Services → OAuth consent screen**:
   - User type: External (avalik app)
   - App name: Ritemark Native
   - Scopes: `.../auth/drive.file`, `openid`, `email`
   - Test users: Jarmo + arendajad (publishing protsess hiljem)
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**
   - Name: Ritemark Native (Desktop)
6. Saadud `client_id` lisada koodi
   - **EI OLE** secret — Desktop app tüüp ei kasuta `client_secret`-i (PKCE asendab)
   - Võib turvaliselt commit'ida repo'sse

**Quota:** Drive API default 10K queries / 100s / user — meie use-case'is enam kui piisav.

* * *

## 11. Testimine

| Tase | Mida testida | Vahend |
| --- | --- | --- |
| Unit | `tokenStore` mock'itud SecretStorage'iga; `exporter` mock'itud `drive` client'iga | Vitest (juba projektis) |
| Integration | Reaalne OAuth flow Jarmo Google kontoga (test user) | Käsitsi |
| Edge cases | Suur fail >5MB, võrk katkeb mid-upload, fail kustutatud Drive'is, mitu eksporti järjest | Käsitsi |
| Conflict | Eksportida; muuda Docs'is brauseris; eksportida uuesti → peab pakkuma "overwrite?" | Käsitsi |

* * *

## 12. Risks & open questions

| Risk | Mitigation |
| --- | --- |
| Google OAuth consent screen "unverified app" hoiatus | App publish'imine ja verification protsess (Google security review). MVP ajaks: kasutame "Testing" mode'i, lisame test users. |
| Markdown extensions (math, mermaid, callouts) ei konverteeru hästi | Document'eerime "supported markdown features" listi. Custom extensions → degrade gracefully (nt mermaid → koodiblokk) |
| Suur fail (>5MB) — multipart fail | Detect ja fallback resumable upload (`googleapis` toetab automaatselt kui body on stream) |
| Refresh token revoked (kasutaja muutis parooli, eemaldas appi) | 401 catch → kustuta tokenid → näita Settings'is "Reconnect" |
| Mitu seadet ekspordivad sama failina | `gdrive.modifiedTime` conflict check püüab 80% juhtudest. 100% lahendus = ETag `If-Match` header (postpone) |
| OAuth port collision (ekstreemselt haruldane: 49152-65535) | port 0 = OS valib vaba; kui ikka fail → näita error, palu uuesti |

**Open questions Jarmole hilisemaks:**
- Kas eelistame iga ekspordi järel toast'i "Open in Docs" linki, või avame brauseri automaatselt?
- Kas peaks olema "Auto-export on save" valik (per-fail frontmatter'is `gdrive.autoExport: true`)?
- Kas pildid (kui markdown'is `![alt](./images/foo.png)`) tuleks ka uploadida? MVP ütleb "ei" (Google näitab `[image]` placeholder'i), aga see on ilmne UX defekt järgmiseks sprint'iks.

* * *

## 13. Sprint breakdown (sprint-manager'ile)

**Sprint 1: GDrive Auth & Settings (~2 päeva)**
- Google Cloud projekt + OAuth client
- `gdrive/auth.ts` — loopback OAuth flow + PKCE
- `gdrive/tokenStore.ts` — SecretStorage wrapper
- Settings → Connections section
- Connect / Disconnect end-to-end

**Sprint 2: Export pipeline (~2 päeva)**
- `gdrive/client.ts`, `gdrive/exporter.ts`
- Frontmatter read/write integration
- Editor title menu nupp + command
- Toast / progress notification
- Error handling (401, 403, 404, 429)

**Sprint 3: Polish (~1 päev)**
- Open in Docs nupp + context key
- Conflict detection (modifiedTime check + prompt)
- Unit testid
- Manuaaltestid + dokumentatsioon (`docs/user/google-drive-export.md`)

Kokku: **~5 päeva** ühele arendajale, kõik MVP scope.

* * *

## 14. Sources

- [Google Drive API: Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads) — multipart upload format, mimeType conversion
- [Google Drive supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types) — `application/vnd.google-apps.document` target
- [OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) — loopback flow, PKCE, refresh tokens
- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252) — 127.0.0.1 vs localhost
- [Loopback IP Address flow Migration Guide](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration) — Desktop app client type still supported
- [googleapis npm package](https://www.npmjs.com/package/googleapis) — official Node.js client
- [Building a basic Markdown-to-Google Docs converter (DEV)](https://dev.to/googleworkspace/building-a-basic-markdown-to-google-docs-converter-1220) — community walkthrough
