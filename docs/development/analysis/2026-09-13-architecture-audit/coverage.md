# Auditi katvus ja sõltumatuse kontroll

**Praegune töökorraldus:** kasutaja määras ülesandeks strateegilise
arhitektuurilahenduse, ilma üksikvigade edasise diagnoosi või parandamiseta.
[Sihtarhitektuur ja üleminekustrateegia](conclusions.md) seob toote põhimõtted,
põhimudeli, vastutuspiirid, valikud ning etapid. Allpool olevad U-tähised
kirjeldavad tõendi piire ega ole automaatne edasiste katsete tööplaan.

Aluscommit: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.
See on kontrollitud vastutuste ja tõendite register, mitte kõikide ridade
sertifitseerimine. Kolmandate osapoolte VS Code/Electroni, parserite ja
agendibinaaride sisemust hinnatakse Ritemarki integratsiooni, versioonimise,
isoleerimise ja käitumiskatsete kaudu; nende kogu lähtekoodi auditit ei väideta.

Tähised: **S** lähtekood kontrollitud, **T** komponenttest või olemasolev test
käivitatud, **H** ajalooline live-tõend (eraldi commit/keskkond), **M** selle
auditi mõõtmine, **U** vajalik rakenduse või sihtplatvormi kontroll veel puudu.
**L** tähendab selles auditis tehtud päris macOS-i rakenduskatset kontrollitud
laiendusega; vt [live-tulemused](live-observations.md) ja
[tavarežiimi katsed](normal-mode-observations.md). **N** tähendab päris binaari
ja toote adapteriga native-komponendikatset väljaspool GUI-d; vt
[native-tulemused](native-runtime-observations.md). Tabeli T/L/N ei tähenda,
et kõik selle rea käitumised on testitud.

PDF/DOCX/draw.io rakenduskatsed ja PDF-i 20 lehekülje vaatlus on
[vormingutulemuste dokumendis](format-observations.md).
AI sisu HTML/CSS/CSP rakenduskatse ja selle sünteetilise sisenemiskoha piirid on
[turvapiiri vaatlustes](security-observations.md).
Kahe tegeliku hosti vestlusesalvestus kasutab teadlikult juhitud rename-ajastust
ja sünteetilisi controller-kutseid; [salvestusvaatlused](shared-store-observations.md)
eristavad seda tavalisest UI/native mudelivoorust.
[Brauserikatse](browser-observations.md) kasutab tegelikku dispatcher/shell/Playwright
teed kahe sünteetilise kutsujaga; native agendisessioone ei käivitatud.
[Transkriptsiooni kahe hosti katses](speech-observations.md) olid provider, jobs,
püsivus ja vaated tegelikud; mootori vastus ning save-hoid olid piiratud
sünteetilised katsesisendid.
[Jõudluskatse](performance-observations.md) eristab värske rakendusprotsessi kuut
sooja Markdowni avamist ja eelmise protsessi profile/coverage vaatlusi.
CPU-aeglustus on rendereri tundlikkuse katse, mitte Windowsi emulatsioon.

## Alasüsteemid

Kõik source-viited lähtuvad `extensions/ritemark/` kataloogist, kui pole teisiti.
Üldise testikäsu ja lisakatsete tulemused on [tõendiregistris](evidence/README.md).

| Ala ja kontrollitud piir | Tõendid | Hinnang ning säilitatav tugevus | Järelejäänud kontroll |
| --- | --- | --- | --- |
| Shell, pane layout ja activation: src/extension.ts, patches/vscode/002, 003, 015 | S, T, L | Shelli patchid ja laienduse hilised focus-käsud määravad sama algse paanioleku; manifest aktiveerib kogu laienduse. Põhitoode saab kasutada VS Code failiteenust ja taastamist | L: terminal→AI hüpe nii uues kui korduvprofiilis. U: aktiivse sisestuse fookus, offline ja Windows |
| Webview delivery: vite.config.ts, main.tsx, App.tsx, provider HTML | S, M, L | Tootmisbuild taastub baiditäpselt; üks IIFE ühendab editori, viewerid, AI ja töövood. M/L: kuue väikese Markdowni avamise 1×/4× CPU katses oli ScriptDuration mediaan 301/1346 ms, ressursi laadimine 88/92 ms; eraldi profiil näitab ka ELK-i/parseri initsialiseerimist | L: sama bundle AI/Markdown/XLSX/PDF/DOCX kontekstides; protsesside RSS-snapshot olemas. U: külm launch/input, päris nõrk Windows ja browser/GPU mälu; soe Maci valim kasutab focus emulation'it |
| Markdown/CSV: ritemarkEditor, editorSync/*, Editor, SpreadsheetViewer, bridge/reducer | S, T, H, L | Revisjonid, epochid, täpsed ACK-id, base/model/disk klassifikatsioon, konfliktivalikud ja undo on tugev alus | L: Markdowni konflikt/use-disk/host-Undo, split/peer/keep-local ja ühe vaate sulgemine; CSV 10 005→10 000 rea kadu (A14). L: kahe hosti saved/draft/conflict/resolution ning tavarežiimi püsiv taastamine läbisid. U: samaaegne Save, native Quit/OS-crash, rename/delete/save-as ja native writes |
| XLSX/XLS: excelDocument/Provider, SpreadsheetViewer | S, L | Custom document, backup/revert ja dirty refresh confirmation olemas; XLS read-only. XLSX write precondition puudub; watcher suppression katab teisedki sündmused | L: tavaline Save kirjutas välise versiooni üle mõlemas proovis. L: tavarežiimi XLSX varukoopia/taastamine ja Save läbisid. U: samaaegne write, suppression-aken, native Quit/OS-crash ja Windows |
| PDF/DOCX: readonly providers, document objects, viewers | S, L, M | Põhireferentside tekst/kujundid, DOCX tabeli väärtused ja lehepiir renderdusid; DOCX Refresh ja PDF reopen toimisid. L: saabunud change/delete teated jäid nähtava olekuta (A17) | M: 20 PDF-canvas't jäid pärast kerimist alles; võrdelist RSS/heap kasvu ei tõendatud. U: keerukad/suured referentsid, GPU mälu, font/fidelity ja Windows; universaalset round-trip'i ei väideta |
| draw.io: drawioEditorProvider ja media/drawio | S, L | Eraldi renderer, SVG-s XML ja kohaliku muudatuse reopen toimisid. L: väline kujund jõudis TextDocument'i, kuid vana lõuendi autosave eemaldas selle (A16); tihendatud graaf dekodeeriti | U: kaks vaadet, save/error receipt ja katkestus; oma CSP sisaldab unsafe-eval erandit |
| Import/eksport ja pildid: export/v2, saveAsMarkdown, imageWriter | S, T | Ühine HTML-pipeline, kommentaaride eemaldamine, vigaste/pole-toetatud piltide ohutu vahelejätmine | U: vormingute infokao kuldproovid, tüpograafia ja suuruspiirid |
| Teadmusruumi identiteet: projectScope, workspaceFileLinks, internalLinkResolver | S, T | Vestlustel normaliseeritud multi-root/URI scope; linkide target-piirid kontrollitavad | U: valitud juure muutumine töötava sessiooni ajal; provider-backed remote workspace |
| Dokumendi ja agendi ühine kontekst: UnifiedViewProvider, capabilityContext, activeTranscript | S, T | Ühine agentidele antav võimekuste tekst ja aktiivse faili/valiku edastus olemas | Puudub versiooniga dokumendiviide muudatuse eeltingimusena; juhis kirjeldab toodet endiselt Markdowni-keskselt |
| Vestluse püsivus ja continuation: conversations/*, runtime/continuation | S, T, L | Kanooniline ajalugu, schema decode, quarantine, tombstone, dispatch/binding kontroll ja fallback continuation on tugev disain. L: järjestikused kahe hosti ja samaaegsed ühe hosti eelistusemuudatused säilisid | L: sama no-folder scope'i päris hostide juhitud põimumisel kadus kinnitatud vastus; mõlema UI readback ja uus protsess kinnitasid puudumist (A06). U: native mudelist pärit completion/cancel, loomulik sagedus ja muud crash-variandid |
| Runtime abstraction: runtime/*, ClaudeCodeRuntime, CodexRuntime, AcpRuntime | S, T | Ühine Session API, kindel factory, capability metadata, per-conversation routing ja piiratud attachment capacity | Leping sisaldab vendor-spetsiifilisi callback'e; Flows läheb osalt sellest mööda. U: kõik native cancellation/restart variandid |
| Claude SDK ja CLI: AgentRunner, setup/installer, auth, discovery | S, T | SDK/CLI versioonid seostatud manifestiga; Ask/Auto eristus ja mutation tool gating; continuation/auth taastamise testid | U: päris failitööriistad, network-failure, subagent/process cleanup sihtplatvormidel |
| Codex app-server: CodexRuntime, appServer/manager/protocol/approval/auth | S, T, N | Ühine app-server, per-conversation thread routing; N: kolm algatust → üks handshake, timeout/late reply, crash'i ootel päring, restart ja dispose läbisid | U: mudelivooru/native tööriista katkestus ja approvals; Flow executor kasutab eraldi event/approval teostust |
| ACP: client/manager/runtime/fsProxy | S, T, N | Workspace piir, write approval, protokolli lifecycle ja unknown-session deny; N: soe multi-session ning crash/restart/dispose läbisid | N: külma algatuse teine kutse sai not-initialized vea (A15). Stale read versiooni ei kontrollita. U: native prompt/cancel/fs-tool, GUI samaaegne start ja remote FS |
| Kooskõlastused ja tööriistapoliitika: UnifiedApprovalGate, runtime adapters | S, T | Üks UI request family ja native enforcement; gate'i cancel/dispose pole defineeritud | Approval promise'i lifecycle, sama requestId ulatus ja kadunud UI vastus vajavad lepingut; luba pole sisu värskuse garantii |
| Integreeritud brauser: BrowserActionTools, injector/MCP/IPC, shell patch 010 | S, T, L | L: snapshot-keeld, control Deny/Allow ja per-host queue töötasid; jagamise tühistamine katkestas ootel locatori | L: A vaatlus → B navigeerimine → A kirjutus muutis B lehte (A18); read-share false korral fill/Deny tagastas URL-i/pealkirja (A19). Tühistamise UI nupp oli peidetud; kasutati olemasolevat handler'it. U: native mudeli tööriistavoog, mitme saki omand ja inimnavigatsioon |
| Flow definitsioon, editor ja jooks: FlowStorage, FlowEditorProvider, FlowExecutor/nodes | S, T | Puhas DAG executor ja sõlmed testitavad; SaveFile kasutab workspace.fs watcher-notification'iks | Editoril teine jooksuteostus, osaline AbortSignal, otsene runtime/auto-approve poliitika. U: sulgemine jooksu ajal |
| Ajastatud Flow: FlowScheduler/FlowScheduleState | S, T, L | Ühe instance'i running set ja ajastusslot'i dedupe | T/L: sama slot täideti kahes päris aknas; sama Flow URI markerid elavad eri workspaceState'ides. U: crash/lease recovery ja idempotentsed välismõjud |
| Daemon: Scheduler, handlers, workspaceConsent, result store | S, T | Eksplitsiitne workspace opt-in, piiratud headless approval, tulemuste salvestamine | Eraldi scheduler/policy; töö eluiga seotud hostiga. U: aken kinni, restart ja paralleelsed hostid |
| Transkriptsioon: JobManager, SessionStore, engines, workbench | S, T, L | L: tegelik ühe hosti prepare/job/save/view tee läbis sünteetilise engine-vastusega; järjestikune kahe hosti rename säilis; peak-tempfailid koristati | L: B märkis A elusa töö katkenuks, A lõpetas edukalt (A20). Kahe tegeliku provider'i kinnitatud nime muutus kadus ka järjestikku vabastatud save'idega (A06). U: native mootor, pikk heli, crash pärast peer-recovery't ja native katkestus |
| Dikteerimine: voiceDictation/* | S | Editoripõhine chunk→whisper rada on transkriptsioonitööst eraldi | Hõivatud controller jätab chunk'i vahele; stop ei katkesta jooksvat whisper'it; temp cleanup pole alati finally. U: aeglase CPU helikadu |
| Seaded, mudelid, flags: settings, ai/modelConfig/modelCatalog, features | S, T | Catalog schema/fallback, tsentraliseeritud mudelid, platform/status flagid, eraldi secrets | Konfiguratsiooni ulatused erinevad; provider settings/native auth pole sama kui app'i seaded. Remote size cap kontrollib body't pärast terviklugemist |
| Turvapiirid: package capabilities, bridge handlers, ACP, renderer CSP | S, T, L | Nonce CSP, localResourceRoots, SecretStorage ja mitmed path-kontrollid; L: kaks inline-käsitlejat blokeeriti, kasutaja markup jäi tekstiks | L: assistendi CSS mõjutas päris Approve/Reject nuppe ja composer'it, HTTPS-pildi päring lubati ja vastati kohalikult (A08). Sünteetiline MessageEvent fixture ei tõenda bridge-forgery't ega native-approval bypass'i. Untrusted/virtual-workspace väide ületab kohalikku teostust. L: brauseri keelatud tegevuse meta ei järgi read-share piiri (A19) |
| Telemeetria/diagnostika: analytics/*, runtimeTrace, editor-sync logging | S, T | Tüübistatud sündmused, per-event opt-out/kill-switch; editor sync logib sisuta identiteete | Analytics opt-out vaikimisi sees; GeoIP lubatud; feedback sisaldab vabateksti. DebugTrace kirjutab payload'i piiratud kujul; flow logib prompt'i algust. U: andmeväljade tervikvalim ja retention |
| Binaarid/tarneahel: binaries/agents/manifest, bundledAgentRuntime, scripts/fetch/verify | S, T, L | Manifest ja SHA, target-specific staging, native matrix ja lukustatud SDK versioon | L: kõik neli darwin-arm64 manifesti validationArgs ja codesign strict läbisid. U: täielik protokolli lifecycle ja teised platvormid |
| Ehitus/patchid: scripts/build-prod*, apply-patches, build-provenance, CI | S, T, M | Puhtad füüsilised worktree'd, source/patch/lock digest, positiivsed ja negatiivsed QA fixture'id; host compile ja byte-identical webview | L: audit-extension path kinnitatud ühildavas installitud shellis; pole uut release-buildi. L: tavarežiimi staging ja tegelik püsiv restore kontrollitud. Source-map build ületas 4 GiB heap'i; tootmisbuild õnnestus |
| Update/install/recovery: update/*, release scripts, provenance | S, T | Bundled base + delta väldib poolikut laiendust; checksum, minApp, activation integrity ja N-1 rollback | T: extensionDirName path traversal. U: interrupted install/process concurrency ning allkirjastatud sihtplatvormi installer |

## Kolm muutmisproovi

Need on lähtekoodist tuletatud muudatuse teekonnad, mitte tootmisse lisatud
prototüübid. Eesmärk on hinnata, millised ärireeglid peaksid lisanduse tõttu
muutuma ja millised peaksid jääma samaks.

### Neljanda runtime'i lisamine

Ühine Session API annab sisulise alguspunkti. Uus adapter vajaks factory/AgentId,
capability metadata, mudeliseoste, auth/seadistuse, binaarimanifesti ning
packaging'u muudatusi; need on integratsiooni loomulikud osad. Praegu ulatuvad
muudatused ka UnifiedViewProvider'i ja UI vendor-harudesse, callback completion
erinevustesse ning Flow node type/dispatch/renderingusse. Mõni vana üldine
callback on nimetatud Codexi järgi ja seda kasutab ACP.

Järeldus: runtime-agnostilisus on **osaliselt teostatud**, mitte puuduv.
Järgmine piir on ühine accepted/progress/approval/result/cancel leping, mille
ümber uue adapteri lisamine ei muuda vestluse püsivust ega dokumendi reegleid.
Auth'i ja provider'i erivõimekuste UI ei pea muutuma kunstlikult identseks.

### Uue failivormingu lisamine

Vajalikud kohad on package.json custom editor selector, extension registration,
provider, App/entry routing, renderer dependency ja bridge payload. Praegu tuleb
lisaks iseseisvalt otsustada read/edit/export/conflict/backup/refresh behavior,
agent context ja faili ulatus; ühist format capability contract'i pole.
Üks IIFE lisab renderdaja koodi ka teistele pindadele. Draw.io tõendab, et
eraldi tarnepiir on olemasoleval platvormil võimalik.

Järeldus: laiendatavus vajab formaadi võimekuste ja dokumendi lifecycle'i lepingut.
PPTX võib alustada eelvaatena, kuid see ei tohi vaikimisi lubada redigeerimise,
fidelity või mitme osapoole koostöö garantiid. Ei ole põhjust nõuda iga formaadi
muutmist TipTapi mudeliks.

### Pilvepõhise teadmusruumi lisamine

Vestluse scope saab URI identiteediga hakkama. Native runtime'i cwd, Node fs
lugejad, fsPath'id, first-folder capture, FlowStorage ja watcher/poll on suuresti
kohalikud. Pilvesünkroniseeritud kohalik folder ja provider-backed URI on eri
juhud; mounted filesystem võib pakkuda path'i, kuid selle kooskõla/katkestused
vajavad endiselt lepingut.

Võimalik kohalik materialiseerimine peab kirjeldama cache'i identiteedi,
värskuse, kirjutuse eeltingimuse, reconnect'i, konfliktikoopiad ja agendi
õiguste ulatuse. Brokered tools on teine võimalus runtime'idele, mis seda
toetavad. Valikut ei saa taandada fs→workspace.fs mehaanilisele asendusele.

## Nõuete lõpetamise kontroll

| Kasutaja nõue | Praegune tõend | Seis |
| --- | --- | --- |
| Kogu komponendi-, protsessi-, sõltuvuste ja andmevoogude kaart | system-map + AST/build/history evidence + tabel ülal | Lähtekoodikaart ja tegelik macOS-i protsessi/RSS ning webview resource snapshot olemas; Windowsi ressursivalim puudu |
| Teadmusruumi, dokumendi, vestluse, agendi ja muudatuse omanik | system-map ownership + writer paths + concurrency probes | Kirjeldatud; split-view, kahe hosti dokumendikaitse ja Flow topeltkäivitus tõendatud. Vestluse tegeliku hosti juhitud põimumine, UI readback ja restart lisandusid; brauseri sihi ja nõusoleku päris tööriistatee lisandus; transkripti kahe hosti kaotatud rename ja elusa töö ekslik taastamine on nüüd tegelike objektide/vaadetega kontrollitud (sünteetiline engine-piir) |
| Kõik olulised alad süsteemselt hinnatud | Kõik tabeli read, kolm muutmisproovi, findings | Source assessment olemas; U read ei ole läbitud testid |
| Oletused kontrollitud koodi, ajaloo, testide ja mõõtmistega | Testid, QA, ehitus, failirassid, boundary probes, ajalooanalüüs | Mac launch, Markdown/CSV/XLSX, normal-mode recovery, kaks hosti ning native version/signature kontroll olemas. Kuus profilerita sooja avamise mõõtmist ja eraldi käivituskoodi profiil lisandusid. Codex/ACP ühenduse lifecycle olemas; Windows ja native mudeli/failitööriista töö pooleli |
| Tervikhinnang, tugevused, lokaalsed/süsteemsed probleemid, järjekord | audit-report + conclusions | Strateegiline lahendus seob ühise tuuma ja adapteripiirid etapiviisilise üleminekuga; Windowsi ja külmkäivituse täpseid näitajaid ei lubata |
| Strateegiline lahendus üldisest üksikule, sobiva detailsusega | conclusions, osad 1–7 | Põhisoovitus → toote põhimõtted → põhimudel/oleku omanikud → vastutus- ja protsessipiirid → alternatiivid/kompromissid → neli üleminekuetappi; praegune ja soovitatav on eristatud |

Katseviisi oluline piir: `--extensionDevelopmentPath` akendel pole VS Code
püsivat backupPath'i. Tavarežiimi staging ja püsivad varukoopiad on nüüd eraldi
kontrollitud: Markdown/XLSX taastusid ning sai salvestada. Kõiki sulgemis- ja
katkestusviise sellest ühest CDP-sulgemise proovist ei järeldata.

Lahtised kontrollid jäävad tõendi piiranguteks. Strateegiline soovitus ei
esita neid tehtuna ega sõltu üldise testimisprogrammi jätkamisest.
