# Sprint 01: Windows Onboarding Fix + Arhitektuurne Hindamine

## Eesmärk

Likvideerida 4 onboarding-tõket mis muudavad Ritemarki esmainstalli Windows puhtal masinal tavakasutaja jaoks läbimatuks, ning teha arhitektuurne hindamine pikaajalise suuna kohta.

## Feature Flag Check

- [ ] Kas see sprint vajab feature flag'i?
  - Phase 1 muutused (Workspace Trust off, auth fix, in-app login) on bug fix'id — ei vaja feature flag'i
  - Phase 3 bundled installer on platvormi-spetsiifiline (Windows-first) — flag võib olla vajalik kui Mac parity hiljem lisatakse
  - **Otsus:** Phase 1 ei vaja flag'i. Phase 3 flag'i vajadus hinnatakse Phase 2 järel.

---

## Kontekst

Jarmo testis Ritemarki Windows puhtal masinal ja tuvastas 4 probleemi mis blokeerivad "download → töötav AI" flow'd tavakasutaja jaoks:

1. **Workspace Trust Restricted Mode** — extension ei laadu, kasutaja arvab et toode on katki
2. **"Connected" valetab** — Settings UI näitab Claude Account = Connected kuigi kasutaja pole sisse logitud
3. **Codex install vajab admin PowerShelli** — execution policy blokkib, tavakasutaja ei saa läbi
4. **Git ja Node puuduvad** — toode teatab "not detected" ilma lahenduseta

Strateegiline küsimus: kas jätkata VS Code OSS forki kujul või teha tugev eraldus?

---

## Edukriteeriiumid

### Phase 1
- [ ] Windows puhtal masinal .md faili avamine ei näita Restricted Mode dialoogi
- [ ] `claude logout` järel Settings näitab "Sign In" nuppu, mitte "Connected"
- [ ] "Sign In to Claude" nupp Settings'is käivitab OAuth flow ja uuendab olekut
- [ ] Kõik muutused töötavad macOS-il (ei lõhu olemasolevat)

### Phase 2
- [ ] `docs/development/analysis/cli-bundling-research.md` — kõik bundling küsimused vastatud, recommendation antud
- [ ] `docs/development/analysis/vscode-fork-vs-separation.md` — variantide analüüs + recommendation Jarmole

### Phase 3
- [ ] (Sõltub Phase 2 tulemustest — kas Variant A installer või arhitektuurne migratsioon)

---

## Deliverables

| Deliverable | Kirjeldus |
|-------------|-----------|
| Workspace Trust fix | `branding/product.json` — üks rida, kohe laetav |
| Auth validation fix | `setup.ts` — token kehtivuse kontroll enne "Connected" näitamist |
| In-app login nupp | "Sign In to Claude" nupp Settings'is, OAuth flow |
| CLI bundling research | Decision matrix — installer size vs offline vs update flexibility |
| Arhitektuurne analüüs | A/B/C/D variantide võrdlus, recommendation |
| Phase 3 plaan | Kas Inno Setup bundled installer VÕI migration sprint (sõltub Phase 2) |

---

## Implementeerimise checklist

### Phase 1A: Workspace Trust (1 fail, 1 rida)
- [ ] Lisa `"security.workspace.trust.enabled": false` faili `branding/product.json` sektsiooni `configurationDefaults`
- [ ] Kontrolli et patch 001 või 002 ei override'i seda seadet

### Phase 1B: Auth validation fix
- [ ] Uuri `detectClaudeAuthMethod()` — kas keychain leiust piisab või vaja token validatsiooni
- [ ] Lisa auth validatsioon: spawni `claude --status` või ekvivalent, kontrolli exit code
- [ ] Uuenda `deriveClaudeSetupStatus()` — "ready" ainult kui auth on kinnitatud kehtiv
- [ ] Test: `claude logout` järel state peab olema `needs-auth`, mitte `ready`

### Phase 1C: In-app /login flow
- [ ] Lisa `triggerClaudeLogin()` funktsioon `setup.ts` faili
- [ ] Lisa "Sign In to Claude" nupp `RitemarkSettings.tsx` — nähtav `needs-auth` olekus
- [ ] OAuth callback käivitab settings reload (kasuta olemasolevat `setClaudeLoginInProgress`)
- [ ] Test: nupp käivitab OAuth flow, tagasi tulles näitab "Connected"

### Phase 2: Deep Research (koodi ei kirjutata)
- [ ] CLI bundling research → `docs/development/analysis/cli-bundling-research.md`
- [ ] Arhitektuurne hindamine → `docs/development/analysis/vscode-fork-vs-separation.md`
- [ ] Esita Jarmole mõlemad dokumendid otsuse tegemiseks

### Phase 3: Implementation (post-research, eraldi approval gate)
- [ ] (Täpne scope selgub pärast Phase 2 + Jarmo otsust)
- [ ] Kui Variant A: Inno Setup bundled installer komponendi-checkbox'idega
- [ ] Kui Variant B/C/D: Eraldi migration sprint

---

## Riskid

| Risk | Tõenäosus | Mõju | Maandamine |
|------|-----------|------|------------|
| Auth validation spawni aeglus | Madal | Keskel | Cache tulemus, timeout 5s |
| OAuth callback ei tule tagasi | Keskmine | Kõrge | Timeout + manual refresh nupp |
| Patch 001/002 override'ib Workspace Trust | Madal | Kõrge | Kontrollida enne commit'i |
| Phase 2 ütleb "rewrite everything" | Madal | Kõrge | Phase 1 fix'id on kasulikud kõikide variantide jaoks |
| macOS regressioon | Madal | Kõrge | Testida mõlemal platvormil |

---

## Sprindi struktuur ja ajakava

```
Sprint 01
├── Phase 1: Quick wins          (1–2 päeva)
│   ├── 1A: Workspace Trust fix  (30 min)
│   ├── 1B: Auth validation      (2–4 tundi)
│   └── 1C: In-app login nupp    (4–8 tundi)
├── Phase 2: Deep research       (1 nädal, sõltumatu)
│   ├── 2.1: CLI bundling        (2–3 päeva)
│   └── 2.2: Arhitektuurne       (2–3 päeva)
└── Phase 3: Implementation      (2–4 nädalat, post-research)
    └── (scope selgub Phase 2 järel)
```

---

## Olekud ja approval gate'id

```
Praegune faas: 2 (PLAN)
Järgmine gate:  HARD GATE — Jarmo peab kinnitama enne Phase 3 (implementatsioon)
```

**Phase 1 → Phase 2:** Automaatne (Phase 1 on bug fix, research on sõltumatu)

**Phase 2 → Phase 3:** HARD GATE — Jarmo peab kinnitama pärast research dokumentide lugemist, otsustab kas Variant A (installer) või arhitektuurne migratsioon.

**Implementatsioon → Test:** Automaatne (qa-validator)

**Test → Deploy:** HARD GATE — qa-validator pass required

---

## Approval

- [ ] Jarmo on kinnitanud selle sprint plaani (`approved` / `proceed`)
