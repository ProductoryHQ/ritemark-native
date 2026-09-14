# Markdowni vaate käivituskulu

Aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`, sama 8 844 955-baidine
tootmis-webview. Katse kinnitab A03 juures tegelikku JavaScripti käivitustööd.
See ei mõõda kogu rakenduse külmkäivitust ega nõrka Windowsi masinat.

## Meetod ja võrreldavus

Tavarežiimis laaditi baiditäpselt sama auditi laiendus isoleeritud profiilist
`/private/tmp/ritemark-audit-normal-bg5jgmun/performance-profile`.
Riistvara: Apple M4 Pro, 14 loogilist CPU-d, 24 GiB mälu; macOS/Darwin 25.5.0,
Electron 39.8.7, Chromium 142.0.7444.265. Fail oli 79-baidine Markdown kahe
tekstiplokiga, ilma diagrammi, tabeli või koodiplokita. See on väikese dokumendi
avamise kontrolljuhtum, mille puhul keeruka sisu renderdus ei peaks tulemust
määrama.

Lõplikus valimis oli kuus uut webview'd järjekorras 1×, 4×, 4×, 1×, 1×, 4×.
Iga vaade suleti ja tema CDP target'i kadumine kinnitati enne järgmist avamist.
CPU-aeglustus rakendati ainult webview rendererile. Shell, extension host,
salvestus, GPU ja native agendid sellest nõrga Windowsi analoogiks ei muutu.

CDP Performance mõõdikud algasid **kõigis kuues katses enne `webview.js`
ressursipäringut**. Toote skripte ei peatatud ega muudetud. CPU profiler ja
precise coverage olid selles protsessis välja lülitatud. Kasutati focus
emulation'it, et macOS-i akna varjamisest tulenev background throttling ei
muudaks valimit. Kontrolliti tegeliku `active-frame`-i `visible` olekut ja
redigeeritava TipTapi täpset sisu; DOM-vaatlusele järgnes kaks animation frame'i.
Avamise aeg lõpeb kasutatava editori DOM-vaatlusega, mille küsitlussamm oli
50 ms. See ei ole mõõdetud klahvivajutuse latentsus.

Rakendus, teenustöötaja ja OS-i failivahemälu olid soojad. Kõik kuus avamist
toimusid värskes rakendusprotsessis PID **30867**, host **31080**, mis käivitati
pärast profileriga kalibreerimisprotsessi kinnitatud sulgemist. Seega pole
lõplik valim profileriga ja profilerita proovide segatud võrdlus.

Tõendid: [lõplik valim](evidence/normal-performance-final-load-probe.json),
[mõõteskript](evidence/normal-performance-final-load-probe.mjs),
[keskkond ja käivitused](evidence/normal-performance-session.json),
[korrelatsioon ja arvutused](evidence/performance-analysis.json).

## Mõõdetud tulemus

Tabelis mediaan ning sulgudes kolme proovi miinimum–maksimum. Need ei ole
kasutajapopulatsiooni protsentiilid.

| Mõõdik | 1× CPU | 4× aeglustus |
| --- | --- | --- |
| Open-käsust kasutatava editori vaatluseni | 469 ms (465–648) | 1523 ms (1513–1535) |
| Renderer `ScriptDuration` | 301 ms (297–327) | 1346 ms (1336–1360) |
| Renderer `TaskDuration` | 312 ms (307–357) | 1388 ms (1386–1393) |
| Pikim vaadeldud main-thread long task | 273 ms (267–287) | 1207 ms (1192–1230) |
| Kohaliku `webview.js` ressursi laadimine | 88 ms (87–96) | 92 ms (91–93) |

Igas vaates raporteeriti sama 8 844 955-baidine decodedBodySize.
TransferSize oli 0; seda ei tõlgendata puuduva laadimiskuluna, sest kohalik
ressurss läbib VS Code'i webview teenustöötaja ja ressursitee.

Selles juhtumis oli JavaScripti osa mõõdetud rendereri task-ajast mediaanina
97% lähedal. CPU aeglustamisega kasvas avamise mediaan 3,25× ja skripti täitmine
4,47×, samal ajal kui ressursi laadimine jäi umbes 90 ms juurde. See toetab
järeldust, et väikese Markdowni faili avamisel on oluline kulu skripti
käivitustööl. See ei eralda kogu rakenduse shelli/hosti/kettatöö osakaalu.

`V8CompileDuration` oli soojas lõppvalimis 0,1–1,2 ms. See on piiratud CDP
main-thread mõõdik; sellest ei järeldu, et külma koodi parsimine või taustal
kompileerimine oleks tasuta. Heap'i snapshot'id sisaldavad GC ja protsessi
taaskasutuse mõju ning neid ei esitata ühe dokumendi mälukuluna ega lekketõendina.

## Milline kood käivitamisel osales

Eraldi kalibreerimisprotsessi PID **98767**, host **98994** kaks lõpetatud
profile/coverage katset on [toorregistris](evidence/normal-performance-profile-load-probe.json).
Mõlema vaate top-level bundle'i täitmine on coverage'is olemas. Raporteeritud
33 194 funktsioonist kutsuti 4415; kõige sisemiste käivitatud coverage-vahemike
osakaal oli umbes **28,1% skripti UTF-16 pikkusest**. Ülejäänud 71,9% ei ole
automaatselt eemaldatav kood: see sisaldab järgmiste tegevuste ja teiste
vormingute võimekusi ning coverage ei mõõda mooduli vajalikkust.

Sample'ites esinesid lisaks editori/ProseMirrori tööle ELK-i Browserify laaduri,
highlight.js keelte registreerimise ja Mermaid parseri initsialiseerimise
funktsioonid. Kitsad seosed kontrolliti genereeritud bundle'i asukoha ning
lukustatud sõltuvuste lähtekoodi ankrutega; need on
[analüüsi `sourceAttribution` ja `topBundleFrames` väljad](evidence/performance-analysis.json).
Diagrammita dokumendi avamine teeb seega ka osa muude võimekuste
initsialiseerimist. See tugevdab tarne- ja käivituspiiri eraldamise vajadust.
See ei tõenda, et kõik rendererid täismahus töötavad, ega anna ELK/Mermaidi
kogu CPU protsenti või eemaldamisega saavutatavat säästu.

Lähtekoodi `getMermaid()` kasutab dünaamilist importi
([mermaid.ts](../../../../extensions/ritemark/webview/src/lib/mermaid.ts), 80–83),
kuid build kasutab üht IIFE-d ja `inlineDynamicImports: true`
([vite.config.ts](../../../../extensions/ritemark/webview/vite.config.ts), 28–35).
Pelgalt JSX/React lazy-piirist ei saa järeldada, et vastava sõltuvuse
initsialiseerimine oleks igas buildis kasutaja esimese kasutuseni edasi lükatud.

Profiler/coverage mõjutab ise kompileerimist ja optimeerimist. Teise
profile-katse salvestus algas pärast skripti ressursipäringut ning selle
kompileerimismõõdik erines oluliselt kergest katsest. Neid aegu ei kasutata
tabeli ega Windowsi prognoosi jaoks. CPU-profiili `program` sample'e ei
omistata tervikuna ühelegi paketile.

## Kalibreerimise ebaõnnestumised ja kontrollid

- [Esimene katse](evidence/normal-performance-load-probe.json) peatas uue
  target'i. Välimine webview jäi ilma siseraamita; editori vaatlus ei saabunud.
  [Host](evidence/normal-performance-after-observation-hosts.json) jäi elusaks
  ja dokument oli puhas. Seda ei nimetata toote käivituse jõudlustulemuseks.
- [Peatamiseta jätk](evidence/normal-performance-observed-load-probe.json)
  ei parandanud kohe teenustöötaja seisundit. Eraldi
  [registratsioonivaatlus](evidence/normal-performance-service-worker-state.json)
  näitas registratsiooni ilma active/installing/waiting worker'ita. Hilisem
  [unregister-kontroll](evidence/normal-performance-inactive-worker-recovery.json)
  tagastas tühja loendi ja ei eemaldanud midagi. Tavaline sulgemine/avamine
  andis seejärel [toimiva editori](evidence/normal-performance-uninstrumented-control.json).
  Rakendust ei taaskäivitatud pelgalt vaatlustähtaja ületamise tõttu.
- [Soe profilerikatse](evidence/normal-performance-warm-load-probe.json)
  lõpetas ühe proovi; järgmises katkestas vaatleja liiga range eeltingimus,
  sest profiler algas pärast fetch'i. Kogu valimit ei loeta lõpetatuks.
- [Järgmise katse](evidence/normal-performance-measured-load-probe.json)
  editori DOM ilmus, kuid kaks animation frame'i jäid vaatlustähtaja sisse
  saabumata. [Diagnostika](evidence/normal-performance-late-diagnostic-probe.json)
  kinnitas `hidden` olekut. Focus emulation'i kasutav kerge kalibreerimisvalim
  ja eraldi profiil lõpetasid; nende järel suleti protsess ning tehti lõplik
  kuue avamise mõõtmine uues protsessis.

Kalibreerimise ja lõppvalimi [esimene](evidence/normal-performance-calibration-cleanup-probe.json)
ning [teine sulgemiskontroll](evidence/normal-performance-cleanup-probe.json)
kinnitasid kummaski 13 auditi protsessi kadumise ja CDP pordi 9243 sulgumise.
Mõõteklient lõpetas koodiga 0. Toote nelja artefakti, vaatleja ning Markdowni
fixture'i SHA-256 jäi samaks. Lõppvalimi 44 hostisündmust sisaldavad kuut
tegelikku failiavamise käsku. Tootekoodi ega kasutaja tööfaile ei muudetud.

## Mõju tervikauditile

A03 on nüüd mõõdetud käivituspiiri probleem. Selle paranduse valimisel tuleb
võrrelda eraldi entrypoint'e ja tegelikku code-splitting'ut, kontrollides ka
sõltuvuste initsialiseerimist. Ainult faili kokkupakkimise või edastusmahu
vähendamine ei pruugi selles juhtumis peamist kulu eemaldada.

Sobiv vastuvõtukatse peab säilitama sama väikese dokumendi kontrolli ning
lisama külma launch-to-input tee, kasutaja sisestuse, formaadi esmakasutuse,
CSP/cache/update kooskõla ja nõrga Windowsi päris riistvara. A02 fookuse omaniku
probleemi see mõõtmine ei lahenda. Andmete säilimise ja jagatud ressursi omandi
parandused jäävad auditi tegevusjärjekorras samuti vajalikuks.
