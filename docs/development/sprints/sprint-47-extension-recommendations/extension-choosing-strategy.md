# Extension Choosing Strategy: Office for Agents

**Sprint 47 | 2026-03-28**

---

## Positioning Context

Ritemark Native on **"Office for Agents"** — kohalik, privaatne tööriistakomplekt kus AI agendid ja inimesed teevad koostööd. Kolm sisseehitatud režiimi:

- **Text** — WYSIWYG markdown kirjutamine AI-ga
- **Data** — CSV redigeerimine, Excel eelvaade
- **Flow** — visuaalsed AI töövood

Extensionite valik peab tugevdama seda identiteeti, mitte lahjendama seda VS Code'i üldise arendustööriista suunas.

---

## Valikuprintsiibid

### 1. Kasutaja on kirjutaja, mitte arendaja

Sihtrühm: kirjutajad, uurijad, turundajad, analüütikud. Nad **ei kasuta terminali**, **ei kirjuta koodi** igapäevaselt. Iga soovitatud extension peab olema arusaadav inimesele, kes ei tea mis on ESLint.

**Reegel:** Kui extension nõuab konfiguratsiooni faili (`.eslintrc`, `tsconfig.json`), siis see **ei sobi** soovituste nimekirja.

### 2. Office Suite, mitte IDE

Mõtle extensionidest kui **rakendustest kontoripaketis**:
- Word → teksti tööriistad (spell check, grammatika, vormindamine)
- Excel → andmete tööriistad (CSV, visualiseerimine)
- PowerPoint → visuaalsed tööriistad (diagrammid, joonistamine)
- Outlook → suhtlus (Git, koostöö)

**Reegel:** Extension peab sobituma "Office" metafoori, mitte "IDE" metafoori.

### 3. AI-first, mitte AI-optional

Ritemark'i tugevus on multi-provider AI integratsioon. Extensionid peaksid:
- Täiendama AI töövoogusid (mitte konkureerima nendega)
- Pakkuma andmeid/konteksti mida agendid saavad kasutada
- Olema kasulikud ka ilma AI-ta (offline-first)

### 4. Kvaliteet > kvantiteet

Parem 8 head extensioni kui 40 keskpärast. Iga extension nimekirjas on **Ritemark'i meeskonna soovitus** — see on brändi lubadus.

**Reegel:** Maksimaalselt 12-15 extensioni. Kureeritud, mitte kataloog.

---

## Kategooriad

### Kirjutamine (Writing Tools)

Ritemark'i tuumkasutus. Need extensionid teevad kirjutamiskogemuse paremaks.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| Code Spell Checker | Õigekirjakontroll — iga kirjutaja vajab seda | Kõrge |
| Markdown All in One | Kiirkäsud, TOC genereerimine, listi automaatjätkamine | Kõrge |
| markdownlint | Markdown'i kvaliteedikontroll, hoiab dokumendid puhtad | Keskmine |

### Visuaalsed tööriistad (Visual Tools)

"Office for agents" vajab rohkemat kui teksti — diagrammid, joonistused, visuaalid.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| Pencil.dev | Joonistamine ja visuaalne mõtlemine otse editoris | Kõrge |
| Draw.io Integration | Diagrammid, vooskeemid — täiendab Flows režiimi | Keskmine |

### Andmed ja analüüs (Data & Analysis)

Täiendab Data režiimi ja aitab struktureeritud infoga töötamisel.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| Rainbow CSV | CSV failide värvikodeerimine, päringud | Kõrge |
| Data Preview | Andmete visualiseerimine graafikutena | Keskmine |

### Vormindamine (Formatting)

Dokumendi kvaliteet ja järjepidevus.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| Prettier | Automaatne vormindamine — hoiab markdown'i puhtana | Keskmine |

### Koostöö (Collaboration)

"Office" tähendab ka meeskonnatööd.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| GitLens | Git ajaloo visualiseerimine — kes mida muutis | Keskmine |
| Live Share | Reaalajas koostöö dokumentidel | Madal |

### Teemad ja isikupärastamine (Themes)

Kirjutajad hoolivad oma töökeskkonna välimusest.

| Extension | Miks sobib | Prioriteet |
|-----------|-----------|------------|
| 1-2 kureeritud teemat | Ritemark'i esteetikaga sobivad teemad | Madal |

---

## Mida MITTE soovitada

Need extensionid on populaarsed VS Code's, aga **ei sobi** "Office for agents" konteksti:

| Extension | Miks EI sobi |
|-----------|-------------|
| Python, ESLint, TypeScript | Arendustööriistad — vale sihtrühm |
| Docker, Kubernetes | Infrastruktuur — vale sihtrühm |
| GitHub Copilot | Konkureerib Ritemark'i AI-ga |
| Remote SSH/Containers | Tehniline — pole kirjutajale vajalik |
| REST Client | API tööriistad — arendaja tööriist |
| Vim, Emacs keybindings | Arendaja eelistused |

---

## Soovituste järjekord

Nimekirjas **esimesed** on need, mis annavad kohe väärtust tavakasutajale:

1. **Code Spell Checker** — universaalselt kasulik
2. **Pencil.dev** — visuaalne mõtlemine, unikaalne väärtus
3. **Markdown All in One** — kirjutamise kiirustamine
4. **Rainbow CSV** — Data režiimi täiendus
5. **markdownlint** — dokumendi kvaliteet
6. **Draw.io Integration** — diagrammid
7. **Prettier** — automaatne vormindamine
8. **GitLens** — versiooniajalugu
9. **Data Preview** — andmete visualiseerimine

---

## Tulevikuvaade

### Ritemark'i enda extensionid

"Office for agents" saab tugevamaks kui Ritemark arendab ise juurde:

| Potentsiaalne extension | Kirjeldus |
|------------------------|-----------|
| Ritemark Templates | Dokumendimallid (blogi, koosoleku märkmed, uurimistöö) |
| Ritemark Tasks | Kanban tahvel agentide ülesannete haldamiseks |
| Ritemark Knowledge | RAG laiendus — PDF, DOCX, PPT kui teadmusbaas |
| Ritemark Publish | Otse avaldamine (blog, newsletter, CMS) |

### Kolmanda osapoole partnerlused

Extensionite autorid, kellega koostöö võiks sobida:
- **Pencil.dev** — visuaalsed tööriistad kirjutajatele
- **Grammarly** (kui VS Code extension tuleb) — professionaalne keeleabi
- **Zotero** (kui VS Code extension tuleb) — akadeemiline tsiteerimine

---

## Otsustuskriteeriumid uute extensionite lisamiseks

Enne extensioni lisamist soovituste nimekirja, vasta:

1. **Kas tavakasutaja saab sellest aru?** (Jah/Ei)
2. **Kas see töötab out-of-the-box?** Ilma konfiguratsioonifailideta? (Jah/Ei)
3. **Kas see täiendab Text/Data/Flow režiimi?** (Jah/Ei)
4. **Kas see konkureerib Ritemark'i sisseehitatud funktsioonidega?** (Ei = OK)
5. **Kas see on aktiivselt hooldatud?** (>100k allalaadimist, viimane update <6 kuud)
6. **Kas see töötab offline?** (Eelistatud, mitte nõutud)

**Miinimum:** Küsimused 1-4 peavad olema positiivsed.
