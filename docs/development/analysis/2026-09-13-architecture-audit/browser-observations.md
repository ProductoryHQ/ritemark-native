# Brauseri siht, järjekord ja nõusolek

Aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`; macOS arm64;
sama kontrollitud tavarežiimi laiendus ja ühilduv installitud shell, mida
kirjeldab [tavarežiimi metoodika](normal-mode-observations.md).

**Tulemus:** üksikute käskude järjekord ja tegevuse keelamine töötasid.
Mitmest sammust koosnev töö ei säilitanud sihi eeldust: A vaadeldud lehe asemel
muudeti pärast B navigeerimist lehte B. Lugemisõiguseta snapshot ei avaldanud
lehe identiteeti; keelatud kirjutamiskäsu veavastus avaldas URL-i ja pealkirja.
Nõusoleku tühistamine katkestas katses ootel Playwrighti tegevuse.

## Katse piir ja sisenemiskoht

- Profiil: `/private/tmp/ritemark-audit-normal-bg5jgmun/browser-profile`.
  Põhiprotsess 37499, laiendushost 37926, CDP port 9241.
- Kaks ainult kohalikku HTML-faili, eri pealkirja/värvi/algväärtusega. Mõlemal
  on `#entry` väli ning ainult lehesisese loenduri muutmise nupp. Ei olnud
  välist veebisaiti, vormi saatmist ega failikirjutust brauserist.
- Audit-only observer leidis päriselt aktiveeritud mooduli cache'ist
  `unifiedViewProvider._runtimeRegistry.get('opencode')` ja kutsus selle
  `_handleBrowserIpcRequest` meetodit. Edasi töötasid muutmata
  BrowserActionTools, shelli käsud, consent ja Playwright.
- A ja B on **sünteetiliste kutsujate sildid** vaatluslogis. Neid ei lisatud
  toote tööriistaprotokolli. Kaks native agendisessiooni ei käivitunud;
  runtimeSessionCount jäi 0 ja ACP manager puudus. Katse tõendab ühise
  tööriistatee käitumist, mitte mudeli loomulikku tööriistavalikut või vea sagedust.
- Profiilis muudeti ainult dialoogi esitust (`window.dialogStyle: custom`),
  et päris nõusoleku küsimust saaks jälgida. DialogService'i ei asendatud.
  Aktsepteeriti ainult kahe kohaliku katselehe nõusolekut.
- Jagamise nupp oli olemas, kuid selle konteineril oli `display: none`.
  Tühistamiseks kutsuti selle olemasolevat DOM click-handler'it. See on
  instrumenteeritud tühistamine, **mitte tavakasutajale kättesaadava UI tõend**.
  Olemasolev shelli handler kutsub `setSharedWithAgent(false)`, mis lõpetab
  Playwrighti lehe jälgimise ning puhastab juhtimisõiguse.

[Sisenemiskoha lähtekood](evidence/browser-audit-api.cjs),
[ettevalmistus](evidence/prepare-browser-probe.py),
[katse skript](evidence/normal-browser-ownership-finish-probe.mjs) ja
[toorvaatlused](evidence/normal-browser-ownership-finish-probe.json).

## Kontrollitud tulemused

| Katse | Vaatlus | Järeldus |
| --- | --- | --- |
| Lugemisõigus tühistatud → snapshot | Ainult veateade, ei URL-i ega pealkirja | Snapshot'i read guard töötas |
| Juhtimiskutse → tegelikus dialoogis Deny | Väli jäi samaks; veavastus | Tegevuse keeld töötas |
| Juhtimiskutse → Allow Control ja eraldi Share/Allow | Väli sai väärtuse `AUDIT CONTROL ALLOWED` | Tegelik control/read grant ning täitmistee töötasid |
| A snapshot lehel A → B navigate lehele B → A fill | Sama pageId; B URL, B DOM ja B ARIA; B väli sai `AUDIT A INTENDED FOR A` | Käsul puudub eeldatava sihi/vaadeldud versiooni eeltingimus (A18) |
| A click ootab 2,5 s pärast loodavat nuppu; B navigate samal ajal | Mõlemad kutsevastused olid ootel; A loendur sai 1 ja A tulemus valmis enne B navigeerimise tulemust | Per-host queue serialiseeris terviklikud tegevused |
| A click ootel, nuppu veel pole → jagamine tühistatud | Kutse lõppes `Page ... not found`; hiljem ilmunud nupu loendur jäi 0 | Katkestamine töötas selles ootel locatori katses |
| Pärast tühistamist uus snapshot ja fill/Deny | Snapshot ei andnud identiteeti; fill ei muutnud välja, kuid veavastus sisaldas URL-i ja pealkirja | Ühtne lugemispiir ei kata veavastuse metainfot (A19) |

Järjekorra kontrollis algas A kutse 1789308496167 ms ja B kutse kaks
millisekundit hiljem. A tulemus valmis 1789308499026 ning B oma
1789308499045. Tühistamiskatses algas ootel kutse 1789308499199; enne tühistamist
oli 255 ms hiljem endiselt `running` ja nupp puudus. Metadata muutus
`sharedWithAgent: false` ning kutse lõppes 1789308499464. Hilisem DOM näitas
nuppu ja nulli klõpsu. Need on selle jooksu ajatemplid, mitte jõudlusbenchmark.

## Lähtekood ja arhitektuuriline tähendus

[BrowserActionTools](../../../../extensions/ritemark/src/browser/BrowserActionTools.ts)
read 33–62 ei võta vastu pageId-d, expectedURL-i ega navigeerimisversiooni.
Read 69–96 serialiseerivad käskusid ja nimetavad ise vestlusepõhise omandi
teadlikult lahendamata piiranguks. Read 146–164 vormindavad URL-i/pealkirja,
kuid jätavad tulemuses oleva pageId välja. [ACP dispatcher](../../../../extensions/ritemark/src/acp/AcpRuntime.ts)
read 524–545 suunab kutsed samale teele.

[Shelli patch 010](../../../../patches/vscode/010-ritemark-browser-action-bridge.patch)
read 429–447 valivad aktiivse mudeli, küsivad juhtimisõigust ja käivitavad
tegevuse selle mudeliga. Keeldumise haru real 437 lisab `modelMeta` ka siis,
kui read-share puudub. Snapshot'i read 676–678 tagastavad samas olukorras
ainult vea. [BrowserContextStore](../../../../extensions/ritemark/src/browser/BrowserContextStore.ts)
read 168–172 sõnastavad kaitstava lepinguna ka URL-i/pealkirja.

Jagamise UI tuleb alusgitlingi `10c8e557...` failist
`src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts`:
read 162–166 seovad nähtavuse upstream ChatContextKeys/AgentEnabled/browser-tools
võtmetega, read 218–225 peidavad konteineri, read 254–259 tühistavad jagamise.
Ritemarki [composer'i rist](../../../../extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx)
read 1106–1109 muudab ainult `hideBrowserContext` olekut; see peidab konteksti
ühest voorust, ei ole shelli õiguse tühistamise nupp. Kõiki võimalikke menüü- või
sakkide sulgemise teid selle katsena ei sertifitseerita.

See eristab kolme lepingut: **kellel on luba**, **millist ressurssi muudetakse**
ja **kas varasem vaatlus kehtib endiselt**. Nõusolek ja queue on vajalikud,
aga sihile viitav eeltingimus peab olema eraldi. Üksnes pageId ei lahenda
A18 juhtumit, sest sama sakk navigeeriti teisele lehele; vaja on ka asjakohast
navigeerimis-/vaatlusversiooni või muud samaväärset kontrolli.

## Tõendi piirangud ja puhastus

Esialgsete kutsete 1 ja 3 nõusoleku andmise hetke ei tabatud. Need lõpetasid
edukalt; payload'i sõna `DENIED` ei tähenda, et UI-s oleks vajutatud Deny.
[Esimene probe](evidence/normal-browser-ownership-probe.json) peatus, sest
varem nähtud dialoog oli enne probe'i algust kadunud. Sama kutse seis loeti
uuesti; toimingut ei kuulutatud vaatlusaja lõppemise põhjal nurjunuks.
Järgnev probe tühistas loa uuesti ja jälgis uusi dialooge algusest lõpuni.
Automaatset nõusolekut ega kinnituse vältimist nende esialgsete katsete põhjal
**ei väideta**.

Deny- ja Share-dialoogide pildid vaadati üle. Fail
`normal-browser-wrong-target.png` näitas küll B aadressi, kuid BrowserView
pind jäi varasemale A kujutisele; seda pilti **ei kasutata B nähtava sisu
tõendina**. A18 tõend on tegeliku browser-page target'i URL/DOM ja toote
Playwrighti ARIA vastus. Selle screenshot'i värskusprobleemi põhjust ei isoleeritud.

[Puhastus](evidence/normal-browser-cleanup-probe.json) kinnitas kõigi 13 enne
sulgemist tuvastatud oma protsessi lõppemist ja pordi 9241 sulgumist.
Juhtklient lõppes exit 0. Algne audit-observer taastati ja brauseri abimoodul
eemaldati staged laiendusest; toote neli kontrollitud artefakti jäid sama
SHA-256-ga. [Korrelatsioon](evidence/browser-analysis.json) kontrollib
kutsed, algsed ebaõnnestunud vaatlused, edukad kontrollid, hostilogid, lähtekoodi
ning abiskriptide süntaksi. See ei asenda puuduvaid Windowsi ega native mudelivooru katseid.
