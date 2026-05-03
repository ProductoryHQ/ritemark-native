# Google Drive Export — Tehniline analüüs (sünteesitud)

**Kuupäev:** 2026-05-02
**Autorid:** Jarmo (PM + parity audit) + Claude (engineering)
**Staatus:** Pre-sprint analüüs, kinnitatud

* * *

## 1. User story

> **Kasutajana** soovin oma markdown-faili publitseerida Google Drive'i Google Docs formaadis,
> et saaksin seda jagada inimestega, kes ei kasuta Ritemarki.

- Vajutan **Export** menüüst valikut **Export to Google Drive**
- Esmakordsel kasutamisel käivitub OAuth voog (kui pole, suunab Settings → Connections)
- Loob Google Docs faili, ID salvestatakse markdown'i frontmatter'i
- Korduval ekspordil → uuendab sama Drive faili (ID põhjal)
- Kui frontmatter'is on Drive ID → kuvatakse ka **Open in Google Docs** menüü-item
- **Eeldus:** GDocs eksport peab katma sama sisuelementide hulga nagu Word/PDF v2 eksport

**MVP scope:**
- ✅ Settings → Connections jaotis
- ✅ Export menüüsse uus item
- ✅ Open in Docs menüü-item (kui Drive ID olemas)
- ✅ Word/PDF v2 parity (vt jaotis 4)
- ❌ Two-way sync (järgmine sprint)
- ❌ Drive Picker dialoog kausta valikuks (Phase B)

* * *

## 2. Word/PDF v2 parity audit (baseline mida peame katma)

Tänane HTML-põhine pipeline (`exportToPDFV2`, `exportToWordV2`) toetab järgmisi elemente. **GDrive eksport peab need kõik katma** — vastasel korral on tegu funktsionaalse regressiooniga.

| # | Element | Detail |
| --- | --- | --- |
| 1 | Dokumendi metadata | `title`, `author`, `date` properties'st (renderdatud doki algusesse) |
| 2 | Headingud | H1..H6 |
| 3 | Paragraph | Tavateksti `<p>` |
| 4 | Inline formaat | **bold**, *italic*, `inline code`, lingid |
| 5 | Loendid | UL + OL, sh nested tasemed |
| 6 | Koodiplokid | `<pre><code>` |
| 7 | Blockquote | `<blockquote>` |
| 8 | Tabelid | `<table>`, `<tr>`, `<th>`, `<td>` |
| 9 | Horisontaaljoon | `<hr>` |
| 10 | Pildid | `<img>` sh kohalike failide resolvimine (data URL) |
| 11 | Mermaid diagrammid | Renderdatakse PNG `data:image/...` `<img>` elemendiks ekspordi hetkel |

* * *

## 3. Tehniline strateegia: TAASKASUTA OLEMASOLEVAT HTML PIPELINE'I

**Kriitiline otsus:** ärme teha eraldi `markdown → Docs` konverterit.

**Põhjus:** kui saadame Drive API'le `text/markdown` source'i ja palume `application/vnd.google-apps.document` target'iks, siis Google teeb konversiooni serverside, **aga ei oska resolvida kohalikke pilte ega rendetud mermaid PNG'sid** — need on extension hostis data URL'idena, mitte Drive'is.

**Lahendus:** kasutame sama HTML pipeline'i, mis Word/PDF v2 juba töödeldud kujul väljastab.

```
markdown + properties
    ↓
[OLEMASOLEV HTML pipeline — exportToPDFV2 / exportToWordV2 sees]
    ↓
HTML string (pildid + mermaid juba data: URL'idena inline'is)
    ↓
drive.files.create({
  requestBody: {
    name: '<filename>',
    mimeType: 'application/vnd.google-apps.document'  // target
  },
  media: {
    mimeType: 'text/html',                            // source
    body: htmlString
  },
  fields: 'id, webViewLink, modifiedTime'
})
    ↓
Google konverdib HTML → Google Docs serverside
(toetab natiivselt: tabelid, headingud, listid, pildid, blockquote, hr, code, links, bold/italic)
```

**Tagajärjed:**
- ✅ **Parity Word/PDF v2-ga tuleb tasuta** — sama HTML genereerimise kood
- ✅ **Phase A = Phase B** — pole vaja staged rollout'i nagu Jarmo algselt pakkus
- ✅ **Pildid + mermaid** töötavad sama hästi nagu PDF/Word eksport
- ⚠️ Mõned servajuhud (nt nested listid keerulises HTML'is) võivad tulla läbi imelikult — fallback Phase C: Docs API `documents.batchUpdate` täpseks kontrolliks

**Update flow on identne:**
```
drive.files.update({
  fileId: <gdrive_doc_id>,
  media: { mimeType: 'text/html', body: htmlString },
  fields: 'id, webViewLink, modifiedTime'
})
```

* * *

## 4. OAuth flow (Loopback IP + PKCE)

| Otsus | Valik | Põhjendus |
| --- | --- | --- |
| Flow | Loopback IP redirect (`http://127.0.0.1:0`) | RFC 8252 standard. **Mitte `localhost`** — võib resolveda 0.0.0.0-le ja kuulata võrgust. |
| Port | `0` (OS valib vaba) | Väldib port collision'eid |
| PKCE | `S256` code_challenge | Eemaldab vajaduse `client_secret`-i salatuna hoida |
| Scope | `https://www.googleapis.com/auth/drive.file` | **Minimaalne** — ainult Ritemark'i loodud failid. EI saa lugeda kogu Drive'i. |
| Lisa scope | `openid email` | Et saada kasutaja email Settings UI'sse ("Connected as user@gmail.com") |
| OAuth client tüüp | Desktop app | Ei vaja `client_secret`-i (PKCE asendab) → võib `client_id`-i commit'ida repo'sse |
| Token refresh | `access_type=offline` + `prompt=consent` | Tagab refresh token saamise |

### Voo diagramm

```
Settings UI (webview)              Extension host (Node)              Browser
       │                                   │                              │
       │ "Connect Google Drive"            │                              │
       ├──────────────────────────────────►│                              │
       │                                   │ 1. PKCE code_verifier + state│
       │                                   │ 2. http.createServer().listen(0) → port 49371
       │                                   │ 3. vscode.env.openExternal(  │
       │                                   │     accounts.google.com/...) │
       │                                   ├─────────────────────────────►│
       │                                   │                       [user logs in]
       │                                   │◄─────────────────────────────┤
       │                                   │ GET /?code=...&state=...     │
       │                                   │ 4. Validate state (CSRF)     │
       │                                   │ 5. POST oauth2/token         │
       │                                   │    → access_token, refresh_token, id_token
       │                                   │ 6. Decode id_token → email   │
       │                                   │ 7. SecretStorage.store('gdrive-tokens', JSON)
       │                                   │ 8. server.close()            │
       │ "Connected as user@gmail.com"     │                              │
       │◄──────────────────────────────────┤                              │
```

**Turvanõuded:**
- `state` parameeter — random 32B, kontrolli callback'is (CSRF kaitse)
- `code_verifier` ainult mälus exchange'i hetkeni
- HTTP server kuulab AINULT `127.0.0.1` (mitte `0.0.0.0`)
- Timeout: 5 min, siis sulge server, näita error
- Refresh token → `vscode.SecretStorage` (OS keychain)

* * *

## 5. Token storage (kopeeri olemasolevast mustrist)

**Muster:** `extensions/ritemark/src/ai/apiKeyManager.ts:22` — sama struktuur, ainult `secrets.store()` võti erineb.

```typescript
// Uus fail: extensions/ritemark/src/gdrive/tokenStore.ts
const GDRIVE_TOKENS_KEY = 'gdrive-oauth-tokens';

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;       // ms epoch
  email: string;             // id_token'ist
}

class GDriveTokenStore {
  constructor(private secrets: vscode.SecretStorage) {}

  async store(tokens: StoredTokens): Promise<void> {
    await this.secrets.store(GDRIVE_TOKENS_KEY, JSON.stringify(tokens));
    connectionChanged.fire({ connected: true, email: tokens.email });
  }

  async get(): Promise<StoredTokens | undefined> { /* ... */ }
  async delete(): Promise<void> { /* ... */ }
  async hasConnection(): Promise<boolean> { /* ... */ }
}
```

`googleapis` `OAuth2Client` refreshib access_token'i automaatselt — `tokens` event'is saame uue token'i ja salvestame tagasi SecretStorage'isse.

* * *

## 6. Export flow (samm-sammuline)

```
User vajutab Export menüüst "Export to Google Drive"
         │
         ▼
ExportMenu.tsx → postMessage({ type: 'gdrive:export' })
         │
         ▼
ritemarkEditor.ts onDidReceiveMessage handler
         │
         ▼
1. await tokenStore.get()
   ├─ pole tokeni → postMessage('gdrive:notConnected')
   │                → webview näitab "Connect in Settings → Connections"
   └─ olemas → jätka
         │
         ▼
2. const { content, properties } = extractFrontMatter(document.getText())
         │
         ▼
3. const html = await renderToHtml(content, properties)
   // Sama funktsioon mida exportToPDFV2 / exportToWordV2 kasutavad
         │
         ▼
4. const oauth2Client = new google.auth.OAuth2(...)
   oauth2Client.setCredentials(storedTokens)
   const drive = google.drive({ version: 'v3', auth: oauth2Client })
         │
         ▼
5. const fileId = properties?.gdrive_doc_id
   const fileName = properties?.title || path.basename(document.uri.fsPath, '.md')
         │
         ├─── fileId puudub (CREATE) ──────────────────────────────────────┐
         │   await drive.files.create({                                    │
         │     requestBody: {                                              │
         │       name: fileName,                                           │
         │       mimeType: 'application/vnd.google-apps.document'         │
         │     },                                                          │
         │     media: { mimeType: 'text/html', body: html },              │
         │     fields: 'id, webViewLink, modifiedTime'                     │
         │   })                                                            │
         │                                                                  │
         └─── fileId olemas (UPDATE) ──────────────────────────────────────┤
             // CONFLICT CHECK first                                        │
             const remote = await drive.files.get({                         │
               fileId, fields: 'modifiedTime' })                            │
             if (remote.modifiedTime > properties.gdrive_modified_time) {   │
               → window.showWarningMessage(                                 │
                   "Doc was modified in Google Docs since last export.     │
                    Overwrite?", "Overwrite", "Cancel")                     │
               → if cancel: abort                                           │
             }                                                              │
                                                                            │
             await drive.files.update({                                     │
               fileId,                                                      │
               media: { mimeType: 'text/html', body: html },               │
               fields: 'id, webViewLink, modifiedTime'                      │
             })                                                             │
                                                                            ▼
6. Update frontmatter (FLAT keys — Properties UI ei toeta nested):
   properties.gdrive_doc_id        = result.id
   properties.gdrive_doc_url       = result.webViewLink
   properties.gdrive_modified_time = result.modifiedTime
   properties.gdrive_exported_at   = new Date().toISOString()
         │
         ▼
7. const newContent = serializeFrontMatter(properties, content)
   await updateDocument(document, newContent)
   // Kasutab olemasolevat WorkspaceEdit voogu (ritemarkEditor.ts:299)
         │
         ▼
8. webview.postMessage({
     type: 'gdrive:exportSuccess',
     url: result.webViewLink
   })
         │
         ▼
9. Toast: "Exported to Google Docs ✓ [Open]"
```

### Error handling matrix

| HTTP staatus | Tähendus | Käitumine |
| --- | --- | --- |
| 401 | access_token aegunud | `googleapis` auto-refresh refresh_token'iga. Salvesta uus token'i set tagasi SecretStorage'i kaudu `tokens` event'i. |
| 403 `insufficientFilePermissions` | Kasutaja eemaldas appi õigused Google'is | Kustuta tokenid, saada `gdrive:notConnected`, palu Settings'is uuesti ühendada |
| 404 `notFound` | Drive fail kustutati või omanik muutis õigusi | Eemalda `gdrive_doc_id` frontmatter'ist, käivita uuesti CREATE flow |
| 429 / 5xx | Rate limit / server error | Exponential backoff (2s, 4s, 8s), 3 retry'd, siis error toast |
| Network error | Offline | "No internet connection" toast, ei muuda frontmatter'it |

* * *

## 7. Frontmatter contract (FLAT — Properties UI piirang)

```yaml
---
title: My Document
author: Jane Doe
gdrive_doc_id: "1AbC2def3GHI4jkl5MNO6pqr7STU8vwx9YZ"
gdrive_doc_url: "https://docs.google.com/document/d/1AbC.../edit"
gdrive_modified_time: "2026-05-02T14:23:11.000Z"
gdrive_exported_at: "2026-05-02T14:23:11.000Z"
---

# Document content
```

**Reeglid:**
- **FLAT snake_case** — Properties UI ei toeta nested objekte
- Prefix `gdrive_` — namespace kõikidele Drive väljadele
- `gdrive_doc_id` on **kanooniline** — kõik teised tuletatud
- `gdrive_doc_url` on **cache'itud** (et Open in Docs ei vajaks API call'i)
- `gdrive_modified_time` on **Drive serveri** aeg (conflict detection'iks)
- `gdrive_exported_at` on **kliendi** aeg (UI'is "Exported 5 minutes ago")

**Tulevikuks (Phase B+, ärge nüüd):**
- `gdrive_folder_id` (kui lisame Drive Picker'i)
- `gdrive_auto_export` (kui lisame auto-export valiku)

* * *

## 8. UI komponendid

### 8.1. Settings → Connections (uus jaotis)

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

### 8.2. Export menu (muudatus olemasolevasse)

Asukoht: `webview/src/components/header/ExportMenu.tsx` — lisame uue dropdown item'i olemasoleva `download` ikooniga nupu menüüsse.

**Praegu:**
- Export PDF
- Export Word
- Copy as Markdown

**Uus:**
- Export PDF
- Export Word
- **Export to Google Drive** ← uus
- **Open in Google Docs** ← uus, conditional `gdrive_doc_id` olemasolu järgi
- Copy as Markdown

**State indikaatorid** Export to Google Drive item'is:
- Default: "Export to Google Drive"
- Aktiivne export: spinner + "Exporting..."
- Õnnestumise järel: roheline check 2s, siis tagasi default'iks
- Tooltip kui pole connectionit: "Connect Google Drive in Settings"

* * *

## 9. Failipaigutus

```
extensions/ritemark/src/
├── gdrive/                              ← UUS kaust
│   ├── index.ts                         ← public API
│   ├── auth.ts                          ← OAuth loopback flow + PKCE
│   ├── tokenStore.ts                    ← SecretStorage wrapper
│   ├── client.ts                        ← googleapis Drive client factory
│   ├── exporter.ts                      ← exportToGDrive(document) entry point
│   ├── conflictDetector.ts              ← modifiedTime check
│   ├── htmlRenderer.ts                  ← TAASKASUTAB exportToPDFV2/WordV2 HTML pipeline'i
│   └── types.ts                         ← StoredTokens, GDriveExportResult, etc.
├── extension.ts                         ← MUUDATUS: register commands, init tokenStore
├── ritemarkEditor.ts                    ← MUUDATUS: onDidReceiveMessage 'gdrive:*' case'id
└── settings/RitemarkSettingsProvider.ts ← MUUDATUS: 'gdrive:connect/disconnect/status'

extensions/ritemark/webview/src/components/
├── settings/RitemarkSettings.tsx        ← MUUDATUS: uus Connections section
└── header/ExportMenu.tsx                ← MUUDATUS: 2 uut menüü-item'i

extensions/ritemark/package.json         ← MUUDATUS: + commands + googleapis dependency

patches/vscode/                          ← Mitte midagi muuta (extension-only)
```

* * *

## 10. Dependencies

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"
  }
}
```

**Suurus:** ~5MB unpacked. Aktsepteeritav, sest:
- Auto-refresh tokens
- Tüübitugi (TypeScript)
- Vähem boilerplate koodi
- Mitte webview bundle'is — extension hostis (ei mõjuta editori käivitumiskiirust)

**Alternatiiv (kõrvale jäetud):** `google-auth-library` only + manuaalne `fetch` Drive API'le. Säästab ~4MB, aga peame ise refresh logic'u + tüübid kirjutama → rohkem bug'e MVP'sse.

* * *

## 11. Google Cloud Console seadistus (enne arendust)

Jarmo peab tegema:

1. [console.cloud.google.com](https://console.cloud.google.com)
2. Loo/vali projekt "Ritemark Native"
3. **APIs & Services → Library** → enable **Google Drive API**
4. **APIs & Services → OAuth consent screen**:
   - User type: External
   - App name: Ritemark Native
   - Scopes: `.../auth/drive.file`, `openid`, `email`
   - Test users: Jarmo + arendajad
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Desktop app**
   - Name: Ritemark Native (Desktop)
6. `client_id` lisada koodi (turvaline commit'ida — Desktop app tüüp ei kasuta `client_secret`-i, PKCE asendab)

**Quota:** Drive API default 10K queries / 100s / user — meie use-case'is enam kui piisav.

**Verification:** algul "Testing" mode (max 100 test users). Production verification (Google security review) hilisem samm.

* * *

## 12. Testimine

| Tase | Mida | Vahend |
| --- | --- | --- |
| Unit | `tokenStore` + `exporter` mock'itud klientidega | Vitest |
| Manuaal — happy path | Connect → Export → Open in Docs → Re-export → kontrolli sama fail | Käsitsi |
| Manuaal — parity | Eksport faili kõigi 11 elemendiga (vt jaotis 2) → kontrolli Docs'is, et midagi pole katki | Käsitsi |
| Manuaal — auth edge | Eemalda app permissions Google'ist → eksport peab andma puhta error'i | Käsitsi |
| Manuaal — conflict | Eksport → muuda Docs'is brauseris → eksport uuesti → peab pakkuma "Overwrite?" | Käsitsi |
| Manuaal — network | Lülita võrk välja mid-export → graceful error, frontmatter ei muutu | Käsitsi |

* * *

## 13. Vastused tooteküsimustele

**1. Kas eksport läheb kindlasse kausta või rooti?**
MVP: **My Drive root**. `drive.file` scope ei luba kogu Drive'i browse'ida (turvaline disain). Phase B: Drive Picker dialoog (Google'i ametlik pop-up, töötab `drive.file` scope'iga, salvestab `gdrive_folder_id` frontmatter'isse).

**2. Kas "Update in GDrive" võib teha hard replace'i?**
Tehniliselt jah — `files.update` on alati overwrite. **Aga** lisame conflict detection'i: `gdrive_modified_time` võrdlus enne update'i. Kui Drive'is on uuem versioon → küsime kasutajalt enne overwrite'i. Hard replace ilma hoiatuseta = data loss → vastuvõetamatu.

**3. Kas nõuame Phase B parity't või staged A→B rollout?**
**Phase B kohe.** Põhjus: HTML pipeline strateegia (jaotis 3) annab parity tasuta — sama HTML genereerimise kood, mis Word/PDF v2 juba töötab. Eraldi Phase A pole vajalik.

* * *

## 14. Risks & open issues

| Risk | Mõju | Mitigation |
| --- | --- | --- |
| HTML→Docs konversioon ei kanna mõne servajuhu (nt deeply nested list) | Visuaalne erinevus PDF/Word ja Docs vahel | Phase C fallback: `documents.batchUpdate` täppiskontrolliks. MVP'sse ei lähe. |
| Google OAuth "unverified app" hoiatus | Kasutajad näevad scary screen'i | Testing mode'is OK kuni 100 users. Production: läbi Google verification process'i. |
| Suur fail (>5MB HTML body) | Multipart upload fail | `googleapis` toetab automaatselt resumable kui body on stream. Implementeerime stream'iga algusest. |
| Refresh token revoked | Kasutaja peab uuesti ühendama | 401 catch → kustuta tokenid → "Reconnect" Settings'is |
| Mitu seadet ekspordivad sama failina | Üks ülekirjutab teise | `gdrive_modified_time` conflict check katab 80% juhtumeid. 100% lahendus = ETag `If-Match` (Phase B+) |
| OAuth port collision | Ühendus ei õnnestu | port 0 = OS valib vaba; collision äärmiselt haruldane (49152-65535 range) |

**Open issues hilisemaks:**
- Auto-export on save (per-fail frontmatter `gdrive_auto_export: true`)?
- Drive Picker kausta valimiseks?
- Jagamise opt-in (`gdrive_share_with: [emails]`)?

* * *

## 15. Sprint breakdown

**Sprint 1: Auth + Settings (~2 päeva)**
- Google Cloud projekt + Desktop OAuth client
- `gdrive/auth.ts` — loopback OAuth + PKCE + state CSRF
- `gdrive/tokenStore.ts` — SecretStorage wrapper
- Settings → Connections section (Connect / Disconnect)
- End-to-end: connect → email kuvatud → disconnect

**Sprint 2: Export pipeline (~2 päeva)**
- `gdrive/htmlRenderer.ts` — taaskasuta `exportToPDFV2` / `exportToWordV2` HTML pipeline'it
- `gdrive/client.ts`, `gdrive/exporter.ts`
- Frontmatter read/write integration (flat snake_case)
- ExportMenu uus item + command
- Toast / progress notification
- Error handling (401 auto-refresh, 403, 404, 429)

**Sprint 3: Polish (~1 päev)**
- Open in Docs menüü-item + conditional kuvamine
- Conflict detection (`gdrive_modified_time` check + prompt)
- Unit testid
- Manuaalne parity test (kõik 11 elementi jaotisest 2)
- Docs: `docs/user/google-drive-export.md`

**Kokku:** ~5 päeva ühele arendajale.

* * *

## 16. Sources

**Drive API:**
- [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads) — multipart upload format
- [files.create reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [Create files guide](https://developers.google.com/workspace/drive/api/guides/create-file)
- [Supported MIME types](https://developers.google.com/workspace/drive/api/guides/mime-types) — `application/vnd.google-apps.document` target

**Docs API (Phase C fallback):**
- [documents.batchUpdate reference](https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate)
- [Format text](https://developers.google.com/docs/api/how-tos/format-text)
- [Lists](https://developers.google.com/workspace/docs/api/how-tos/lists)

**OAuth:**
- [OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) — loopback flow + PKCE
- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252) — 127.0.0.1 vs localhost
- [Loopback IP migration guide](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration)

**SDK:**
- [googleapis npm](https://www.npmjs.com/package/googleapis) — official Node.js client

**Community:**
- [Building a Markdown-to-Docs converter (DEV)](https://dev.to/googleworkspace/building-a-basic-markdown-to-google-docs-converter-1220)
