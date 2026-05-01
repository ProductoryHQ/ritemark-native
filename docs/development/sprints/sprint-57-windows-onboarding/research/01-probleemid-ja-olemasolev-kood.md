# Sprint 57 Research 01: Windows Onboarding — olemasolev kood ja probleemid

> Note: this is the first code audit. The current sprint plan re-scopes the Claude in-app login work because the Settings button and provider message path already exist in the current codebase.

## Allikas

Analüüsi alus: `/root/.claude/plans/windows-puhas-masin-esmainstall-immutable-flute.md`

---

## 1. Workspace Trust — olemasolev olek

**Probleem:** VS Code default on "untrusted" → Restricted Mode → extension ei laadu esimesel avamisel.

**Fix-asukoht on selge:**

- `branding/product.json` → `configurationDefaults` sektsioon (read 47–54)
- Praegu `configurationDefaults` sisaldab ainult värviteema ja layouti seadeid
- Puudub `"security.workspace.trust.enabled": false`

**Risk:** Praktiliselt null — Workspace Trust on mõeldud koodibaasi turvalisuseks (tasks.json malicious commands). Markdown editori use case'is ebavajalik.

---

## 2. "Connected" vale olek — olemasolev kood

**Probleem:** Settings UI näitab Claude Account = Connected, aga kasutaja pole tegelikult sisse logitud.

### Kus probleem asub

`extensions/ritemark/src/agent/setup.ts` read 341–345:

```
} else if (input.authMethod === null) {
    state = input.loginInProgress ? 'auth-in-progress' : 'needs-auth';
} else {
    state = 'ready';  // ← siin — authMethod != null peetakse piisavaks
}
```

`detectClaudeAuthMethod()` (read 306–320) tagastab `'claude-oauth'` kui:
- macOS: `security find-generic-password -s 'Claude Code-credentials'` tagastab 0
- Windows: `cmdkey /list:Claude*` tagastab 0 ja stdout sisaldab "Claude"

**Probleem:** Keychain'is on credential olemas, aga token võib olla aegunud/kehtetu. Koodis pole tokeni kehtivuse kontrollimist.

### UI-pool (RitemarkSettings.tsx read 310–316)

```tsx
{(settings.componentStatus.claudeCode.state === 'ready'
  || settings.componentStatus.claudeCode.authMethod === 'api-key') && (
  <span className="flex items-center gap-1 text-xs text-ritemark-success">
    <Icon name="check" size={12} />
    Connected
  </span>
)}
```

"Connected" kuvatakse kui `state === 'ready'` VÕI `authMethod === 'api-key'`. Tegelik kehtivuse kontroll puudub.

### Auth validation muster olemas

`RitemarkSettingsProvider.ts` read 753–789 — API key testib actual HTTP call'iga. Sama muster tuleks rakendada OAuth tokenile.

---

## 3. In-app /login flow — olemasolev kood

**Probleem:** `/login` käsk on ainult terminali kaudu. Pole UI'st leitav.

### Olemasolev `needs-auth` olek

`RitemarkSettings.tsx` read 354+ — `needs-auth` olekus kuvatakse juba UI element (pole täpsemalt vaadatud, aga state on olemas). Vaja lisada nupp mis triggerdab login flow.

### Codex auth muster olemas

`extensions/ritemark/src/codex/codexAuth.ts` — Codex auth flow, saab kasutada mustrina Claude OAuth login triggerimiseks.

### Globaalne `setClaudeLoginInProgress` funktsioon

`setup.ts` read 381–384 — `setClaudeLoginInProgress(inProgress: boolean)` on olemas. Vaja ainult kutsuda seda ja käivitada `claude /login`.

---

## 4. Codex install — PowerShell execution policy

**Probleem:** `npm install -g @openai/codex` vajab admin PowerShelli (execution policy). Tavakasutaja jaoks läbimatuks.

**Praegune olek:**
- `codexAuth.ts` haldab Codex auth, aga install flow nõuab admin'i
- Phase 1 fix ei kata seda täielikult — see on Phase 3 installer probleem
- Phase 1 saab lisada parema error messaging'u (nt "requires admin shell" hint)

---

## 5. Git ja Node puuduvad

**Praegune olek:**
- `getHealthStatus()` meetod `RitemarkSettingsProvider.ts` read 522+ tagastab `nodeInstalled` ja `nodeVersion`
- UI näitab "not detected" aga ei paku lahendust
- See on Phase 3 bundled installer probleem, mitte Phase 1

---

## Kriitilised failid Phase 1 jaoks

| Fail | Muutus |
|------|--------|
| `branding/product.json` | Lisa `"security.workspace.trust.enabled": false` |
| `extensions/ritemark/src/agent/setup.ts` | Lisa auth validatsioon (token kehtivuse kontroll) |
| `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` | Uuenda `getComponentStatus()` auth status loogika |
| `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` | Lisa "Sign In to Claude" nupp, fix Connected badge |

---

## Phase 2 research scope

### 2.1 CLI bundling
Kõik küsimused on avatud — vaja uurida:
- Node.js portable bundling Windows EXE'le
- Claude Code CLI bundling võimalused (pkg/SEA)
- Codex CLI litsentsipiirangud
- Git for Windows portable vs MinGit
- Auto-update mehhanism bundled CLI'd jaoks

### 2.2 Arhitektuurne hindamine
- Variant A (VS Code OSS fork) vs B (Pure Electron) vs C (Tauri) vs D (Hybrid)
- Praegu 6 patch faili, ~3571 rida maintenance
- ~500MB install size, "developer tool" feel
- Otsus mõjutab Phase 3 implementatsiooni täielikult

---

## Järeldus

Phase 1 töö on hästi piiritletud ja madalriskne. Kõik vajalikud muutmiskohad on leitud. Phase 2 on research, mis ei nõua koodi kirjutamist. Phase 3 sõltub Phase 2 tulemustest.
