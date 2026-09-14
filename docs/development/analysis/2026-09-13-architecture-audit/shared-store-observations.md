# Vestluse jagatud salvestuse kahe protsessi katse

Alus: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`, macOS arm64, 2026-09-13.
Täpsustab leidu A06: päris Ritemarki kahe laiendusprotsessi salvestuste
kontrollitud põimumisel kadus edukalt kinnitatud assistendivastus. Mõlemad
kontrollerid lugesid seejärel puuduliku ajaloo ning vastus puudus ka pärast
rakenduse sulgemist ja uue protsessiga käivitamist.

## Millist piiri kontrolliti

Kaks kaustata akent kasutasid sama ajutist profiili ning sama `no-folder`
vestlusskoopi. Mõlema hosti `ConversationController` viitas oma
`ConversationStore` objektile sama `globalStorage/conversations/v1` kohal.
Katse kontrollis tegelikke identiteete, mitte ei asendanud currentScope'i.
Varasema dokumendi/Flow katse folder-aken ja `.code-workspace` aken annavad
seevastu eri vestlusskoobid; neid ei kasutatud sama vestluse kirjutajatena.
See on olemasoleva skoobikontrolli oluline piir ja tugevus.

Uus profiil oli `/private/tmp/ritemark-audit-normal-bg5jgmun/store-profile`.
Esimene main PID oli 15957, hostid 16170 ja 18431, CDP port 9240. Pärast
tõendatud sulgumist käivitus main PID 21662 ja host 21875. Kasutati sama
muutmata staged tootmislaiendust, mille package, hosti koodi ja webview SHA
kontrolliti. Ühilduv installitud shell ei ole uus release-build.

Auditi vaatleja võttis viite **juba laetud** mooduli cache'is olevale
`unifiedViewProvider._conversationController` objektile. Uut kontrollerit ega
Store'i ei konstrueeritud. Vaatleja lubas ainult nelja fikseeritud sünteetilist
vestluse ID-d; tegi Store'i kaudu algkirjed ning kutsus tegelikku
`handle(conversation/set-composer-preference)` ja `completeRuntimeTurn` meetodit.
Mudelipäringut või native tööriista ei käivitatud; provider'i runtimeSession
kaart oli enne ja pärast tühi. Native callback'i eelse runtime'i olekukontrolli
ega kasutaja hiirežesti selle katsega ei läbitud.

Ajastuse kontrolliks asendas vaatleja katse ajal konkreetse Store'i
failisüsteemi delegaadi: ainult valitud sünteetilise kirje tempfaili `rename`
ootas vabastust kuni 8 sekundit. Kõik andmed, versioonikontrollid, tempfaili
kirjutamine, rename ja indeksi lepitamine jäid toote koodi teha. Teised teed
läksid delegaadist otse läbi. Salvestuse kandidaadid salvestati tõendina enne
rename'i ning katse vabastas mõlemad kirjutused selges järjekorras. See tõendab
võimalikku põimumist; selle loomulikku esinemissagedust ei mõõdetud.

## Kontrollid ja tulemused

| Stsenaarium | Tulemus |
| --- | --- |
| Host A muudab Codexi eelistust, seejärel host B Claude'i eelistust | Mõlemad õnnestusid; mõlemad sõltumatud väljad säilisid revisjonis 3 ja pärast restarti |
| Sama hosti kaks samaaegset eelistusemuudatust | Esimese kirjutuse hoidmise ajal teine ei lõpetanud; vabastamise järel mõlemad õnnestusid ja mõlemad väljad säilisid revisjonis 3 |
| Kahe hosti samaaegsed eri eelistusemuudatused | Mõlemad valmistasid ette revisjoni 2. A tagastas edu, seejärel B tagastas edu. Kettale jäi ainult B muudatus, revisjon 2 |
| Hosti A assistendivastuse lõpetamine ja hosti B eelistusemuudatus | A salvestas vastuse ning `idle` oleku, tagastas kahe sündmusega revisjoni 2. B kirjutas hiljem oma revisjoni 2: vastus kadus ja vana `working` olek tuli tagasi |
| Mõlema päris kontrolleri get ja UI taastamine | Mõlemad lugesid ühe kasutajasündmusega ajaloo; päris hosti postMessage kaudu avatud vaadetes vastust ei olnud |
| Rakenduse täielik sulgemine ja uus käivitus | Varem edukad kontrollid säilisid; kadunud eelistus ja assistendivastus ei taastunud |

Vastuse kadumise minimaalne sündmustejada:

```mermaid
sequenceDiagram
  participant A as Hosti A kontroller
  participant D as Jagatud vestlusfail
  participant B as Hosti B kontroller
  A->>D: Loe revision 1 ja kontrolli baasi
  B->>D: Loe revision 1 ja valmista eelistusemuudatus
  Note over A,B: Mõlema tempfail valmis, rename kontrollitult ootel
  A->>D: Rename: revision 2, kasutaja + assistent, idle
  D-->>A: Kirjutus lõppes; kontroller tagastas edu
  B->>D: Rename: revision 2, ainult kasutaja, working
  D-->>B: Kirjutus lõppes; kontroller tagastas edu
  A->>D: Loe uuesti ja lepita indeks
  D-->>A: Assistendivastus puudub
```

`mutateLatest` proovib stale-revision vea korral kuni viis korda uuesti.
Selles põimumises jõudsid mõlemad kirjutajad kontrolli läbida enne kummagi
rename'i. Seega ei saanud edukalt lõppenud operatsioon retry't käivitavat viga.
Unikaalne tempfail ja atomaarne rename kaitsesid osalise JSON-i eest; need ei
andnud kogu read/modify/write operatsioonile protsessideülest atomaarset piiri.
Provider'i checkpoint-järjekord on samuti ühe hosti mälus.

## Vaatluse piirid ja säilitatud erandid

Esimene programm lõpetas kõik salvestuskatsed ning mõlema kontrolleri readback'i,
seejärel ei leidnud avanevas AI vaates oodatud projektsiooni. Täpne UI-ajastuse
põhjus jäi isoleerimata. Tulemusfailis säilis see viga. Eraldi jätkuprogramm
ootas valmis vaateid ja sidus hostid webviewdega tegelikult saabunud requestId
järgi. Sama kirje laadimine õnnestus mõlemas aknas; salvestuskatseid ei korratud.

Hilisema vaate avamise jooksul muutus neljanda kirje Codexi eelistus `high` →
`auto`, revisjon 2 → 3. UI lähtekoodis on võimekustest sõltuv eelistuse
lähtestamine, kuid selle muutuse täpset põhjust ei eraldatud. Assistendivastus
jäi puudu nii enne seda eraldi metadatamuutust kui pärast restarti. Seetõttu ei
eelda restart-kontroll, et kogu fail peab jääma baiditäpselt revisjoniks 2.

Sama kaustata skoobi tulemust ei üldistata erinevate workspace'ide vestlustele.
Kõik salvestatud katsevoorud ja vastusetekstid olid sünteetilised. Native mudeli
tegelik completion/approval/cancel voog ning selle loomulik ajastus vajavad
eraldi katset. Ühe Store'i serialiseerimine, scope/binding kontrollid, schema
valideerimine, tombstone'id ja karantiin on jätkuvalt toimivad kaitsekihid.

## Arhitektuuriline järeldus

Vestluse sündmused, lifecycle ja composer'i eelistused elavad samas täiskirjes.
Kasutajaliidese eelistusemuudatus võib seetõttu põrkumisel kustutada teise hosti
juba kinnitatud vastuse. Oleku jagamine vajab ühist kirjutajat või salvestuse
tehingulist muutmise lepingut. Eelistuste eraldamine vähendaks kokkupuutepinda,
kuid ei lahendaks iseseisvalt sama vestluse kahe sündmuse kirjutamist.

Paranduse tõend peab hõlmama eri väljade muudatusi ja sündmuse/lifecycle'i
muudatust, sama hosti kontrolli, kaht protsessi ning restarti. Mõlemat edukalt
kinnitatud muudatust peab saama hiljem lugeda või peab üks kirjutus lõppema
eksplitsiitse konfliktiveaga. Failiformaadi vahetamine või täiendav per-host
mutex üksi ei kehtesta seda garantiid.

## Artefaktid ja puhastamine

- [Salvestuskatse](evidence/normal-store-probe.json) ja
  [programm](evidence/normal-store-probe.mjs) säilitavad kandidaadid, vastused,
  kettasisu ja lõpu UI-ajastuse vea.
- [Vaate jätkukontroll](evidence/normal-store-view-finish-probe.json) ning
  [visuaalselt kontrollitud vaade](evidence/normal-store-lost-result.png).
- [Taaskäivituse kontroll](evidence/normal-store-restart-probe.json) loeb neli
  sama sünteetilist kirjet uue hosti päris kontrolleri kaudu.
- [Esimene sulgemine](evidence/normal-store-stop-before-restart.json) kinnitas
  18 protsessi lõppemist; [lõplik sulgemine](evidence/normal-store-final-cleanup.json)
  kinnitas 12 protsessi lõppemist. Mõlemal korral sulgus CDP port 9240.
- [Vaatleja taastamine](evidence/normal-store-observer-restoration.json) kinnitab
  varasema auditi driver'i taastamist ja ajutise helper'i eemaldamist staged
  extension'ite kataloogist. Kliendi protsess lõpetas exit-koodiga 0.

Toote failide sisu ei muudetud. Katse lähtekood ja toorandmed jäävad auditi
kataloogi. [Analüüs](evidence/shared-store-analysis.json) kontrollib nende
omavahelist kooskõla ja salvestab asjakohase lähtekoodi/ajaloo; see ei asenda
rakenduskatset ega tõenda kogu auditi lõpetamist.
