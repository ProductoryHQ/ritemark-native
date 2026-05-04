# Sprint 61 — Agent Library ikoonid ja värvid

**Status:** Phase 3 — IMPLEMENT (started 2026-05-04)
**Approval:** Jarmo confirmed plan in conversation 2026-05-04

## Context

Praegune Agent Library UI ([AgentLibraryViewProvider.ts](../../../../extensions/ritemark/src/views/AgentLibraryViewProvider.ts)) näeb välja nagu failipuu: monospace path'id (`.claude/agents/pr-reviewer.md`), ainult tekst, ei ole visuaalset hierarhiat. ChatGPT GPT store'i värvilised, ümarad ikoonid teevad agendi-nimekirja kohe sõbralikumaks ja "tootelikumaks" — kasutaja näeb ühe pilguga "see on review-tööriist" (sinine kontroll-linnukene) vs "see on disaini-tööriist" (lilla pintsel).

**Eesmärk:** asendada praegune tekstipõhine list ikoon + nimi + kirjeldus rea struktuuriga; ikoon ja värv on agendi/skilli `.md` frontmatter'is; kui frontmatter'is pole, siis heuristika pakub vaikimisi. Skoop = ainult see üks UI surface.

**Kasutaja valikud (kinnitatud):**
- Stiil: **Phosphor ikoonid + värviline ümar chip-taust**
- Storage: **agendi/skilli `.md` frontmatter** (`icon: clipboard-text`, `color: blue`)
- Scope: **ainult Agent Library list**
- Auto-pick: **jah** — nime/kirjelduse põhjal heuristika, kasutaja saab override'da frontmatter'is

* * *

## Ulatus

| Sees | Väljas |
|---|---|
| Agent Library webview (üks fail) | VS Code statusbar, command palette, @-mention picker |
| Frontmatter `icon` + `color` lugemine | UI ikoonivalija kasutajale (frontmatter editeerimine = manual) |
| Auto-suggest heuristika | Custom-uploaded ikoonid, emoji backend |
| ~32 curated Phosphor ikooni inline SVG | Phosphor kogu pakett (~1000 ikooni) |
| 8 brand-värvi paletti | Vabavärvi picker |

* * *

## Disainiotsused

### Ikoonisüsteem

Inline SVG path'id JS-objektina otse webview HTML-is — **ei** lisa Phosphor npm-paketti, sest webview on string-template ja `AgentLibraryViewProvider.ts:376` ei ole bundlitud. ~32 ikooni × ~200B path = ~6KB lisa, vastuvõetav.

**Curated set (33 ikooni, Phosphor regular weight 400):**

| Kategooria | Ikoonid (Phosphor nimi) |
|---|---|
| Code/Build | `code`, `terminal-window`, `git-branch`, `package`, `wrench` |
| Writing/Docs | `file-text`, `pen-nib`, `book-open`, `feather` |
| Review/QA | `clipboard-text`, `shield-check`, `bug`, `magnifying-glass` |
| Data/Analysis | `chart-bar`, `database`, `table`, `function` |
| Design/UI | `palette`, `layout`, `sparkle`, `magic-wand` |
| Communication | `chat-circle`, `megaphone`, `envelope`, `users` |
| AI/Agents | `robot`, `brain`, `cpu`, `lightning` |
| Productivity | `calendar-blank`, `target`, `flag`, `rocket-launch` |

### Värvipalett (8)

`indigo` (default), `blue`, `green`, `amber`, `red`, `purple`, `pink`, `slate` — joondatud `ritemark-design` tokens'iga. Iga värv = `{ bg, fg }` paar.

### Frontmatter laiendus

```yaml
---
name: pr-reviewer
description: Reviews pull requests
icon: clipboard-text     # optional — auto-pick fallback
color: blue              # optional — auto-pick fallback
---
```

Backwards compat: ilma `icon`/`color`'ita agendid saavad heuristika kaudu defaultid.

### Auto-suggest heuristika

| Keyword (nime või kirjelduse sees) | Ikoon | Värv |
|---|---|---|
| `review`, `validator`, `qa` | `clipboard-text` | blue |
| `release`, `ship`, `deploy` | `rocket-launch` | green |
| `sprint`, `plan`, `manager` | `flag` | amber |
| `marketer`, `marketing`, `content` | `megaphone` | pink |
| `ux`, `design`, `ui` | `palette` | purple |
| `vscode`, `build`, `compile` | `wrench` | slate |
| `webview`, `react`, `tiptap` | `layout` | indigo |
| `flow`, `workflow` | `git-branch` | blue |
| `feature-flag`, `flags` | `flag` | amber |
| `knowledge`, `docs`, `skill` | `book-open` | indigo |
| (default) | `sparkle` | indigo |

CLAUDE.md (peaagent) saab `robot` + indigo. Praegune tärni-staatus (★) jääb eraldi badge'ina.

### UI rida (uus layout)

```
[🟦 📖]  Knowledge Builder
         Meta-agent for creating new Claude Code skills…
```

- Ikoonichip: 32×32px, border-radius 8px, värvitaust 12% opacity
- Title: `font-weight: 500`
- Description (frontmatter `description`): teine rida, väiksem, muted, truncate 2 reaga
- Failipath → tooltip (hover) ja context menu Reveal
- Star (★) ja Warning (⚠) badge'id rea paremas ääres

* * *

## Failid

| Fail | Muudatus |
|---|---|
| `extensions/ritemark/src/agent/discovery.ts` | Loe `icon`, `color` frontmatter'ist; lisa väljad interface'idesse; kutsu `resolveIconAndColor()` |
| `extensions/ritemark/src/agent/iconPack.ts` | **UUS** — ikooni-SVG-d, värvipalett, heuristika |
| `extensions/ritemark/src/views/AgentLibraryViewProvider.ts` | Uus rea-template (chip + name + description); CSS lisad; SVG renderdus |
| `branding/ATTRIBUTION.md` | Phosphor MIT attribution |

* * *

## Verifitseerimine

1. `cd extensions/ritemark && yarn compile`
2. `./scripts/code.sh` (vt `rundev` skill)
3. Avage Agent Library sidebar:
   - Iga rida näitab värvilist ikoonichip'i
   - Hover ikoonil = tooltip näitab failipath'i
   - Project tab projekti agentidega, User tab `~/.claude/` omadega
   - Search töötab (nime + ID + path järgi)
   - Star (★) CLAUDE.md peaagendil
   - Warning (⚠) agendil ilma `description` frontmatter'ita
4. Heuristika test:
   - `pr-reviewer` ilma frontmatter'ita → clipboard-text + blue
   - `release-manager` → rocket-launch + green
   - `random-thing` → sparkle + indigo (default)
5. Override test: lisa `icon: bug`, `color: red` → reload → red bug ikoon
6. Theme test: light ↔ dark, kontrolli loetavust
7. Performance: 12 agents + 7 skills = 19 SVG-d, ei tohi olla lag'i

* * *

## Riskid

- **Phosphor path'ide kopeerimine käsitsi:** ~30 min käsitööd 32 ikooni jaoks. Alternatiiv (npm bundle) ei sobi sest webview pole bundlitud.
- **Värvipalett:** kasutame hardcoded brand-värve (mitte VS Code teemamuutujaid), sest design language on Ritemark.
- **Frontmatter validatsioon:** invaliidne `icon: nonexistent-name` → silent fallback auto-suggest'ile.
