# Varasem tehniliste järeltegevuste loend

**See dokument säilib varasema analüüsi lisana.** Kasutaja täpsustas, et auditi
tulemus peab olema strateegiline arhitektuurilahendus, mitte vigade paranduste
järjekord. Kehtiv soovitus ja üleminekutee on
[sihtarhitektuuri dokumendis](conclusions.md). Allolev loend ei ole heaks kiidetud
tööplaan ega korraldus diagnoosimist või parandamist jätkata.

Seis: kogu süsteemi source/component ja macOS-i rakenduskatsete põhjal koostatud järjestus; Windowsi jõudlusmõõtmine võib muuta jõudlustööde omavahelist prioriteeti. Need on eraldi planeeritavate tööde piirid, mitte heaks kiidetud implementatsioonisprint või väljalaskeplaan.

Põhimõte: kõigepealt kasutaja töö säilimine ja kontrollitavad usalduspiirid, siis ühtsed lepingud ja mõõdetud jõudlus. Säilitada praegused toimivad sünkroniseerimise, runtime'i ja tarneahela kaitsed.

## 1. Parandada konkreetsed tervikluse ja usalduse vead

**A14: CSV terviklik andmemudel.** Vältida kärbitud 10 000 rea kasutamist kogu faili asendajana. Hoida täielik mudel või saata stabiilsete identiteetidega muutmisoperatsioonid. Ajutine ohutu piirang on keelata kärbitud eelvaate muutmine selge põhjusega. Katsetada piiri mõlemat poolt, lahtri/rea/veeru muutmist ja peidetud saba säilimist pärast Save/reopen. See on kinnitatud andmekao viga ka väikese faili ja ühe kasutajaga.

**A01: XLSX stale Save.** Säilitada loetud ketta versioon, kontrollida seda enne kirjutust ja pakkuda konflikti korral mõlemat versiooni. Eristada oma watcher-sündmused teise tegija muudatustest. Kaks app-katset kinnitasid ülekirjutamise; kohalikku riskivähendust ei pea siduma kogu dokumenditeenuse ümbertegemisega. Kontroll/write vahet ei tohi nimetada atomaarseks CAS-iks.

**A16: draw.io canvas'e baasi kaitse.** Siduda eksporditud graaf konkreetse TextDocument'i baasi/revisjoniga ning koordineerida välised muutused. Päris autosave eemaldas sõltumatult lisatud kujundi ka siis, kui VS Code'i tekstimudel oli juba uue versiooniga puhas. Pelgalt workspace.fs kasutamine ei paranda seda, sest provider juba kasutab TextDocument/WorkspaceEdit teed. Säilitada töötav xmlsvg round-trip ja dirty-graafi kaitse hilise load'i vastu.

**A09: uuendaja install-root containment.** Nõuda ohutut katalooginime ja kontrollida lõplikke teid enne kustutamist nii validatoris kui installeris. Säilitada kõik checksumi/base-layer/rollback kontrollid. See on väike lokaalne töö, mille sõltuvus suurest arhitektuurimuudatusest oleks põhjendamatu.

**A06: transkripti salvestus.** Unikaalne tempfail, sama session'i serialiseeritud muutmine ning revisjoni või muutmisoperatsiooni eeltingimus. Ainult juhusliku tempnime lisamine parandab ENOENT kokkupõrget, kuid jätab vana full-snapshot üle kirjutamise võimaluse. Tegeliku kahe hosti katses kaotasid juba järjestikku vabastatud save'id teise kinnitatud kõnelejanime; mõlemad vaated kinnitasid kaotust.

**A08: chat HTML-piir.** Defineerida lubatud markup ja URL-id, seejärel jõustada sanitization enne HTML lisamist. Päris webview katse kinnitas assistendi CSS-i mõju kooskõlastusnuppudele ja composer'ile. Ühine RenderedMarkdown on paranduse loomulik piir ka taastatud vestluste jaoks. Valida eksplitsiitne väliste piltide laadimispoliitika ning säilitada katses toiminud nonce-põhine skriptikeeld. Katsetada, et Markdowni sisu ei muuda sõnumist väljaspool olevaid juhte; HTML-escaping kasutaja tekstimullis juba toimis.

**A19: brauseri veavastuse metainfo.** Rakendada read-share kontrolli ühiselt edukatele ja vigastele tööriistatulemustele. Ilma lugemisõiguseta jätta URL, pealkiri ja sisu välja. Säilitada katses toiminud juhtimiskeeld ning ootel tegevuse katkestamine. Lisada nähtav õiguse tühistamine; ühe vooru konteksti peitmine ei ole sama tegevus.


**Valmisoleku tõend:** selles auditis leitud sünteetilised juhud peavad lõppema säilitatud andmete või eksplitsiitse veaga; lisaks Windowsi path-variandid ja tegeliku webview HTML/CSS juhtumid. Kehtivad legitiimsed uuendused, Markdowni tabelid/kood/plaanid ja transkripti tavakasutus jätkavad tööd.

## 2. Määrata jagatud ressursi muutmise omanik

A01/A05/A06/A18. Kirjeldada dokumendi, vestluse, transkripti ja scheduled slot'i kohta identiteet, autoriteet, kirjutaja ulatus, revisjon, commit'i kinnitus ja crash recovery. Praegune per-instance queue jääb kohalikuks töövahendiks; seda ei nimetata enam kogu ressursi garantiiks. Brauseri puhul siduda käsk sihi ja navigeerimis-/vaatlusversiooniga: A18 katses pageId ei muutunud, kuigi leht muutus. Võimalik vestlusepõhine saki omand ei kõrvalda vajadust avastada inimese navigeerimine sama töö jooksul.

Vestluse kahe päris hosti kontrollitud põimumine täpsustab vastuvõtukatset:
composer'i eelistusemuudatus peab säilitama teises protsessis just kinnitatud
assistendivastuse ja lifecycle'i. Praegune täiskirje asendus kaotas need ka siis,
kui esimene kontroller oli edu tagastanud; restart ei taastanud vastust.
Ühe hosti kaitse ja järjestikune kahe hosti kontroll toimisid. Eri väljade
lahutamine vähendab kokkupuutepinda, kuid ei asenda sama vestluse sündmuste
ühist tehingulist kirjutusreeglit.

Vestlus/transkript vajab single-writer teenust või transaktsioonilist salvestust. Valiku aluseks on mitme akna/processi kasutus ja migratsioon olemasolevatest JSON-recordidest. JSON võib jääda ekspordi või läbipaistva hoiustamise vormiks; failiformaadi muutmine iseenesest ei lisa tehinguid. Ajastatud töö vajab jagatud ressursi identiteeti, atomaarset claim'i/lease'i ning taastamisel idempotentsust. Kahe akna app-katse näitas, et sama Flow failil on erinevate workspace-aliastena avades eraldi workspaceState tähised. Atomaarne kirjutus kummaski eraldi olekus ei lahenda seda; kõigepealt peab omaniku asukoht ja võtme ulatus kattuma jagatud tööga. Exactly-once välismõju ei saa lubada üksnes running-lipuga.

**Valmisoleku tõend:** sama objekti, kahe objekti, kahe protsessi ja kahe akna katsed; kaks edukalt kinnitatud append'i on pärast restarti alles; üks slot annab ühe aktiivse omaniku; katkestus pärast claim'i ei kaota tööd ega korda vaikimisi mitte-idempotentset välismõju. Migreerimine säilitab record-id, tombstone'id, continuation'i ja korruptsiooni karantiini.

**Maksumus/risk:** keskmine kuni suur olenevalt storage-valikust. Üleminek peab säilitama vana andmestiku; kiireim ohutu esmane piirang võib olla ühe kirjutaja jõustamine ühe ruumi kohta koos kasutajale nähtava põhjusega. See oleks ajutine riskivähendus, mitte samaaegse koostöö eesmärgi täitmine.

## 3. Ühtlustada dokumendi ja teadmusruumi leping

A01/A04/A05/A10/A14/A16/A17. Defineerida SpaceId, ResourceUri ja versiooniga dokumendiviide; eristada lokaalne, sünkroniseeritud lokaalne, mounted ja provider-backed ruum. Koostada capability matrix: read/edit/watch/conditional-write/backup/merge/export/materialize.

Vormingupakkuja teatab võimekused ning peab täitma ühise save/conflict/recovery lifecycle'i. Kuva virtualiseerimine, filtreerimine või kärpimine ei tohi muuta salvestatava dokumendi täielikkust. Hosti ja editori undo/redo ning konfliktivaliku tagasivõtmise tähendus tuleb eraldi määrata. Teksti puhul saab kasutada olemasolevat Markdown/CSV koordinaatorit ja selle tõendeid. Binaarsete vormingute jaoks võib vajalik lahendus olla konfliktikoopia ja selge valik; CRDT ei ole universaalne failikaitse.

Agent peaks saama dokumendi identiteedi ja versiooni ning tema vahendatud kirjutus peab seda kontrollima. Native shelli ja kolmandate osapoolte failikirjutajate puhul tuleb ausalt eristada ennetamist, avastamist ja taastamist. Vaatleja üksi ei peata teadlikult või kogemata vana faili asendamist. OS failisüsteemi CAS-i puudumisel ei tohi pre-check + write'i nimetada atomaarseks.

Readonly eelvaade peab samuti eristama nähtavat snapshot'i ja praegust faili.
A17 puhul saavad olemasolevad watcher'id muutuse/kustutuse kätte; lõpetada tuleb
nende sõnumite tarbijaleping. Kehtestada auto-reload või nähtav refresh ning
puuduva faili puhul selgelt märgitud cache. DOCX-i olemasolev käsitsi Refresh
ja PDF-i taasavamine annavad toimiva laadimistee, millele see rajada.

**Alternatiivid:** kohaliku working-set'i materialiseerimine võimaldab path/cwd nõudvaid runtime'e; brokered failitööriistad annavad parema versioonikontrolli neid toetavatele runtime'idele. Võimalik on kombineeritud tee. VS Code API kasutamine aitab provider'itega, kuid ei kõrvalda cwd ega reconnect'i probleemi.

**Valmisoleku tõend:** inimese unsaved ja saved muutused, agendi stale read, kaks agenti, väline rename/delete/replace, offline/reconnect, multi-root valiku muutus ja binaarse faili konflikt. Iga tulemi puhul peab olema teada, millised versioonid säilisid ning milline versioon on nähtav.

## 4. Mõõta ning eraldada laadimise kulud

A02/A03. Seda uurimis- ja piiratud parandustööd saab teha ressursiomaniku tööga paralleelselt. Kõigepealt täpne startup timeline: shell restoration, extension activation, editor ready, input ready, terminal focus ja AI focus. Seejärel valida üks sündmustel põhinev layout'i omanik; hiline taimer ei tohiks kasutaja vahepealset valikut üle kirjutada.

Webview jaoks võrrelda eraldi entrypoint'e ja päris code-splitting'ut. Renderer, AI-paneel ja Flows on loomulikud tarnepiiri kandidaadid; ühised väikesed UI osad võivad jääda jagatuks. Tegelikud script-päringud ja kuue Markdowni avamise kerge mõõtmine on nüüd olemas: 1×/4× CPU korral oli skripti täitmise mediaan 301/1346 ms, kohaliku laadimise mediaan 88/92 ms. Eraldi profiil kinnitas diagrammita dokumendi juures ka ELK-i ja parseri initsialiseerimist. Seetõttu peab võrdlus kontrollima nii tarne suurust kui tegelikku käivitusjärjekorda; lähtekoodi lazy-import üksi pole piisav. [Katse piirid](performance-observations.md) eristavad sooja Maci mõõtmist, profiili mõju ja puuduvaid Windowsi/külmkäivituse tulemusi. Module attribution ja coverage annavad uurimise järjekorra, mitte täpse säästu lubaduse.

Mõõta eraldi vormingu pika vaatesessiooni ressursse. PDF-i kõik 20 külastatud
canvas't jäid DOM-i alles, kuid lühike RSS/JS-heap valim ei tõendanud võrdelist
mälukasvu. Lehekülgede cache'i/eviction'i otsus peab järgnema browser/GPU ja
sihtriistvara mõõtmisele; teoreetilist RGBA pindala ei esitata tegeliku RAM-ina.

**Valmisoleku tõend:** sama pakitud buildi, fixture'ide ja Windowsi masina cold/warm proovid, launch-to-input ja interaction latency, CPU ja process memory; vähe/no AI, 1/5/20 avatud dokumenti, peidetud paneelid, suured tabelid/PDF-id. Võrdluses kontrollida cache'i, CSP-d, extension update'i terviklikkust ja vormingu first-use aega. Pakkuda mõõtmiste järel eelarved ning panna regressioonikontroll CI-sse. macOS-i protsendiparandust ei esitata Windowsi tulemusena.

## 5. Ühtlustada tööde lifecycle ja runtime'i sündmused

A07/A11/A12/A15/A20. Kasutada üht DAG täitjat kõigist Flow sisenemiskohtadest; viia runtime'i-spetsiifiline töö adapterisse. Ühine run-leping peaks sisaldama accepted, progress, approval, cancel, completion, recovery ja output-resource seoseid. Daemon ja transkriptsioon võivad säilitada oma scheduler/engine'i, kuid nähtav tööseis ja katkestuse tähendus peavad olema järjekindlad.

Transkriptsiooni taastamisel eristada uue akna activation'it töö omaniku lõppemisest. A20 katses märkis B A endiselt töötava job'i katkenuks; A lõpetas hiljem edukalt. Lisada omaniku identiteet ja elusoleku/lease'i kontroll ning teiste akende tööseisu uuendamine. Ühe hosti inflight-loendi puhastamine ei tohi eemaldada teise hosti taastatavat tööd. Selle vastuvõtukatse peab hõlmama ka päris owner-crash'i ja peer-restart'i; mootorite oma võimekused jäävad eraldi.

ACP puhul saab enne laiemat muudatust parandada algatuse jagamist: kõik külma ühenduse kutsujad ootavad sama promise'i, viga/katkestus lõpetab kõik ootel kutsed ja uus katse saab alata pärast tegelikku lõppemist. Päris binaari A15 katse kinnitas ühe samaaegse kutse nurjumist; soe kahe sessiooni kontroll töötas. Codexi olemasolev ühine algatus läbis native-katse ja annab sama koodipaketi sees toimiva lähtekoha.

Native event listener peab olema paigas enne töö käivitamist või transport peab sündmused ohutult puhverdama. Flow katse näitas, et enne turnStart vastust saadetud completion läheb praeguses executor'is kaduma; tegeliku protokolli järjestust tuleb eraldi kontrollida. Pre-aborted signaal, pooleliolev approval ja paneeli sulgemine peavad olema lepingu katsejuhud.

**Valmisoleku tõend:** sama flow tulemus editor/panel/schedule kaudu, kõigi runtime'ide katkestus ja crash, õige vestluse routing, eraldi browser target ownership ning kõik lõpetamata tööd nähtavad/peatatavad. Dikteerimise puhul kontrollida backpressure'it, audio säilimist ja temp cleanup'i aeglase transkriptsiooni ajal.

**Maksumus/risk:** keskmine kuni suur. Teha üks entrypoint korraga lepingutestide taha; säilitada provider'ite eri võimekused. Kõige üldisema abstraktsiooni ette disainimine enne ühe reaalse migratsiooni läbimist tekitaks uut tõestamata keerukust.

## 6. Muuta arhitektuurilised piirid kontrollitavaks

Koondada source'ist ja katsetest saadav architecture/contract inventory: runtime capability, format capability, space capability, trust state ja background policy. Uue runtime'i/formaadi/ruumi lisamise kontroll peab küsima, kas muudatus jäi oma adapterisse ja registreerimisse ning kas ühised persistence/approval/document reeglid säilisid.

Testikäsk peab selgelt ütlema, millised testid käivad tavaliselt ja millised nõuavad native/API/Windows keskkonda. Praegu on 132 tracked TS-testifailist 119 standardkäsus eksplitsiitselt nimetatud. Mõni vana test peegeldab implementation'i või kasutab varasemat interface'i ning tsx ei typecheck'i seda. Roheline käsk ei tähenda automaatselt terviklikku lepingukatvust.

Määrata sisuta diagnostika ühised run/conversation/document ID-d, duration'id, queue pikkused ja resource lifetime. Prompt'i või dokumendi payload'i logimine peab olema teadlik erand. Analytics event schema, opt-out, GeoIP ja vabatekstilise feedback'i tähendus peavad sobima kasutajale antud kirjeldusega.

**Valmisoleku tõend:** coverage register ei sõltu käsitsi aimamisest; CI annab nähtava skipped-native rea; kõigi oluliste komponentide puhastus ja katkestus on testitud; üks juhtum on jälgitav üle protsesside ilma kasutaja dokumendi sisu logimata.

## Enne auditi lõpetamist

XLSX, CSV ridade kadu, Markdowni split/conflict ning kahe käivituse paanihüpe on app'is kontrollitud. Lisandusid tavarežiimi püsiv taastamine, kahe akna dokumendikaitse ja ajastuse topeltkäivitus ning Codexi/ACP native ühenduse lifecycle. Vestluse kahe tegeliku hosti juhitud salvestusvõidujooks ning UI/restart readback on nüüd tõendatud. Brauseri ühine tegelik tööriistatee kinnitas sihivea ja keelatud vastuse metainfo; read/control keeld, queue ja ootel locatori tühistamine läbisid katse. Transkripti tegelikud kahe hosti katsed kinnitasid kaotatud nime muutuse ja elusa töö eksliku taastamise; ühe hosti pipeline/view ning järjestikused nime muudatused läbisid sünteetilise engine-piiriga kontrolli. Jätkata native mudeli/failitööriistade, mootori- ja täiendavate katkestusjuhtumitega; hankida representatiivse nõrga Windowsi baseline ning täiendada tervikhinnangut nende tulemustega. Allikakoodiga tõestatud kohalikud vead ei pea ootama jõudlusauditi lõppu, kuid implementatsioon käib eraldi heaks kiidetud tööna.
