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

## Tehniline piirang: Ritemark'i editor on webview

**KRIITILINE:** Ritemark'i markdown editor on TipTap-põhine **custom webview**, MITTE VS Code'i tavaline teksteditor. See tähendab:

- **Spell check extensionid EI TÖÖTA** — Code Spell Checker, LTeX jne näevad ainult VS Code'i tavalisi teksteditoreid, mitte meie webview'd
- **Linting extensionid EI TÖÖTA** — markdownlint, Prettier jne ei näe Ritemark'i editori sisu
- **Formatting extensionid EI TÖÖTA** — Markdown All in One kiirkäsud ei rakendu webview'ile
- **Mis TÖÖTAB:** Extensionid mis avavad **oma eraldi vaate/editori** oma failiformaadile

### "Standalone" reegel

Extension peab vastama ühele neist:
1. **Oma custom editor** — avab kindlat failiformaati omas editoris (nt Draw.io → `.drawio` failid)
2. **Oma panel/vaade** — pakub iseseisvat funktsionaalsust sidebar'is või eraldi paneelis
3. **Oma failiformaat** — lisab uue failiformaadi toe mida Ritemark ise ei toeta
4. **Taustateenus** — töötab taustal ilma editori integratsioonita (nt Git, sync)

**EI SOBI:** Extension mis eeldab ligipääsu aktiivsele teksteditorile (spell check, autocomplete, inline suggestions, diagnostics).

---

## Valikuprintsiibid

### 1. Kasutaja on kirjutaja, mitte arendaja

Sihtrühm: kirjutajad, uurijad, turundajad, analüütikud. Nad **ei kasuta terminali**, **ei kirjuta koodi** igapäevaselt. Iga soovitatud extension peab olema arusaadav inimesele, kes ei tea mis on ESLint.

**Reegel:** Kui extension nõuab konfiguratsiooni faili (`.eslintrc`, `tsconfig.json`), siis see **ei sobi** soovituste nimekirja.

### 2. Office Suite, mitte IDE

Mõtle extensionidest kui **rakendustest kontoripaketis**:
- Word → teksti tööriistad (oma editoriga)
- Excel → andmete tööriistad (oma editoriga)
- PowerPoint → visuaalsed tööriistad (oma editoriga)
- Finder/Explorer → failihaldus

**Reegel:** Extension peab sobituma "Office" metafoori, mitte "IDE" metafoori.

### 3. Standalone — avab oma ukse

Extension peab töötama **iseseisvalt**, mitte integreeruma Ritemark'i editoriga. See on "rakendus kontoripaketis", mitte "plugin editorile".

**Reegel:** Extension peab avama oma custom editor, paneel, või vaade. Mitte süstima sisu olemasolevasse editorisse.

### 4. AI-first, mitte AI-optional

Ritemark'i tugevus on multi-provider AI integratsioon. Extensionid peaksid:
- Täiendama AI töövoogusid (mitte konkureerima nendega)
- Pakkuma andmeid/konteksti mida agendid saavad kasutada
- Olema kasulikud ka ilma AI-ta (offline-first)

### 5. Kvaliteet > kvantiteet

Parem 8 head extensioni kui 40 keskpärast. Iga extension nimekirjas on **Ritemark'i meeskonna soovitus** — see on brändi lubadus.

**Reegel:** Maksimaalselt 12-15 extensioni. Kureeritud, mitte kataloog.

---

## Kategooriad

### Visuaalsed tööriistad (Visual Tools)

"Office for agents" vajab rohkemat kui teksti — diagrammid, joonistused, visuaalid. Need on **kõige tugevamad kandidaadid** kuna neil on oma editor.

| Extension | Miks sobib | Tüüp | Prioriteet |
|-----------|-----------|------|------------|
| Draw.io Integration | Diagrammid, vooskeemid — avab `.drawio` failid omas editoris | Custom editor | Kõrge |
| Pencil.dev | Joonistamine ja visuaalne mõtlemine | Custom editor | Kõrge |
| Mermaid Preview | Mermaid diagrammide eelvaade (täiendab Ritemark'i sisseehitatud Mermaid tuge) | Preview panel | Keskmine |

### ~~Andmed ja analüüs~~ — EEMALDATUD

Ritemark'il on juba **sisseehitatud**:
- **CSV editor** (Data režiim) — redigeerimine, sorteerimine, ridade lisamine
- **Excel/XLSX eelvaade** — multi-sheet, virtual scrolling
- **PDF vaataja** — sisseehitatud PDF viewer

Rainbow CSV, Data Preview, vscode-pdf **konkureerivad** meie enda funktsioonidega ja tekitavad segadust (kumb editor avaneb?). Ei soovita.

### Koostöö ja versioonihaldus (Collaboration)

"Office" tähendab ka meeskonnatööd.

| Extension | Miks sobib | Tüüp | Prioriteet |
|-----------|-----------|------|------------|
| GitLens | Git ajaloo visuaalne vaade — kes mida muutis, blame, graph | Oma panels/views | Keskmine |
| Live Share | Reaalajas koostöö | Taustateenus | Madal |

### Teemad ja isikupärastamine (Themes)

Kirjutajad hoolivad oma töökeskkonna välimusest. Teemad töötavad alati kuna need muudavad VS Code'i üldist välimust, mitte ainult editorit.

| Extension | Miks sobib | Tüüp | Prioriteet |
|-----------|-----------|------|------------|
| 1-2 kureeritud teemat | Ritemark'i esteetikaga sobivad kirjutaja-sõbralikud teemad | Teema | Madal |

---

## Mida MITTE soovitada

### Tehnilistel põhjustel (ei tööta Ritemark'i webview editoriga)

| Extension | Miks EI TÖÖTA |
|-----------|---------------|
| Code Spell Checker | Näeb ainult VS Code'i tavalisi teksteditoreid, mitte TipTap webview'd |
| markdownlint | Diagnostikad ei ilmu Ritemark'i editoris |
| Markdown All in One | Kiirkäsud ei rakendu webview'ile |
| Prettier | Formatting ei ulatu webview'i sisuni |
| Grammarly | Sama probleem — ei näe webview sisu |
| LTeX (LanguageTool) | Spell/grammar check ei tööta webview's |

### Konkureerib Ritemark'i sisseehitatud funktsioonidega

| Extension | Miks EI sobi |
|-----------|-------------|
| Rainbow CSV | Ritemark'il on oma CSV editor (Data režiim) |
| Data Preview | Ritemark'il on oma CSV editor |
| vscode-pdf | Ritemark'il on oma PDF viewer |
| Excel Viewer | Ritemark'il on oma XLSX eelvaade |

### Positsioneerimise põhjustel (vale sihtrühm)

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

Nimekirjas **esimesed** on need, mis annavad kohe väärtust ja töötavad kindlalt:

1. **Pencil.dev** — disain + MCP agendi-integratsioon, JSON-põhine `.pen` formaat, Figma-sarnane canvas. Parim "Office for Agents" showcase.
2. **Draw.io Integration** — diagrammid, oma editor, XML-põhine, agent saab luua/muuta
3. **Mermaid Preview** — täiendab sisseehitatud Mermaid tuge, plaintext formaat
4. **GitLens** — versiooniajalugu visuaalselt

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
| Ritemark Spell Check | Oma spell check mis töötab TipTap webview'is (mitte VS Code API kaudu) |

### Kolmanda osapoole partnerlused

Extensionite autorid, kellega koostöö võiks sobida:
- **Pencil.dev** (`highagency.pencildev`) — Figma-sarnane disainitööriist otse editoris. `.pen` failid on puhas JSON, MCP server annab agentidele täieliku lugemis- ja kirjutamisõiguse. Ideaalne "Office for Agents" näide: kasutaja disainib, agent genereerib koodi, või vastupidi.
- **Draw.io** — diagrammid ja vooskeemid, `.drawio` on XML
- **Zotero** (kui VS Code extension tuleb) — akadeemiline tsiteerimine

---

## Otsustuskriteeriumid uute extensionite lisamiseks

Enne extensioni lisamist soovituste nimekirja, vasta:

1. **Kas see on standalone?** Oma editor, panel, või vaade? (Jah/Ei) — **BLOKEERIV**
2. **Kas see nõuab ligipääsu aktiivsele teksteditorile?** (Ei = OK) — **BLOKEERIV**
3. **Kas tavakasutaja saab sellest aru?** (Jah/Ei)
4. **Kas see töötab out-of-the-box?** Ilma konfiguratsioonifailideta? (Jah/Ei)
5. **Kas see täiendab Text/Data/Flow režiimi?** (Jah/Ei)
6. **Kas see konkureerib Ritemark'i sisseehitatud funktsioonidega?** (Ei = OK)
7. **Kas AI agent saab selle failiformaadiga töötada?** (Jah = boonus) — vt allpool
8. **Kas see on aktiivselt hooldatud?** (>100k allalaadimist, viimane update <6 kuud)
9. **Kas see töötab offline?** (Eelistatud, mitte nõutud)

**Miinimum:** Küsimused 1-2 on blokeerivad. Küsimused 3-6 peavad olema positiivsed.

---

## Agendiühilduvus — "Office for Agents" võtmeküsimus

Kuna Ritemark on "Office for Agents", peab iga soovitatud extensioni puhul hindama: **kas AI agent (Claude, Codex) oskab selle failiformaadiga töötada?**

### Miks see oluline on

Kasutaja ootab, et agent saaks:
- Luua uue faili (nt `.drawio` diagrammi)
- Lugeda ja mõista olemasolevat faili
- Muuta faili sisu (nt lisada diagrammi node)

Kui agent ei saa failiformaadiga midagi teha, siis on see "tavaline tööriist", mitte "agendi tööriist".

### Hinnang praegustele kandidaatidele

| Extension | Failiformaat | Agent saab lugeda? | Agent saab luua? | Agent saab muuta? | Hinnang |
|-----------|-------------|-------------------|-----------------|------------------|---------|
| Draw.io | `.drawio` (XML) | Jah — XML on loetav | Jah — agent saab XML-i genereerida | Jah — XML node'ide lisamine/muutmine | Suurepärane |
| Pencil.dev (`highagency.pencildev`) | `.pen` (JSON) | Jah — puhas JSON, loetav | Jah — agent genereerib JSON struktuurid | Jah — MCP server (`read_canvas`, `get_style_guide`, write tools) | Suurepärane |
| ~~Rainbow CSV~~ | `.csv` | Jah | Jah | Jah | EEMALDATUD — Ritemark'il oma CSV editor |
| ~~Data Preview~~ | `.csv`/`.json` | Jah | Jah | Jah | EEMALDATUD — Ritemark'il oma CSV editor |
| GitLens | Git repo | Jah — git commands | N/A | N/A | OK (readonly) |
| Mermaid Preview | `.mmd` (plaintext) | Jah | Jah | Jah | Suurepärane |

### Agendiühilduvuse tasemed

1. **Suurepärane** — Agent saab faili luua, lugeda, muuta. Failiformaat on tekstipõhine (XML, JSON, plaintext). *Näide: Draw.io (.drawio on XML), Mermaid (.mmd on plaintext)*
2. **Hea** — Agent saab faili lugeda ja osaliselt muuta. *Näide: GitLens (git käsud)*
3. **Piiratud** — Agent näeb faili aga ei oska sisu mõistlikult muuta. *Näide: binaarsed failiformaadid*
4. **Puudub** — Agent ei saa failiga midagi teha.

**Eelistus:** Tase 1 (Suurepärane) extensionid esimesena soovituste nimekirja.
