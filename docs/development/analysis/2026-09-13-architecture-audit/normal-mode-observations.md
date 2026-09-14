# Tavarežiimi taastamine ja jagatud töö kahe aknaga

2026-09-13 · aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.
Need katsed jätkavad [varasemaid rakenduskatseid](live-observations.md),
kõrvaldades extension development mode'i püsivate varukoopiate piirangu.

## Laadimise ja keskkonna kontroll

Auditi laiendus kopeeriti sõltumatu APFS-koopiana sünteetilise testiprofiili
`--extensions-dir` kataloogi. `package.json`, hosti `out/extension.js`,
`media/webview.js` ja binaaride manifesti SHA-d on lähte-worktree'ga samad;
failide inode'id erinevad. Versiooni ega toote koodi ei muudetud. Eraldi
vaatlusdraiver kasutab ainult sünteetilist workspace'i ja piiratud tavakäske.

[Käivituse tõend](evidence/normal-startup-probe.json) kinnitab aktiivse Ritemarki
laadimist täpselt sellest koopiast ning draiveri `ExtensionMode.Production` väärtust
1. `extensionDevelopmentPath` argumenti pole; `files.hotExit` on vaikimisi
`onExit` ja `files.autoSave` on `off`. [Staging'u register](evidence/normal-session.json)
seob argumendid, failide hashid ja käivitatud PID-id. Shell on sama kontrollitud
ühilduv installitud 1.10.1; see pole uus väljalaskepakett.

Katseprofiili analytics ja automaatne uuendamine on keelatud. Ühtegi päris
teadmusruumi, mudelipäringut ega native agendi failitööriista ei kasutatud.
Põhiproovides on ajastatud Flow'd välja lülitatud; allpool kirjeldatud üks
ajastuskatse lubas need ajutiselt ainult selle profiili jaoks.

## Markdowni ja XLSX-i püsiv taastamine toimis

1. Sisestati Markdowni unikaalne salvestamata tekst ning muudeti XLSX-i lahtrit.
   VS Code näitas mõlemat dirty-olekus; kettafailid sisaldasid endiselt baasi.
2. Enne sulgemist leiti profiili `Backups` kataloogist Markdowni markeri ja
   custom editori taastamisviitega püsivad varukoopiad. Nende hashid säilisid
   rakenduse lõpetamise järel.
3. Rakendus suleti CDP Browser.close kaudu; vana PID-i lõppemine kontrolliti
   enne sama profiili uut käivitust. Mõlemad failid avati uuesti tavakäsuga.
4. Inimese muudatused taastusid nähtavatesse editoridesse ja dirty-mudelitesse,
   ketas oli endiselt muutmata. Tavaline Save salvestas mõlemad taastatud versioonid.

Tõend: [põhijada](evidence/normal-recovery-probe.json),
[järelkontroll ja Save](evidence/normal-recovery-finish-probe.json),
[taastatud dokumentide pilt](evidence/normal-recovered-documents.png).
Põhijada peatus XLSX-i vaatlemisel vigaselt koostatud DOM-selektori tõttu.
Rakendust ei taaskäivitatud ega andmeid uuesti sisestatud: järelproov kontrollis
sama taastatud vaadet korrektse selektoriga ja lõpetas salvestuse. Algne viga
on tõendis säilitatud; see oli rakise, mitte taastamise rike.

**Järeldus:** Markdowni ja XLSX-i varukoopia/taastamise tee annab selles
tavarežiimi juhtumis sisulise töö säilitamise kaitse. Seda tuleb säilitada A01
parandamisel. See ei tõenda korraga iga native Quit'i, OS-crash'i, voolukatkestuse
ega katkestatud kirjutuse tulemust. Development mode'i negatiivset proovi ei
kasutata enam tavarežiimi taastamise hinnanguna.

## Markdowni konfliktikaitse töötas kahe hosti vahel

Esimene aken avas sünteetilise kataloogi, teine `.code-workspace` faili, mis
viitab samale kataloogile. See on kaks VS Code'i toetatud aknaidentiteeti, mitte
sama extension hosti split-vaated. Tõend kinnitab erinevad hosti PID-id,
samad juurkausta URI-d ning sama globalStorage juure. Workspace-faili identiteet
on erinev — vestluste projectScope ei pruugi seetõttu samaks jääda.

Katses jõudis A-akna Save B-akna puhtasse mudelisse ja vaatesse. Seejärel
kirjutati kummaski aknas erinev salvestamata lõpp. A Save muutis ketast;
B säilitas oma kohaliku teksti ning näitas sama ketta SHA-ga konfliktiteadet.
B-aknas valiti eksplitsiitselt Keep my version. Pärast seda olid ketas ja
mõlema akna mudelid B valitud sisuga kooskõlas ning mõlemad sakid puhtad.

[Kahe akna tõend](evidence/normal-multiwindow-probe.json) on positiivne
vastutõend väitele, et Ritemarkil puudub üldse akendevaheline dokumendikaitse.
See tõendab järjestikuseid kirjutusi koos konfliktivalikuga. See ei ole
samaaegse atomaarse Save'i, automaatse ühendamise ega kahe agendi stale-read
kirjutuse ennetamise tõend. B valik asendas A variandi teadlikult; automaatset
ühisredigeerimist ei toimunud.

## Sama Flow ajastus käivitus mõlemas aknas

Sama kahe akna keskkonnas loodi üks `.flow.json`: trigger → Save File.
Sõlmed ei kutsu mudelit ega välist teenust. Save File kirjutas triggeri objekti
tekstiesituse ainult testikataloogi, nimetades faili tegeliku käivitushetke järgi.
Päevane ajastus seati jooksvale kohalikule minutile, mis jääb tavalise viie
minuti käivitusakna sisse. Kella ega scheduler'it ei asendatud testiversiooniga.

**Tulemus:** tekkis kaks väljundfaili. Mõlema workspace'i päris SQLite
workspaceState sisaldas sama Flow tee kohta `lastScheduledFor` väärtust
`2026-09-13T10:43:00.000Z` ja `lastStatus: success`. Lõpetamisajad olid
10:43:27.771Z ning 10:43:28.705Z. Need polnud ühe salvestuse kaks watcher-sündmust:
eraldi failid ja eraldi püsivad eduseisundid tõendavad kahte täitmist.

[Ajastuskatse](evidence/normal-scheduler-probe.json) loeb SQLite'i ainult lugemiseks.
Pärast vaatlust keelati fixture'i ajastus ja taastati profiili eelmine feature flag.
Sünteetilised väljundid jäid tõendiks alles.

**A06 täpsustus:** probleem pole ainult võidujooks ühe tähise ümber.
`FlowScheduleState(context.workspaceState)` annab samale füüsilisele Flow
failile kummagi workspace-aliase all eri tähise. Ainult ühe objekti mutex või
atomaarne kirjutus kummagi eraldi andmebaasi sees ei väldi kordust. Töö omanik
peab olema määratud kokkulepitud jagatud Flow/ressursi identiteedi järgi.
Eraldi soovitud jooksud peavad olema eristatavad, mitte juhuslikult aknast sõltuvad.

Vestluste sama record'i ja transkriptsiooni sama session'i võidujooksud jäävad
endiselt varasemate komponentkatsete tõendiks. Seda Flow app-katset ei laiendata
automaatselt neile alasüsteemidele.

## Käivituse ja logide piiratud lisavaatlus

Tavarežiimi esimeses 27-sekundilises vaatluses oli terminal fookuses alates
6,763 sekundist; AI paani polnud salvestatud umbes 100 ms sammuga olekutes.
See erineb varasematest development mode'i terminal→AI jadadest. Sellest ei
järeldu, et AI polnud ühelgi vaatlusvahelisel hetkel avatud. A02 hinnang peab
kirjeldama konkureerivaid fookuse omanikke, mitte lubama alati sama nähtavat järjekorda.

[Sama jooksu renderer-logis](evidence/normal-log-observations.json) märgiti host hetkeks mittereageerivaks ja seejärel
taas reageerivaks. Ilma CPU-profiilita ei omistata seda konkreetsele moodulile.
Logis oli ka Phosphori font-weight valideerimisteade; see ei takistanud käesolevaid
dokumendikatseid. Teise akna CLI avamiskutse sai CDP-pordi bind-teate, sest
kutses korrati olemasoleva põhiprotsessi debug-porti. Teine aken ja host avanesid
siiski ning tõend kinnitab nende kuulumist testiprofiili. See käivitusvahendi
teade ei tõenda Ritemarki tavakasutuse pordikonflikti.

## Alles olev töö

Native tööriistade stale read / write ja katkestus, ühine brauseri siht, teiste
vormingute fidelity ja keerulisemad failisüsteemi sündmused jäävad kontrollida.
Windowsi jõudluse ja native käitumise kohta pole nendest macOS-i katsetest
võimalik teha lõpetatud hinnangut. Katvusregistri vastavad nõuded jäävad avatuks.

## Katse lõpetamine

[Puhastuse tõend](evidence/normal-cleanup-probe.json) kinnitab testiprofiili
rakenduse ja selle järeltulijate — kokku 22 vaadeldud protsessi — lõppemist
ning CDP pordi 9238 sulgumist. Browser.close vastuse aegumine ei olnud
lõppemise tõend: kontrolliti protsesside tegelikku puudumist. Juhtklient
lõpetati seejärel edukalt (exit 0). Kolme hosti sünteetilised sündmuste logid
säilitati; endpointide autentimistokeneid tõenditesse ei kopeeritud.
