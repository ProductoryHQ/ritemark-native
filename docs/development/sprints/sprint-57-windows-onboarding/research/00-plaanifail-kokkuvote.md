# Sprint 57 Research 00: Windows Onboarding Probleemid

> Note: this is the initial plan summary. The current implementation-ready scope is maintained in `../sprint-plan.md`, which corrects stale assumptions found during repo review.

## Allikas

Plaan: `/root/.claude/plans/windows-puhas-masin-esmainstall-immutable-flute.md`  
Uuritud: 2026-04-29

## Leitud probleemid (Jarmo test, puhas Windows masin)

### 1. Workspace Trust Restricted Mode
- Tühja masina esmaavamisel näitab VS Code "Restricted Mode" hoiatust
- Extension ei laadu kuni kasutaja trüstib kausta
- Mittetehnilisele kasutajale tundub et toode on katki
- **Fix:** `branding/product.json` `configurationDefaults` sektsiooni lisada `"security.workspace.trust.enabled": false`
- Risk: praktiliselt null (markdown editor ei vaja Workspace Trust kaitset)

### 2. "Connected" valetab
- `extensions/ritemark/src/agent/setup.ts` funktsioon `deriveClaudeSetupStatus` (read 322-347)
- Funktsioon `detectClaudeAuthMethod` (read 306-320) kontrollib ainult keychain'i/credential store olemasolu — **ei valideeri tokeni kehtivust**
- Kui kasutaja on logitud välja aga credential jääb keychain'i, tagastab `authMethod === 'claude-oauth'` → `state = 'ready'` → UI näitab "Connected"
- Windows variant `checkWindowsAuth()` (read 292-304) kontrollib `cmdkey /list:Claude*` — sama probleem

### 3. In-app /login puudub
- Kasutaja peab terminali avama ja `claude /login` käivitama
- Settings UI-st pole seda leitav
- Terminali avamine hirmutab mittetehnilisi kasutajaid

### 4. Codex install vajab admin PowerShelli
- `Set-ExecutionPolicy` nõuab admin õigusi
- Tavakasutaja ei suuda Codex'it installida

## Olemasolev kood (kasutatavad mustrid)

| Muster | Asukoht |
|--------|---------|
| Codex auth flow | `extensions/ritemark/src/codex/codexAuth.ts` |
| API key test loogika | `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` read 753-789 |
| Welcome page onboarding hook | `extensions/ritemark/src/views/UnifiedViewProvider.ts` read 524-570 |
| Existing Inno Setup | `installer/windows/ritemark.iss` |

## branding/product.json seisund

- `configurationDefaults` sektsioon on read 47-54
- Workspace Trust seade puudub — vajab lisamist
- Muu seadistus korrektne

## Kriitiline fail: setup.ts

- `deriveClaudeSetupStatus` (read 322-347): state määramine — HERE on "Connected" vale
- `detectClaudeAuthMethod` (read 306-320): ainult keychain kontroll, pole token validatsiooni
- `checkKeychainAuth` (read 279-290): macOS keychain check
- `checkWindowsAuth` (read 292-304): Windows credential check

## Strateegiline küsimus (Phase 2)

Plaan tõstatab: kas jätkata VS Code OSS forki kujul või separeerida?

Praeguse arhitektuuri kulud:
- 6 patch faili (~3571 rida)
- ~500MB+ install size
- Workspace Trust, debug, tasks — tarbetu kasutajale
- Patch maintenance iga upstream sync'il

Alternatiivid: A) jää VS Code OSS, B) Pure Electron + Monaco/TipTap, C) Tauri, D) Hybrid Electron shell + VS Code Server

Phase 2 research lahendab selle küsimuse enne implementatsiooni.
