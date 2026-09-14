# Ritemarki arhitektuuriaudit

2026-09-13 · aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`

**Alusta [sihtarhitektuurist ja üleminekustrateegiast](conclusions.md).** See on
auditi strateegiline tulemus: põhimõtted, põhimudel, vastutuspiirid, valikud ja
üleminek. Allpool säilib selle aluseks olev tehniline hinnang koos tõenduse
piiridega. Üksikvigade diagnoosimine ja parandamine ei ole edasise töö ülesanne.

**Seis: kogu süsteemi lähtekoodi-, komponendi- ja macOS-i rakenduskatsete vahehinnang.**
Dokumendi taastamine ja kahe akna kaitse on kontrollitud; sama Flow topeltkäivitus on
rakenduses kinnitatud. Codexi/ACP ühenduse algatuse, katkestuse ja taaskäivituse
katsed on lisandunud; ACP algatuse võidujooks on A15. Vormingukatsed kinnitasid
draw.io autosave'i andmekao (A16) ning PDF/DOCX vananenud nähtava sisu (A17).
Brauseri tegelik tööriistatee kinnitas sihi eeltingimuse puudumise (A18) ja
read-share'ita veavastuse metainfo (A19); tegevuse keeld, queue ja ootel
locatori katkestamine töötasid. Transkriptsiooni tegelikud hostid kinnitasid
kaotatud kõnelejanime muudatuse (A06) ning elusa naaberhosti töö eksliku
katkenuks märkimise (A20); mootori vastus oli sünteetiline. Väikese Markdowni
avamise kuus mõõtmist värskes macOS-i protsessis kinnitasid JavaScripti
käivitustöö CPU-tundlikkuse (A03); profiil koguti eraldi protsessis.
Mudeli/failitööriistade
lifecycle'i ja nõrga Windowsi tõend on pooleli. See dokument ei
nimeta auditit lõpetatuks. Katvus ja lahtine tõendus on [katvustabelis](coverage.md).

## Tervikhinnang

**Ritemarki ülesehitus toetab kohalikku, dokumendi ümber toimuvat agentset
teadmustööd. Kasutaja kirjeldatud toote täieliku ulatuse jaoks on vaja tugevdada
ühiseid teadmusruumi, dokumendimuudatuse ja töö elutsükli lepinguid.**

Dokument ja failipuu on nähtava kogemuse keskmes. Kolm agendiruntime'i jagavad
sessiooniliidest; vestluse ajalugu on eraldatud runtime'i enda kontekstist;
Markdowni/CSV vaatel on läbimõeldud sünkroniseerimise ja konflikti protokoll.
Need annavad edasiarendamiseks sisulise aluse. Auditi enda rakenduskatsed
kinnitasid Markdowni konflikti-, split-vaate ja kahe hosti kaitseid ning
Markdowni/XLSX-i püsivat taastamist tavarežiimis. Samas kaotas CSV ühe
lahtri salvestamisel üle 10 000 jäävad read ning XLSX kirjutas välise muudatuse
tavalise Save käsuga üle. Draw.io automaatsalvestus eemaldas välise tegija
lisatud kujundi, sest lõuend ei järginud hosti uut dokumendiversiooni.
Need on eri põhjusega andmekao vead, mitte üldine
hinnang, et kõikide formaatide sünkroniseerimine puudub.

Probleem tekib seal, kus üks kasutaja tegevus läbib mitu sellist ala. Vestluse
scope tunneb mitut juurt ja URI-d, agent saab ühe kohaliku kataloogi. Editor
kaitseb oma mudelit, agendi kirjutus ei kanna sama dokumendi versiooni
eeltingimust. Vestluse ja transkripti salvestus ning ajastuse tähised on püsivad,
kuid nende muutmise järjekord on sageli ühe objekti piires. Flow käivitamise
reeglid sõltuvad sisenemiskohast. CSV kuvamiseks piiratud mudel muutub kogu faili uueks sisuks. Need on toote
kasvamist piiravad lepingulised lüngad; sõltuvuste või faili suuruse vähendamine üksinda neid ei lahenda.

**Praegune tõendus ei anna alust Electroni/VS Code'i asendamiseks.** Platvorm
pakub juba vajalikku dokumentide, failiteenuse, custom editorite, protsesside ja
akende alust. Uuritud vead paiknevad valdavalt Ritemarki vastutusjaotuses ja
integratsioonides. Platvormi enda osakaalu nõrga Windowsi jõudluses tuleb mõõta.

## Vastavus tootevisioonile

| Toote omadus | Praegune hinnang | Mida on vaja juurde |
| --- | --- | --- |
| Koostöö nähtava dokumendi ja failipuu ümber | Olemas ja arhitektuuriliselt toetatud | Agendi kontekst ja muudatus seostada täpse dokumendiversiooniga; tagada nähtavuse ja katkestamise järjekindlus |
| Runtime'ist sõltumatus | Osaliselt hästi teostatud: registry, factory, sessioonid ja võimekused | Ühine tulemi/kooskõlastuse/katkestuse leping ka Flow ja taustatöö jaoks; vähendada vendor-loogikat provider/UI tasandil |
| Vormingutest sõltumatu teadmustöö | Mitme vormingu toetus olemas, erineva sügavusega | Selge read/edit/export/round-trip/conflict capability contract; eraldi tarnepiir rendereritele |
| Eri skoobiga lokaalsed ja pilveruumid | URI/multi-root identiteet vestlustes; teostus valdavalt kohalik ja esimese juure põhine | Space identity, resource URI, valitud scope, versioned writes, materialiseerimine ja reconnect |
| Inimese ja mitme agendi samaaegne töö | Markdown/CSV konflikti avastamine ja taastamine olemas | Ühine muutuste omand ja commit-reeglid; eraldi semantilised strateegiad tekstile ja binaarfailile; multi-window garantii |
| Nõrga masina kiire ja stabiilne UX | Ühise bundle'i ja startup focus'i mehhanism kontrollitud; väike Markdown teeb mõõdetavat CPU-tundlikku käivitustööd | Külm launch/input ning CPU/RAM mõõtmine Windowsi sihtriistvaral, seejärel eelarved ja optimeerimise valik |

## Mida tasub säilitada

1. **Dokumendi ja vaate eristamine.** Markdown/CSV koordinaator kasutab baasi,
   mudeli ja ketta võrdlust, eraldi view epoch'e, payload'i ACK-e ja eksplitsiitset
   konfliktivalikut. Olemasolevad testid läbisid jooksu ning Sprint 115 säilitab
   reaalse rakenduse varasema live-tõendi. Selle auditi app-katsed kinnitasid
   split-vaate, konflikti ja Keep my version käiku. See on ühise lifecycle'i
   lähtekoht; CSV payload'i täielikkuse viga jääb sellest eraldi.
2. **RuntimeSession ja kanooniline vestlus.** Sessioon kuulub vestlusele,
   factory/capability metadata on koondatud, continuation'i saab esitada ausalt
   native jätkamise või kontrollitud fallback'ina. Store'il on revisjonid,
   tombstone'id, schema kontroll ja karantiin.
   Päris Codexi binaariga jagasid kolm algatust üht ühendust ning
   timeout/crash/restart toimisid; ACP soe multi-session ja crash/restart
   läbisid samuti. ACP külma algatuse kaitse vajab eraldi parandust (A15).
3. **Arusaadavad testitavad osad.** Reducerid, protokollid, scope resolver,
   DAG executor, failitee kontrollid ja lifecycle-testid võimaldavad kontrollida
   reegleid ilma mudelipäringuta. Audit leidis ka teste, mida standardkäsk ei käivita;
   testifailide arv ei ole katvusprotsent.
4. **Tarneahela taastatavus.** Lockfile'id, binaaride manifest, target staging,
   puhta release-worktree nõue, provenance ja rollback kaitsevad varem esinenud
   build/update vigade vastu. Selle auditi tootmis-webview build oli
   baiditäpselt taastatav. Uuendaja leitud path-viga tuleb parandada seda süsteemi
   säilitades.
5. **Osaliselt juba eraldatud rasked ressursid.** Native agent ja meediatöö
   käivad alamprotsessides; draw.io on eraldi renderer; transkriptsioonitöö eluiga
   ei sõltu täielikult webviewst. Päris speech-pipeline läbis sünteetilise
   mootorivastusega ettevalmistuse, salvestuse ja vaate tee ning eemaldas
   ajutised peak-WAV failid. Neid mustreid saab kasutada teiste piiride juures;
   töö omaniku taastamine mitmes hostis vajab eraldi parandust (A20).

## Süsteemsed probleemid

**1. Ressursi omanik ja tema kaitse ulatus ei ole alati samad.**
Dokument, vestlus, transkriptsioon ja ajastatud töö võivad olla mitme akna või
tegija jagatud ressursid. Nende mutex/queue/running-set on sageli objekti sees.
Komponentkatsed näitasid kinnitatud vestlussündmuse kadumist, transkripti
tempfaili kokkupõrget ja sama ajastusslot'i kahekordset käivitamist. Päris kahe
akna katse kinnitas viimast: sama Flow tee sai eri workspaceState'ides eraldi
edutähise. Lisaks kinnitas kahe sama skoobi päris vestlusekontrolleri juhitud
salvestuskatse, et eelistusemuudatus sai kustutada juba kinnitatud vastuse;
see puudus ka pärast taaskäivitust. Ühe hosti samaaegsed vestlusemuudatused säilisid. Transkripti kaks päris
provider'it kaotasid ühe kinnitatud kõnelejanime ka siis, kui originaalsed
salvestused vabastati järjestikku; ainult tempfailinime parandamisest ei piisa.
Lisaks nimetas uus host teises hostis jätkuva transkriptsiooni katkenuks,
sest taastamine ei kontrolli töö omaniku elusolekut (A20).
Ressursi identiteet ja lukustuse asukoht peavad seega kokku langema. A06 kirjeldab
täpset tõenduse ulatust. See vajab iga ressursi kohta omanikku või atomaarset
muutmise lepingut; ühte hiiglaslikku globaalset teenust sellest ei järeldu.
Brauseris ilmnes sama vastutuspiir teisel kujul: A vaadeldud lehe järel
navigeeris B sama saki uuele lehele ja A järgmine kirjutus muutis uut lehte.
Üksikute käskude queue töötas, kuid mitmesammulise töö sihi püsimise leping
puudus (A18). Load, ressursi identiteet ja vaatluse värskus vajavad eri kontrolle.

**2. Koostöö on failimuudatuse vaatlemine, ühine muudatuse leping on puudu.**
Agent muudab ketast, editor reageerib. See töötab paljudes olukordades, kuid
kooskõlastus ei kinnita, et agent luges viimast inimversiooni. Vormingutel on
erinev salvestus- ja konfliktikäitumine. Ühisredigeerimise CRDT/OT valik on sellest
hilisem otsus: kõigepealt tuleb määrata, millised muudatused peavad säilima,
kuidas kinnitatakse versiooni ja millal on vaja inimese otsust. Binaarne XLSX
ja plain-text Markdown ei nõua identset merge-algoritmi. A01, A04, A05, A06, A16.
Ka readonly vaade vajab versiooni tähendust: PDF/DOCX said hosti muutus- ja
kustutusteated, kuid näitasid vana sisu ilma vastava märgita (A17).
Lisaks peab vaate piirang jääma vaate piiranguks: A14 CSV näitab, et täieliku
andmemudeli asendamine kärbitud projektsiooniga kaotab tööd ka ilma konfliktita.

**3. Rakenduse teenused on mitmes kohas seotud UI ja konkreetse runtime'iga.**
Provider/store koondab auth'i, vestluse, konteksti ja agendi lifecycle'i;
Flow editor sisaldab teist käivitusmootorit; Flow node'id saavad runtime'i otse
kutsuda. See tõstab uue runtime'i või taustakäivituse lisamisel muudatuse ulatust.
AST-graaf, koodi vastutused ja muutmisajalugu toetavad sama tähelepanekut.
Lahutada tuleb ärireegleid, mitte faile mehaaniliselt tükkideks. A07, A11.

**4. Võimekuste ja usalduse kirjeldused on toote arengust maha jäänud.**
Manifesti virtual/untrusted-workspace väited, Markdowni-keskne agent guidance,
headless Flow autonoomia ja kohaliku path'i eeldused ei moodusta veel ühtset
tootelepingut. Raw Markdown→HTML piir näitab teistsugust usalduslünka:
assistendi sisu CSS muutis päris AI webview kinnitamisnuppe ja sisestusvälja.
Skriptikeeld töötas, kuid see ei isoleeri sisu stiile. Need piirid vajavad
eksplitsiitset valideerimist ja UI-ga kooskõlas olevaid võimekusi. A08, A10.
Brauseri snapshot peitis read-share puudumisel URL-i/pealkirja, kuid keelatud
fill-kutse veavastus sisaldas neid (A19). Lugemisõiguse kontroll peab kehtima ka
veavastustele. Katses töötanud tegevuse keeldu ja ootel locatori katkestamist
tuleb säilitada; peidetud upstream jagamisnupp vajab Ritemarki nähtavat vastet.

**5. Jõudluse piir ei lange funktsioonide piiriga kokku.**
Ühine IIFE annab kõigile peamistele webviewdele sama 8 844 955 baidise koodi.
Suurimad module contribution'id pärinevad diagrammide ja eri vormingute
teekidest. Allika lazy() ei loo selles buildis eraldi chunk'i. Käivituse layout'i
määravad shell ja ajastatud käsud. Need on kontrollitud mehhanismid; Windowsi
aegluse põhjuste proportsioonid ning sobivad ressursieelarved on veel mõõtmata.
A02, A03.

[Väikese Markdowni avamise mõõtmine](performance-observations.md) lisas
põhjusliku kontrolli: sama 79-baidise faili avamise mediaan oli tavakiirusel
469 ms ja 4× CPU-aeglustusega 1523 ms. Skripti täitmise mediaan kasvas
301 ms-lt 1346 ms-ni, kohaliku ressursi laadimine jäi umbes 90 ms juurde.
Lõppvalimis oli kuus uut vaadet, soe vahemälu ning profilerita värske protsess.
Eraldi profiil näitas ka ELK-i laaduri ja parseri initsialiseerimist ilma
diagrammita avamisel. Tarnepiir peab seega piirama ka käivitamisel tehtavat
tööd; üksnes edastusmahu vähendamisest ei saa selles katses peamise kulu
lahendust järeldada. Windowsi tulemust või võimalikku optimeerimisprotsenti
neist Maci arvudest ei tuletata.

PDF-i 20-leheküljeline katse eristas koodilaadimist renderduse elutsüklist:
läbitud lehtede canvas'ed jäid alles. Samas ei tõendanud RSS/JS-heap vaatlus
arvutatava pikslipinnaga võrdelist mälukasvu. Seda ei nimetata mälulekkeks;
tarne suurusele lisaks tuleb mõõta lehekülgede cache'i ja browser/GPU arvestust.

## Lokaalsed vead ja vahetud riskid

- **CSV nähtamatute ridade kadumine (A14).** 10 005 reaga, umbes 219 kB failis
  piisas ühe lahtri muutmisest: Save jättis alles 10 000 rida. Säilitada täielik
  andmemudel; kuni parandamiseni ei saa kärbitud eelvaate muutmist ohutuks pidada.
- **Draw.io vana lõuendi automaatsalvestus (A16).** Hosti puhas tekstimudel oli
  juba välise kujundiga uuendatud; lõuendi kohaliku teksti muutmine asendas faili
  vana graafi ekspordiga. Vaja on lõuendi baasi ja dokumendiversiooni kooskõla.
- **Uuendaja sihtkataloog väljub lubatud juurest (A09).** Sünteetiline actual-source
  test kustutas kõrvalkataloogi sentinel'i ja tagastas edu. Vajab kitsast
  containment-parandust enne seda rada puudutavat järgmist väljalaset.
- **Transkripti ühine tempfail (A06).** Eraldi tempnimed ja sama session'i
  serialiseerimine on kiire riskivähendus; stale täissnapshot vajab eraldi kaitset.
- **Vestluse kinnitatud vastuse kadumine (A06).** Kahe sama skoobi hosti
  kirjutuste juhitud põimumisel asendas hilisem eelistusemuudatus salvestatud
  vastuse vana ajalooga. Vaja on kogu jagatud kirje muutmise garantiid;
  praegused per-host järjekorrad ja stale-revision retry sellest ei piisa.
- **XLSX kirjutuse eeltingimus ja watcher suppression (A01).** Provideri tase
  ei kontrolli välise versiooni muutumist enne täisbuffri salvestust. Kaks
  rakenduskatset kinnitasid välise väärtuse ülekirjutamise ilma konfliktivalikuta.
- **HTML allowlist puudub (A08).** Päris webview katse kinnitas sõnumi CSS-i mõju
  Approve/Reject nuppudele ja sisestusväljale. HTTPS-pildi päring lubati ning
  vastati kohalikult. CSP blokeeris inline-käsitlejad; kooskõlastusest möödumist
  ega OS-koodi käivitamist ei ole tõestatud.
- **Dikteerimise chunk'i vahelejätmine (A12).** Hõivatud controller tagastab uue
  chunk'i töötlemata. Kasutajamõju mõõtmiseks on vaja aeglase CPU audio-katset.
- **ACP külma algatuse võidujooks (A15).** Päris binaariga sai kahe samaaegse
  sessioonipäringu teine kutsuja not-initialized vea; hilisem kutse õnnestus.
  Jagada tuleb ühenduse algatuse promise'i ja määrata selle katkestamise tähendus.
- **PDF/DOCX nähtava versiooni seis (A17).** Muutus- ja kustutussündmused
  saabusid, kuid vaade ei näidanud seda. DOCX Refresh ja PDF taasavamine töötasid;
  olemasolevad watcher'id vajavad toimivat tarbijat ja selget kasutajaolekut.

## Tõendi tugevus ja piirid

Selles worktree's on läbitud standardne `SKIP_API_TESTS=true npm test`, laienduse
TypeScript/esbuild compile ja repo `validate-qa.sh`. Vite tootmisbuild taastas
repo artefakti SHA-256. Lisaks on käivitatud päris source-klassidega
konkurentsi- ja usalduspiiri katsed. Need leiavad olukordi, mida roheline
standardtestide komplekt ei kata.

[Rakenduskatsed](live-observations.md) kinnitasid auditi worktree laienduse
laadimistee. Installitud macOS 1.10.1 shelli provenance on
`23493cef1f4d38cd997be5509e057cb75560fb5c`; shelli gitlink, patchid ja branding
on aluscommit'iga samad. See on ühildava shelli kontrollitud arenduskäivitus,
mitte uus release-build. Seejärel laaditi baiditäpselt sama laiendus tavarežiimis
isoleeritud extensions-dir kaudu. [Need katsed](normal-mode-observations.md)
kinnitasid püsivat Markdown/XLSX taastamist, kahe hosti dokumendikonflikti kaitset
ja sama Flow topeltkäivitust. Development mode'i varukoopiate piirang on seega
kõrvaldatud eraldi katses. [Native-komponendikatsed](native-runtime-observations.md)
kontrollisid Codexi/ACP ühenduse algatust, hangumist või krahhi ning restarti
ilma mudelivooruta. [Vormingukatsed](format-observations.md) lisasid draw.io,
PDF/DOCX ja lehekülgede renderduse elutsükli tõendi.
[Sisu turvapiiri katse](security-observations.md) kasutas päris AI webview'd
sünteetiliste projektsioonisõnumitega ning eristas CSS-i mõju, pildipoliitikat
ja toimivat skriptikeeldu. [Jagatud vestlussalvestuse katse](shared-store-observations.md)
lisas tegelikud kaks kontrolleriprotsessi, juhitud IO-ajastuse, UI readback'i
ja uue protsessiga kontrolli. See ei mõõda loomulikku võidujooksu sagedust ega
asenda native mudelivooru katset. Puudu on native-agentide mudeli/failitööriista
lifecycle'i ja nõrga Windowsi vajalik tõend; iga recovery/crash varianti ei ole
läbitud. Ühe source-map'iga buildi 4 GiB heap OOM on
build-hoolduse tähelepanek, mitte tõend lõppkasutaja käivituse mälukulust.

Paranduste sõltuvused, alternatiivid ja vastuvõtukriteeriumid on
[tegevusjärjekorras](recommendations.md). Auditi edasine töö lähtub
[lõpetamise kontrollist](coverage.md), mitte üksikute edukate testide arvust.
