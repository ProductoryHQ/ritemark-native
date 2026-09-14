# Rakenduskatsed ja nende arhitektuuriline tähendus

2026-09-13 · auditi aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.
Need on päris macOS-i rakenduse funktsionaalsed katsed. Windowsi jõudlust,
kõiki vorminguid ega kõiki mitme protsessi olukordi need ei tõesta.

## Keskkonna päritolu

Rakendus käivitati eraldi sünteetilise workspace'i, kasutajaprofiili ja
extension directory'ga. Hosti vaatlus kinnitas, et aktiivne `ritemark.ritemark`
laeti auditi worktree `extensions/ritemark` kataloogist, versiooniga 1.10.1.
Auditidraiver loeb VS Code tegelikke dokumendi- ja sakiseisundeid; muudatused
tehakse editori kasutajaliidese või tavalise Save käsu kaudu. Draiver keeldub
muust workspace'ist ning lubab ainult kindlaid sünteetilisi faile ja käske.
CDP vaatleb DOM-i, sisestab teksti ja saadab klahvisündmusi. Toote lähtekoodi
ega provider'i sisemisi puhvreid katse jaoks ei muudetud.

Shell on installitud Ritemark 1.10.1, provenance commit
`23493cef1f4d38cd997be5509e057cb75560fb5c`. Selle VS Code gitlink, shelli patchid
ja branding/product.json on auditi aluscommit'iga samad. See on kontrollitud
ühilduva shelliga arenduskäivitus, mitte auditi commit'ist tehtud uus release-build.
Darwin-arm64 agendibinaarid on installitud shelli sõltumatud APFS-koopiad;
manifest ja kopeeritud failide SHA-d kontrolliti. Vt [preflight](evidence/app-preflight.json),
[runtime'i päritolu](evidence/live-runtime-provisioning.json) ja
[käivituse seaded](evidence/live-session-first-launch.json).

Analytics, automaatsed uuendused ja ajastatud Flow'd on katseprofiilis keelatud,
automaatne failisalvestus väljas. Workspace trust on sünteetilise fixture'i jaoks
välja lülitatud; see jooks ei testi untrusted-workspace garantiisid. Ühtegi
mudelipäringut ega agentide failitööriista ei käivitatud. Käivituse enda
olekupäring käivitas Codex app-serveri. Fikseeritud kodukataloogi uuenduste
puhastamise kõrvalmõju kontrolliti enne käivitust: eemaldatavaid `ritemark-*`
versioonikatalooge polnud. Kasutaja installi ega starter library't ei muudetud.

## Kontrollitud tulemused

| Katse | Tegelik tulemus | Tähendus ja piir |
| --- | --- | --- |
| Puhas profiil: käivituse paanid | Editoriala nähtav 1,424 s; terminal fookuses 4,528 s; AI paan fookuses 9,552 s | A02 mehhanism kordub macOS-is. Üks umbes 100 ms sammuga instrumenteeritud vaatlus; ajad pole Windowsi benchmark ega taimerite registreerimise täpsed ajad |
| Markdown: väline muutus puhta mudeliga | Uus sisu jõudis tegelikku TextDocument'i ja nähtavasse editori; mudel jäi puhtaks | Üks vaatlus 208 ms. Tõendab host→vaade rada selles juhtumis, mitte latentsuse jaotust |
| Markdown: inimese salvestamata töö + väline asendus | Kohalik inimtekst jäi mudelisse, väline tekst kettale; Review changes avas valikud | Olemasolev konflikti koordinaator kaitses mõlemat versiooni |
| Markdown: Use disk version ja taastamine | Kettaversioon rakendus; TextDocument jäi dirty. Editorifookusega Cmd-Z ei taastanud vana kohalikku teksti; tavalise sisestuse undo kontroll töötas. Käsupaleti Undo taastas varasema kohaliku SHA | Hosti ja TipTapi ajalood on eri kihid. Ei ole alust väita, et inimversioon kadus; samuti ei saa lubada, et iga taastamisvalik on sama Cmd-Z kaudu pööratav |
| Markdown: kaks split-vaadet | Teises vaates tehtud muudatus jõudis esimesse; sama ketta-konflikt jõudis mõlemasse; Keep my version salvestas kohaliku teksti ja muutis mõlemad sakid puhtaks | Ühe hosti mitme vaate tõend. Peer-edit vaatlus 111 ms. See ei ole kahe akna või kahe hosti garantii |
| Markdown: ühe split-vaate sulgemine | Teine sakk ja dokumendimudel säilisid õige sisuga | Ühe vaate elutsükli funktsionaalne kontroll, mitte korduvate sulgemiste mälulekke mõõtmine |
| XLSX: kohaliku muudatuse järel väline asendus ja Save | Mõlemal katsel asendus kettal oleva teise tegija väärtus kohaliku väärtusega; Save tagastas edu ja sakk jäi puhtaks | A01 on rakenduses kinnitatud. Korduskatses ei tehtud Save ja selle tulemuse vahel ühtegi kinnitavat UI tegevust |
| CSV: 10 005 rida, ühe lahtri muutmine ja Save | Kettale jäi 10 000 rida; viimased viis rida kadusid | A14: kuva piirang muutub kirjutatava dokumendi piiranguks. Fail oli ainult 219 026 baiti; agenti ega teist kirjutajat polnud |
| Tegelikud webview ressursid | AI, Markdowni ja XLSX kontekstid laadisid sama 8 844 955 baidise webview.js; uuritud kontekstides PDF workeri päringut polnud | A03 tarnepiir on rakenduses vaadeldud. Ressursi kestus ei ole JS CPU aeg; vahemälu ja jagatud mälu mõju ei saa failisuurusest tuletada |
| Bundled native komponendid | Codex app-server 0.153.0, Claude 2.1.239 ja OpenCode 1.18.21 versioonipäring õnnestus; code-mode-host help õnnestus. Kõigi nelja codesign verify strict exit 0 | Käivitatavuse ja allkirja tervikluse kontroll darwin-arm64-l. Ei kata autentimist, tööriistu, katkestamist, notariseerimist ega Windowsi komponente |
| Sama profiili taaskäivitus | Varasemad sakid taastusid; terminal fookuses 4,155 s ja AI paan 5,512 s. Salvestamata katsemarker ei taastunud | Paanihüpe kordus. See hot-exit proov ei ole tavapärase installi tõend: development mode ei loo püsivat backupPath'i |

Rakenduse terminalist AI-sse hüpe kinnitab lähtekoodi põhjal kirjeldatud
vastutuste kattumist. XLSX-i ja CSV juhtumid näitavad kahte erinevat tervikluse
viga: kirjutuse versioonikontroll ja täieliku andmemudeli säilitamine.
Markdowni positiivsed katsed annavad samal ajal konkreetse kaitse, mida
arhitektuuri ühtlustamisel säilitada.

## Protsessid ja ressursside tõend

Esimeses, umbes 25 sekundi järel tehtud snapshot'is oli 12 rakenduse protsessi
või järeltulijat: Electron main/GPU/renderer/utility, extension host, terminali
pty/Bash ning Codex app-server. Hilisemas dokumendikatsete snapshot'is oli 15,
lisaks vaadete ja keeleserveri protsessid. Iga PID, vanem ja RSS on salvestatud.
Need pole samade tingimustega võrdluskatsed; nende vahest ei järeldu mäluleke.
RSS-e ei liideta unikaalseks füüsiliseks mälukuluks.

[Käivituse vaatlus](evidence/live-startup.json) ja
[ressursi-/native-inventuur](evidence/live-runtime-inventory-probe.json) annavad
süsteemikaardile tegeliku protsessitõendi. Neljas uuritud webview kontekstis
oli bundle'i decodedBodySize 8 844 955; transferSize oli 0. Viimane ei tõesta
koodi puudumist ega nullkulu. Kontseptuaalne moodulipiir ja tarnitava skripti
piir on jätkuvalt erinevad.

## Testirakise täpsustused ja vastutõend

Esimene Markdowni katse ootas literaali `HUMAN_UNSAVED`, kuid Markdowni
serialiseerimine escapeb alakriipsud. See oli testi eeldusviga, mitte kadunud
sisestus. Teine katse kasutas juba vaates leiduvat markerit ja jõudis
konfliktivalikuni enne uue kettaversiooni tõendamist. Lõplik katse ootas täpset
TextDocument'i teksti ja uue välise sisu SHA-ga `document:conflict` teadet.
Varasemad katsed on säilitatud, neid ei loeta läbitud tooteproovideks.

Markdowni põhiproov peatus undo eeldusel ja selle JSON ei väida täielikku läbimist.
Järelkatsed kontrollisid eraldi tavalist editori undo't ning käsupaleti hosti
Undo't. Viimane taastas täpselt konfliktieelse inimteksti SHA
`07ff582c22313e26571ab55f4762834c974e5b8e3c9c91ce99bc64db235de359`.
Nii on esialgne ebaõnnestumine lahendatud kitsama ja tõendatud järeldusena,
mitte muudetud tagantjärele roheliseks testiks.

Esimese XLSX-rakise `confirmationDialogObserved` nimi oli eksitav:
`[role=dialog]` leidis Exceli piirangute ja analytics'i mittemodaalsed teated.
Algne JSON on säilitatud; väljanimi parandati `anyDialogRoleObserved` kujule
koos selgitusega. Kordusproov eristas `.monaco-dialog-box` ja `aria-modal=true`
teavitustest. Ülekirjutamine kordus, modal-elemente polnud ning Save lõpetas
ilma ühegi vahepealse nõusolekutegevuseta.

## Tõendifailid ja kordamise ulatus

- [Markdowni põhijada](evidence/live-markdown-probe.json),
  [editori undo kontroll](evidence/live-markdown-history-probe.json),
  [hosti taastamine](evidence/live-host-history-probe.json).
- [Split-vaated ja Keep my version](evidence/live-markdown-split-probe.json),
  [konfliktivaliku pilt](evidence/live-markdown-conflict.png),
  [kahe vaate pilt](evidence/live-markdown-split.png).
- [XLSX esimene proov](evidence/live-excel-probe.json),
  [parandatud mõõdikuga kordus](evidence/live-excel-repeat-probe.json),
  [salvestamise järel](evidence/live-excel-repeat.png).
- [CSV ridade kadu](evidence/live-csv-row-limit-probe.json) ja
  [tegelik vaade](evidence/live-csv-row-limit.png).

Samanimelised `.mjs` failid kirjeldavad täpseid katsetoiminguid. Osa järelproove
jätkab eelneva proovi kindlat dokumenti/markerit; need on salvestatud uurimisjada,
mitte suvalises järjekorras käivitatav regressioonikomplekt. Uues jooksus tuleb
kasutada värsket sünteetilist profiili ja selle jada tegelikke markereid.
Native inventuur tugineb manifesti `validationArgs` väärtustele, mitte
oletatud CLI parameetritele.

## Taaskäivituse katse ja development mode'i piir

[Taaskäivituse proov](evidence/live-restart-probe.json) kinnitas enne sulgemist
salvestamata markeri TextDocument'is ja selle puudumise kettal. CDP Browser.close
vastus aegus, kuid PID-i kontroll kinnitas vana rakenduse lõppemist. Alles
pärast seda käivitati sama profiil uuesti. Sakid taastusid, kuid marker puudus.
Seda negatiivset tulemust ei tõlgendata tavapärase Ritemarki andmekao tõendina.

[Alusversiooni VS Code lähtekood](evidence/live-restart-mode-analysis.json)
selgitab olulise erinevuse: `windowsMainService` ei registreeri
`extensionDevelopmentPath` aknale backupPath'i; ilma selleta kasutatakse
`InMemoryWorkingCopyBackupService`-it. Järgnenud
[tavarežiimi katses](normal-mode-observations.md) laaditi samad kontrollitud
laienduse baidid isoleeritud `--extensions-dir` kaudu, kinnitati laadimistee
ja püsivad varukoopiad ning taastati Markdowni/XLSX-i salvestamata töö.
OS-crash, tavaline Quit ja katkestatud salvestus jäävad eraldi juhtumiteks.

## Lahtine tõendus

Kahe eraldi akna/hosti dokumendikaitse ja Flow topeltkäivitus on nüüd eraldi
tavarežiimi katses kontrollitud. [Vestluse salvestuskatse](shared-store-observations.md)
lisas sama skoobi kahe tegeliku hosti juhitud põimumise, UI readback'i ja
restarti tõendi. Transkripti app-rassid, native agentide kirjutamine ja katkestus,
brauseri sihi jagamine, PDF/DOCX/draw.io fidelity ja suured failid, audio
backpressure ning sihtplatvormi paigaldus jäävad eraldi kontrollideks.
Nõrga Windowsi mõõtmisi ei asenda ükski selle dokumendi macOS-i aeg.

## Katse lõpetamine

[Puhastuse tõend](evidence/live-cleanup-probe.json) kinnitab teise käivituse
rakenduse ja selle 13 järeltulija lõppemist ning CDP pordi sulgumist.
Esimese käivituse PID-i lõppemine kontrolliti enne taaskäivitust. Kohalik
juhtklient lõpetati. Sünteetilised failid, draiveri sündmused ja audititõendid
säilitati; kasutaja muud Ritemarki protsessid polnud puhastuse sihiks.
