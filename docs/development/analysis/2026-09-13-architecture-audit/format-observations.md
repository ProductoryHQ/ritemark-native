# Vormingute nähtav olek, salvestamine ja värskendamine

2026-09-13 · aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.

Katse kasutas sama kontrollitud installitud macOS-i shelli, uut sünteetilist
profiili ja sõltumatut APFS-koopiat auditi laiendusest. Hosti bundle'i, ühise
webview, PDF workeri, draw.io entrypoint'i ja manifesti hashid võrreldi.
[Staging'u register](evidence/formats-session.json) ning
[päris laadimise kontroll](evidence/formats-preflight-probe.json) kinnitavad
tavarežiimi, täpse aktiivse laienduse tee ja alusversiooni. Toote kood ei muutunud.

## Draw.io kaotas välise tegija sõltumatu kujundi

1. Avati diagramm ühe kujundiga `AUDIT BASE`.
2. Väline kirjutaja asendas sünteetilise faili versiooniga, kuhu oli lisatud
   teine kujund `EXTERNAL ACTOR BOX`. VS Code'i TextDocument sisaldas seda
   uut graafimudelit ja oli puhas, avatud lõuend näitas endiselt vana diagrammi.
3. Lõuendi algse kujundi tekst muudeti tavapärase label-editori ja klaviatuuri
   kaudu. Toote 800 ms automaatsalvestus käivitas päris xmlsvg ekspordi ja Save'i.
4. Salvestatud failist puudus välise tegija lisatud kujund. Konfliktivalikut
   ei näidatud, dokumendi sakk oli puhas. Uuesti avamine taastas kohaliku
   kujundi muudetud teksti ja töötava redigeeritava diagrammi.

[Rakenduskatse](evidence/formats-drawio-conflict-probe.json) salvestab algse,
välise ja salvestatud SVG teksti, hosti seisundid ja bridge'i sündmused.
[Graafimudeli järelkontroll](evidence/formats-drawio-model-check.json) dekodeerib
ka tihendatud XML-i: `external-cell` oli välises graafis olemas ja puudus
automaatsalvestuse graafist. Järeldus ei põhine ainult sõna puudumisel base64-st.
[Algvaade](evidence/formats-drawio-base.png) ja
[automaatsalvestuse järgne vaade](evidence/formats-drawio-after-autosave.png)
vaadati visuaalselt üle. Edutee taasavamise kontroll on
[järgneva katse alguses](evidence/formats-preview-probe.json).

**A16 põhjus:** native tekstimudeli kasutamine ei seo automaatselt vendordatud
graafi olekut sama dokumendi muutustega. Provider saadab sisu `drawio:ready`
ajal, kuid ei koordineeri hilisemaid välismuudatusi ega lisa eksporditud
täisasendusele baasi/revisjoni eeltingimust. `applyingSave` kaitseb sama vaate
kattuvaid salvestusi, mitte välise tegija tööd. Korras kohaliku xmlsvg
round-trip'i, eraldi renderdaja ning retry/load-ACK kaitse tuleb säilitada.

## PDF/DOCX eelvaated jäid saabunud muutusteatest hoolimata vanaks

Lukustatud PDFKit/docx teekidega loodi kahe leheküljega väikesed referentsid.
PDF-i esimesel lehel kontrolliti nähtavat teksti, kujundit ja renderdatud canvas't.
DOCX-is kontrolliti mõlema lehe DOM-i, pealkirju, loendit, tabeli kuut väärtust
ning teksti `Eesti õäöü – väärtus 42.`. Visuaalselt vaadati üle
[PDF](evidence/formats-pdf-baseline.png) ja
[DOCX](evidence/formats-docx-baseline.png). See on piiratud referentskatse,
mitte võrdlus Wordi kogu paigutusmootoriga, keerukate fontidega või algvormingusse
tagasi salvestamise garantii. Mõlemad provider'id on readonly.

Väline kirjutaja asendas failid teise markeriga versioonidega. Mõlema webview
vaatluslistener sai päris hostilt `fileChanged` teate; 1,5 sekundit hiljem oli
nähtav endiselt vana marker ning muutuse märget polnud. DOCX-i olemasolev
**Refresh** laadis uue sisu. PDF-i toolbar'is Refresh puudus; tavaline sulgemine
ja taasavamine laadis uue versiooni. Kui katsefail kustutati, saabus mõlemale
`fileDeleted`, kuid vana eelvaade jäi ilma kustutuse märgita alles. Failid
taastati sünteetilisest variandist enne katse lõpetamist.

[Tõend](evidence/formats-preview-probe.json) eristab teate saabumist, nähtavat
teksti, ketta hashe, nuppe ja eksplitsiitse värskendamise tulemust.
**A17** puudutab kuvatava versiooni usaldusväärsust. See katse ei kirjutanud
readonly eelvaadet algfaili tagasi ega tõesta selle kaudu andmekadu.

[Ajaloovaatlus](evidence/formats-history.json) leidis üldise `fileChanged`
haru eemaldamise sünkroniseerimise commit'is `c0343a92`, kuid eelnevad PDF/DOCX
varased return-harud ei saanud samuti üldise päise muutuselippu. Seega ei
omistata eelvaate puudust selle ühe commit'i regressiooniks. Oluline on
praegune leping: provider saadab sündmusi, mida vastav tarbija ei kasuta.

## PDF-i lehekülgede hoidmine ja mõõtmise piir

13 755 baidine, 20-leheküljeline sünteetiline PDF avati ja kõik lehed keriti
läbi. Esimeses proovis oli üks valmis canvas; esimesele lehele naastes jäid
DOM-i kõik 20 canvas't. See vastab `LazyPage` koodile: leht renderdatakse
lähedale jõudes ning juba laaditud lehti hoitakse hiljem alles.

[Mõõtmine](evidence/formats-pdf-pages-probe.json) ja
[ressursi järelanalüüs](evidence/formats-pdf-resource-analysis.json) hoiavad
olulise vastutõendi nähtaval: JS heap vähenes umbes 21,9 MB-lt 19,1 MB-le
ja sama protsessi RSS-vaatlused ei näidanud canvas-te pindalaga võrdelist kasvu.
Mõõtmete põhjal arvutatav RGBA pind on 160 221 600 baiti, **see ei ole mõõdetud
mälueraldus ega unikaalne füüsiline mälu**. Brauser võib pinnad teisiti hoida,
optimeerida või arvestada. Sellest katsest ei saa väita mäluleket ega Windowsi
jõudlusprobleemi suurust.

Arhitektuuriline järeldus A03 juurde: funktsiooni esmane koodilaadimine, esimese
lehe renderdamine ning läbitud lehtede elutsükkel vajavad eri mõõdikuid.
Renderdatud lehtede cache'i eelarve otsus peab põhinema vastaval browser/GPU
ja sihtriistvara mõõtmisel; ühise JS faili suurus üksi seda ei kirjelda.

## Katse lõpetamine ja lahtised piirid

[Puhastus](evidence/formats-cleanup-probe.json) kinnitas testirakenduse ja
vaatluse 12 omatud protsessi lõppemist ning CDP pordi 9239 sulgumist. Juhtklient
lõpetati seejärel (exit 0). Sünteetilised hosti sündmused säilitati; endpointide
autentimistokeneid tõenditesse ei kopeeritud.

Draw.io kahe vaate võidujooks, salvestusvea receipt, keerukad ja suured
DOCX/PDF referentsid, ekspordi infokao kontrollid ning Windowsi jõudlus jäävad
vastavate kontrollidena avatuks. Praegused tulemused täiendavad kogu süsteemi
dokumendi/vaate/ketta lepingut, mitte ei sertifitseeri kõiki failivariatsioone.
