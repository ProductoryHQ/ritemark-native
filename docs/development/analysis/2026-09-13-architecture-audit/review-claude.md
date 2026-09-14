# Ritemarki sihtarhitektuur: strateegiline hinnang Codexi auditile

Kuupäev: 2026-09-13. Alus: [conclusions.md](conclusions.md) aluscommit `30ea2ab3`.
Staatus: ettepanek, millest saab vajadusel D2 otsusememo `ritemark-dev/decisions/`.
Mitte heaks kiidetud. Ei ole tööplaan.

## 1. Hinnang auditi ettepanekule

Auditi suund on õige: VS Code jääb, ühised reeglid koondatakse, runtime'id,
vormingud ja salvestus muutuvad adapteriteks. Ettepanek jätab aga valimata
keskme. Kuus mõistet on esitatud võrdsetena ja kolm mehhanismi (tuum,
koordinaatorprotsess, vahendatud kirjutus koos hallatud töökoopiaga) on pakutud
ilma otsustamata, milline neist kannab toote lubadust. Ilma keskmeta muutub
"tuum" abstraktsioonikihiks, millel pole esimest tarbijat, ja üleminek jääb
esimesse etappi ("lepime mudeli kokku").

## 2. Raskuskese: see, mida VS Code ei anna

VS Code annab juba ruumi (workspace, multi-root), ressursi (URI, TextDocument,
CustomDocument), failiteenuse, watcherid, hot exit'i, aknad, editorid ja isegi
FileSystemProvider'i. Neid ei tohi Ritemarki tuumas uuesti omada. Audit riskib
sellega, kui ütleb, et "ressursil on identiteet ja versioon" tuuma sees.

VS Code ei anna, ja ükski konkurent ei anna hästi, **arusaadavat ühist ajalugu
sellest, kes mida muutis ja millise alusversiooni suhtes**: inimene, milline
agent, milline voor, milline väline programm; üle kõigi vormingute ja akende.
See on sõna-sõnalt toote lubadus: nii inimese kui agendi töö peab olema ühises
nähtavas kontekstis arusaadav. Cursor ja Copilot teevad seda koodile ühe vooru
piires. Obsidian teeb failitaastet. Google Docs teeb autoriga versiooniajalugu.
Keegi ei tee agendile omistatud ajalugu suvalistele kohalikele failidele.

Seega on Ritemarki arhitektuuriline raskuskese **ruumi pearaamat**: ruumipõhine
lisanduv kirje muudatustest (osaline, voor, alusversioon, puudutatud ressursid,
sisu snapshot) ja töödest (mis jookseb, kes omab, kuidas katkestada). Auditi
kuus mõistet on selle projektsioonid: ruum on pearaamatu ulatus, ressurss on
võti, tööversioon on kinnitamata delta pea suhtes, muudatus on kirje, töö on
kirje liik, osaline on autoriväli.

Pearaamat lahendab kolm auditis eraldi seisvat probleemi ühe mehhanismiga.
Versioonitud muudatused: pearaamat on versioon, vorming annab ainult snapshoti.
Akendeülene omand: pearaamatul on üks kirjutaja. Pilvesünk: pearaamat on
sünkroonimislogi, täpselt see struktuur, mida lokaalsed sünkimootorid vajavad.

## 3. Neli strateegilist otsust

### O1. Avastamine ja taastamine, mitte ennetamine

Hallatud töökoopia native runtime'idele tuleb tagasi lükata. See rikub "ühe
nähtava failipuu" lubadust (agent töötab koopial, mida kasutaja ei näe),
dubleerib ketta ja lisab masina sisse sünkimise. Ja see ei kata niikuinii
väliseid kirjutajaid: Word, Excel, OneDrive, git.

Aus positsioon: Ritemark ei saa native runtime'i ega välise programmi
kirjutust ära hoida. Ritemark saab garanteerida, et midagi ei kao ja kõik on
omistatav. Mehhanism: snapshot enne iga kirjutust, mida Ritemark ise juhib;
snapshot agendi vooru alguses; watcher ja sessiooni ID omistavad vooru lõpus;
tekstile kolmepoolne merge (Markdownil juba olemas), binaarile konfliktikoopia.
Vahendatud kirjutus (ACP failimeetodid, Claude SDK hookid, Codexi approval-diff)
on täiendus seal, kus runtime seda toetab: ta annab täpse alusversiooni.

CRDT jääb sihtarhitektuurist välja. Ritemarki koostöö on inimene pluss agendid,
valdavalt voorupõhine, seega git-laadne. TipTap kannab Yjs-koostööd kaasas; kui
mitme inimese reaalajas redigeerimine kunagi tootesse tuleb, on uks Markdowni
jaoks olemas ja pearaamat ei sulge seda.

### O2. Ritemark Service: üks kohalik tööprotsess, põhjus on taustatöö

Audit põhjendab koordinaatorprotsessi mitme akna lukustusega. See on nõrgim
põhjendus: mitu akent on harv ja leitud topeltkäivitused olid ääretingimused.

Tugev põhjendus on toode. Ritemark juba lubab taustatööd: ajastatud Flowd,
ajastatud agendid (daemon), pikad transkriptsioonid, peagi sünk ja Google Docsi
avaldamine. Täna elab see kõik ühe akna laiendusprotsessis kolme eraldi
ajastaja käes: `daemon/Scheduler`, `flows/FlowScheduler`, `speech/JobManager`.
Akna sulgemine tapab töö või märgib selle valesti katkenuks (A20).

Service on tööde käivitaja, pearaamatu kirjutaja ja hiljem sünkimootori host.
Aknad on kliendid. Piirangud: extension-tier (laiendusprotsess spawnib, lukufail,
mitte VS Code'i patch), eluiga kuni viimase akna sulgemiseni pluss drain,
alguses mitte OS-teenus, olek taastub pearaamatust, lipu taga in-host varutee.
Boonus on tootediferentseerija: agent jätkab, kui dokument on kinni pandud.

### O3. Runtime'i leping ACP kujul

Turg on koondunud. Zed 1.0 (aprill 2026) jooksutab paralleelseid agente üle
ACP; JetBrains lisas ACP toe detsembris 2025; avalik ACP agendiregister avati
jaanuaris 2026 Claude Code'i, Codexi, Gemini ja OpenCode'iga; Claude Code'il ja
Codexil on ACP adapterid, OpenCode on native. Ritemarki `RuntimeSession` on juba
ACP kujuga (createSession, prompt, cancel, onProgress, onApprovalRequest) ja
ACP klient on olemas.

Otsus: sisemine leping on ACP semantika pluss deklareeritud võimekuslaiendused.
Thinking effort, plan mode ja continuation jäävad vendori-native võimekusteks
`capabilities.ts` mustris. Tagajärg: iga ACP agent on registrikirje, mitte
sprint; pearaamatu vahendatud kirjutuse hook tuleb ACP failimeetoditest tasuta;
Flow sõlmed muutuvad töödeks, mis kasutavad sessioone, ja FlowEditorProvideri
teine mootor kaob. Lukustatud otsus "kolm täitmiskuju" säilib: kuju erineb,
torustik on ühine.

### O4. Vormingute kolm astet ja pinna eelarve

Ritemark ei peaks püüdma olla iga vormingu editor. Kolm astet:

| Aste | Vormingud | Leping |
| --- | --- | --- |
| Native | Markdown, CSV, tekst | muutmine, sünk, kolmepoolne merge, agent loeb tekstina |
| Struktuurne | XLSX, draw.io | täisdokumendi asendus, pearaamatu snapshot, konfliktikoopia |
| Eelvaade | PDF, DOCX, PPTX | ainult lugemine, värskuse olek, Markdowniks teisendus eraldi tööna |

Adapter deklareerib astme, UI tuletab võimalused. Iga aste on omaette webview
entry koos CI eelarvega. Markdowni tuum-entry saab range eelarve, mis mõõdetakse
referents-Windowsi masinal. See tapab ambitsioonivea (PPTX muutmine, universaalne
fidelity) ja teeb "lisa vorming" esmalt astmeotsuseks.

## 4. Mida teadlikult ei tehta

- Tuum, mis omab dokumendi identiteeti VS Code'i asemel.
- Hallatud töökoopia.
- CRDT üldmehhanismina.
- Virtuaalne failisüsteem pilve jaoks. Native runtime vajab päris cwd-d, seega
  pilveruum on alati kohalik materialiseering pluss sünk. Google Docs on
  avaldamissiht (töö liik), mitte salvestusadapter. Kolmanda osapoole
  sünkitud kaustad on lihtsalt kohalikud kaustad välise kirjutajaga.
- OS-taseme deemon.
- Eraldi "domeenimudeli kokkuleppimise" etapp ilma esimese tarbijata.

## 5. Üleminek: kägistaja pearaamatu ümber

| Etapp | Sisu | Mida see lahendab |
| --- | --- | --- |
| 0 | D2 otsusememo neljale otsusele | suund |
| 1 | Pearaamat v0: `.ritemark/ledger` ruumi kohta (SQLite või JSONL pluss sisuaadressitud blobid); snapshot enne kirjutust viies Ritemarki juhitavas kirjutajas (editori save, XLSX save, draw.io save, ACP proxy, Flow SaveFile); vooru alguse/lõpu omistus agendisessioonidele; üks UI: "see voor muutis" ja taasta. Markdown ja XLSX koos, et pearaamat ei kujuneks tekstispetsiifiliseks | A01, A05, A16 taastamisena; toote diferentseerija |
| 2 | Service: kolm ajastajat, transkriptsioon ja pearaamatu kirjutaja ühte protsessi; aknad liituvad; lipp ja varutee | A06, A20, topeltkäivitus struktuurselt |
| 3 | ACP-kujuline leping; Flow mootori kokkuvarisemine; neljas runtime registri kaudu | A07, A11, A15 |
| 4 | Sünk: pearaamatu replikatsioon ritemark-cloudi (entitlement `sync` on lepingus juba ette nähtud); mitme seadme merge serveris; eraldi D-memo | pilveruumid |

Paralleelne rada: pinna eelarved. v1.12.0 Sprint 124 Office asset boundary on
esimene lõige; laiendada Markdowni tuum-entry'le; `activationEvents: ["*"]`
asendada võimekuspõhistega; runtime'i probe'id ja ajastajad Service'i, akna
käivitustee lüheneb.

Seos roadmapiga: v1.11.0 ja v1.12.0 ei blokeeru. Sprint 118 (salvestus) ja
119 (Google Docs) tuleb vormida töödena, millel on omanik, edenemine ja
katkestus, et need liiguks hiljem Service'i muutmata. Sprint 124 vormida
pinna-entry mudelina. Auditi terviklusvead (CSV jt) on eraldi väike sprint ja
ei sõltu ühestki etapist.

## 6. Riskid

- Pearaamatu kettakasv: sisuaadressitud blobid, retention, GC.
- Service Windowsil: named pipe, AV, crash-loop; lipp ja in-host varutee.
- ACP kuju ei kata vendori eripära: võimekuslaiendused, juba olemasolev muster.
- Omistuse ebaselgus, kui inimene ja agent kirjutavad samal sekundil:
  vahendatud kirjutus on ülimuslik, UI näitab ebakindlust ausalt.
- Keerukuse eelarve ühe inimese pluss agentide tiimile: pearaamat v0 peab
  olema väike, üks store, üks hook, üks paneel.

## 7. Otsused Jarmole

1. Kas kese on pearaamat, mitte "tuum"?
2. Kas Service on tööde protsess (mitte OS-deemon, mitte lukuhaldur)?
3. Kas runtime'i leping võtab ACP kuju?
4. Kas vormingute astmed ja pinna eelarved saavad merge-väravaks?

Allikad ACP turu seisule: [Zed: Claude Code via ACP](https://zed.dev/blog/claude-code-via-acp),
[Zed: ACP progress report](https://zed.dev/blog/acp-progress-report),
[agentclientprotocol.com agents](https://agentclientprotocol.com/get-started/agents),
[claude-code-acp npm](https://www.npmjs.com/package/@zed-industries/claude-code-acp).
