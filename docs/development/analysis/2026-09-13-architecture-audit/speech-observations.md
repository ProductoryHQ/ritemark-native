# Transkriptsiooni omanik ja kahe akna salvestus

Aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`; macOS arm64;
kontrollitud tavarežiimi laiendus ja ühilduv installitud shell.

**Tulemus:** uus aken kuulutas teises aknas jätkuva transkriptsiooni ekslikult
katkenuks. Algne host lõpetas sama töö edukalt ja teine host sai tulemust
salvestusest lugeda. Lisaks kaotas kahe tegeliku TranscriptWorkbenchProvider'i
kõnelejanime muudatus teise kinnitatud muudatuse. Järjestikune kahe hosti
kontroll säilitas mõlemad nimed.

## Metoodika ja piirid

Profiil oli `/private/tmp/ritemark-audit-normal-bg5jgmun/speech-profile`;
põhiprotsess 60627, host A 60859, host B 69268 ja CDP port 9242. A avas kohaliku
katsekausta, B sama kausta sisaldava `second.code-workspace` faili. Mõlemal oli
sama toote globalStorage ja transkriptide kataloog. Kasutati kolme ühesekundilist
vaikset WAV-faili; päris kasutaja salvestisi ei loetud ega üles laaditud.

[Audit-observer](evidence/speech-audit-api.cjs) leidis juba aktiveeritud
`TranscriptWorkbenchProvider` objekti toote ExtensionContext.subscriptions seest.
Olemasoleva konteksti leidmiseks loeti lokaalse V8 inspectori kaudu cache'is
oleva activation-funktsiooni `settingsProvider` viidet. Lähtekoodi ei
hinnatud uuesti ega loodud asendus-provider'it, JobManager'i või SessionStore'i.
Ajutised globaalsed viited eemaldati; võtmeid/salasõnu ei loetud ega logitud.

Töö ajastuse juhtimiseks asendati **ainult** olemasoleva kohaliku mootori
`transcribe` meetod sünteetilise katsevastusega, mis ootab vabastamist või
katkestamist. Piiratud lubatud failinimed ja 120 s ülempiir välistasid lõputu
oote. JobManager, WAV ettevalmistus, lainekuju arvutamine, Memento, session'i
koostamine, salvestus ning tegelikud vaated jäid toote teostuseks. See katse
**ei tõenda Whisperi, ElevenLabsi ega helituvastuse kvaliteeti**.

Kahe kõnelejaga session oli eraldi sünteetiline seemnekirje. Selle `engine`
metadata ei tähenda, et pilvemootorit oleks käivitatud. Nime muutmiseks kutsuti
päris provider'i `_renameSpeaker` meetodit; see on instrumenteeritud
sisenemiskoht, mitte klaviatuuriga tehtud kasutajakatse. Vaatluse lõpus lugesid
mõlemad päris webview'd tulemuse toote hosti sõnumi kaudu.

## Töö taastamine teise akna avamisel — A20

[Algne kontroll](evidence/normal-speech-recovery-probe.json) läbis ühe hosti
prepare → transcribe → save → done tee ning kuvamiseks avatud transkript
sisaldas `AUDIT SYNTHETIC TRANSCRIPT control.wav`. Heli ei hakanud ise mängima.

[Jälgitud kahe akna katses](evidence/normal-speech-recovery-observed-probe.json):

1. A käivitas töö `job-mtzwsnna-3` ja jõudis `transcribing` olekusse.
   Tegelik mootori kutse ootas sünteetilise vastuse vabastamist. A globalState
   snapshot sisaldas selle töö pooleliolevat kirjet.
2. B aken avanes tavaliselt. Toote activation kutsus `recoverInterrupted`.
   B JobManager kandis **sama ID-ga** töö olekusse `interrupted` ja näitas
   „Ritemark closed while this recording was being transcribed.” koos
   „Try again” nupuga. A host oli jätkuvalt elus ja töö ootel.
3. Mõlemad tegelikud Transcribe-paneelid loeti samal ajal: A näitas
   `Transcribing · 0%`, B katkemise teadet. [Pilt](evidence/normal-speech-false-interrupted.png)
   vaadati üle ja vastas B paneeli tekstile.
4. A oodatud vastus vabastati. Sama töö jõudis `done` olekusse ning B
   SessionStore luges selle edukalt salvestatud transkripti. B lokaalses
   tööde loendis ja paneelis jäi töö siiski katkenuks.

See kinnitab, et „uus laiendushost” ja „eelmise töö omanik suri” on praegu
segamini. [JobManager](../../../../extensions/ritemark/src/speech/JobManager.ts)
read 90–110 ei kontrolli omaniku elusolekut ning puhastavad ühise inflight-võtme.
[Activation](../../../../extensions/ritemark/src/extension.ts) read 405–443 loovad
iga hosti jaoks uue subsystem'i ja kutsuvad taastamist. [Koostamine](../../../../extensions/ritemark/src/speech/index.ts)
read 56–63 annavad sellele toote globalState'i.

A Memento snapshot näitas veel vana inflight-kirjet, B oma juba tühja loendit.
Vahepealset SQLite-kirjet ei mõõdetud: katse ei väida, millisel millisekundil
vana hosti cache või ketas muutus. Samuti ei lavastatud omaniku crash'i pärast
B taastamist ega native mootori topeltkäivitust. Need on paranduse
vastuvõtukatsed, mitte siin juba tõestatud tagajärjed.

## Kaks kinnitatud nime muudatust — A06 täiendav tõend

[Salvestuskatse](evidence/normal-speech-store-probe.json) algas järjestikuse
kontrolliga: A muutis kõneleja 0 ja B kõneleja 1 nime; mõlemad säilisid.

Seejärel peatati mõlemas hostis üks katse-session'i `save` kutse vahetult enne
originaalmeetodisse sisenemist. Provider oli session'i juba lugenud ja nime
muutnud. Mõlemad kandidaadid põhinesid seega samal varasemal kirjel:

| Kandidaat / tulemus | Kõneleja 0 | Kõneleja 1 |
| --- | --- | --- |
| Järjestikuse kontrolli baas | AUDIT SEQUENTIAL ZERO | AUDIT SEQUENTIAL ONE |
| A ettevalmistatud muudatus | AUDIT CONCURRENT ZERO | AUDIT SEQUENTIAL ONE |
| B ettevalmistatud muudatus | AUDIT SEQUENTIAL ZERO | AUDIT CONCURRENT ONE |
| A vabastatud, meetod lõpetas edukalt | AUDIT CONCURRENT ZERO | AUDIT SEQUENTIAL ONE |
| B vabastatud, meetod lõpetas edukalt | AUDIT SEQUENTIAL ZERO | AUDIT CONCURRENT ONE |

A save-hold kestis 4 ms ja B oma 109 ms; mõlemad vabastati eksplitsiitselt.
Originaalsed save'id tehti **järjestikku**. Mõlemad rename-meetodid lõpetasid
edukalt, kuid A nimi kadus. Mõlemad hostid lugesid seda tulemust; pärast
provider'i tegeliku `_push` kaudu värskendamist näitasid mõlemad webview'd
kaotatud nime asemel varasemat nime.

See täpsustab [varasemat tempfaili komponentkatset](evidence/concurrency-probes.json):
ühise `.tmp` nime kokkupõrge ei ole ainus probleem. Unikaalne tempnimi ei takista
vananenud täiskirjega teise muudatuse asendamist. [SessionStore.save](../../../../extensions/ritemark/src/speech/SessionStore.ts)
read 58–66 ei kontrolli baasi; [provider'i rename](../../../../extensions/ritemark/src/transcriptWorkbenchProvider.ts)
read 157–174 teeb read/modify/save. Võidujooksu sagedust tavalisel kasutamisel
sellest juhitud põimumisest ei arvutata. Siin ei toimunud session'i insight'i
genereerimist, eksporti ega rakenduse taaskäivitust.

## Vaatlusvead ja puhastus

Esimene paneeliotsing kasutas ekslikult `body.dataset.editorType`; tegelik
atribuut on `#root` elemendil. Pooleliolev töö kinnitati pärast seda eraldi
elusaks. [Jätkamise eeltingimuse katse](evidence/normal-speech-recovery-finish-probe.json)
leidis aga hiljem juba terminalse vea: observer'i 120 s ülempiir oli täitunud.
See on **abiskripti põhjustatud** `Audit engine observer-timeout`, mitte
spontaanne Ritemarki mootori rike. Mõlemad ebaõnnestunud vaatlused jäid alles.
Uus kahe akna katse algas alles pärast terminalse oleku ja tühja ootel-kutsete
loendi kinnitamist. Vana katse ebaõnnestunud töö jäi A paneelis eraldi reaks;
A20 järeldus kasutab uue töö ID-d.

[Puhastus](evidence/normal-speech-cleanup-probe.json) kinnitas 20 enne sulgemist
tuvastatud oma protsessi lõppemist ning pordi 9242 sulgumist. Teise akna
käivitamise CLI-protsess 69262 oli [eraldi kontrollis](evidence/normal-speech-cli-exit.json)
puudu; juhtklient lõppes exit 0. Kõik kolm genereeritud peak-WAV rada puudusid.
Mõlema hosti ajutised meetodid taastati enne sulgemist, algne audit-observer
fail taastati pärast sulgemist ning speech-abimoodul eemaldati staging'ust.
Toote neli kontrollitud artefakti säilitasid sama SHA-256.

[Korrelatsioon](evidence/speech-analysis.json) kontrollib 42 hostisündmust,
kolme mootorihoide lõppu (edu, observer-timeout, edu), kaht eksplitsiitset
salvestushoide vabastamist, source-viiteid ja abiskriptide süntaksit. Ühe
väikese WAV-fixture'i edu ei tõenda pika heli mälu-/jõudluspiiri ega Windowsi tuge.
