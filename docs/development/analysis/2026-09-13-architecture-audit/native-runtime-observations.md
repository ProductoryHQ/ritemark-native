# Native runtime'i algatus, katkestus ja taaskäivitamine

2026-09-13 · aluscommit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`.

Katsed käivitasid selle worktree päris adapteriklassid ja varem kontrollitud
darwin-arm64 binaarid. VS Code'i konfiguratsiooni ja laienduse asukoha andis
rakis; child environment ja runtime'i salvestuskataloogid olid ajutised.
JSON-RPC/ACP transporti, tähtaegu ja algatuse loogikat ei asendatud.
Need on native-komponendikatsed väljaspool Electroni kasutajaliidest.

Mudelivooru, sisselogimist ja agendi failitööriista ei käivitatud. Seetõttu
annavad katsed tõendi protsessi/ühenduse elutsükli kohta, mitte kogu agenditöö
katkestamise, kooskõlastuste või pooleldi kirjutatud dokumendi garantii kohta.

## Codex: ühine algatus ja ühenduse taastamine toimisid

Päris `CodexAppServer` ning `CodexManager` laadisid binaari 0.153.0,
SHA-256 `2c965118276888af7b3ca525ad41d800d24ca3d00ffcdb6874cc948100718570`.
Kolm samaaegset `ensureInitialized()` kutset andsid ühe protsessi ja ühe
`initialize` päringu. Tühja isoleeritud profiili `thread/list` tagastas null
vestlust; kasutaja vestlusi ei loetud.

Sama omatud protsess peatati SIGSTOP-iga. Tegelikku RPC-meetodit kutsuti
300 ms tähtajaga; see aegus 302 ms juures ning pending-kaart tühjenes. Pärast
SIGCONT-i õnnestus uus lugemine; hilinenud vastus ei läinud uue päringuga segi.
300 ms on rakise valitud parameeter olemasolevale meetodile, mitte toote
vaikimisi 30-sekundilise tähtaja muutmine ega käivitusjõudluse mõõtmine.

Järgmise ootel lugemise ajal lõpetati protsess SIGKILL-iga. Päring sai vea
`Codex app-server exited unexpectedly`, ootel päringud tühjenesid ja algatuse
promise lähtestus. Alles kinnitatud lõppemise järel alustati uut protsessi;
sama klient suutis uuesti algatada ja lugeda. Tavalise dispose'i järel
kinnitati uue protsessi lõppemine 22 ms vaatlusaknas.

[Tõend ja täpne jada](evidence/native-codex-lifecycle-probe.json),
[käivitatav rakis](evidence/native-codex-lifecycle-probe.cjs).
Need tulemused on säilitatavad tugevused ühise runtime'i elutsükli kujundamisel.

## ACP/OpenCode: külma algatuse võidujooks

Päris `AcpManager`, `AcpClient`, lukustatud ACP SDK ja OpenCode 1.18.21
(SHA-256 `6326ccd2a62d2a423de865ba5a69e105c48d3d363d88195faab939cd7fa3c186`)
said kaks samaaegset `start()` kutset. Esimene lõi sessiooni; teine sai
`ACP client is not initialized`. Protsesse oli üks ja manager'is üks sessioon.
Järgnev tavaline `start()` õnnestus samas protsessis: kaks eri ID-ga sessiooni.

Põhjus on Ritemarki adapteris: `ensureClient()` avaldab `this.client` enne
`await client.initialize()` lõppemist; teine kutsuja saab selle objekti kohe.
`AcpClient.initialize()` ootab enne ühenduse loomist SDK importi. Seega
objekti olemasolu ei ole ühenduse valmisoleku tingimus. Vastav **A15** ei
väida, et OpenCode ei toeta mitut sessiooni või et kaks GUI-vestlust on selles
katses tegelikult korraga käivitatud. Soe kontroll näitab vastupidist esimesele
väitele; UI kaudu esinemissagedus jääb eraldi kontrolliks.

Ka ACP-l lõpetas native protsessi SIGKILL ootel uue sessiooni päringu veaga
`ACP connection closed`, eemaldas manager'i sessioonid ja võimaldas pärast
kinnitatud lõppemist uue protsessiga jätkata. Tavaline dispose lõpetas uue
protsessi 22 ms vaatlusaknas. Aktiivset mudelivooru ega selle tulemuse UI-routing'ut
ei katsetatud, seega ei saa siit järeldada kõikide töötavate vestluste korrektset
veateavitust.

[Tõend](evidence/native-acp-lifecycle-probe.json),
[käivitatav rakis](evidence/native-acp-lifecycle-probe.cjs).
Esimene piiratud keskkonna jooks lõppes native `ServeError` veaga ja on
[eraldi säilitatud](evidence/native-acp-lifecycle-sandbox.json). Selle protsessi
lõppemine kontrolliti enne lubatud kordust väljaspool piiratud keskkonda.
Kordus läbis jada; esimese jooksu serveriviga ei esitata toote regressioonina.
Täpset OS-i veakoodi algne stderr ei andnud.

## Piirid ja puhastus

Mõlemad rakised kinnitasid kõigi enda otseselt käivitatud child-protsesside
lõppemise. Kasutaja muid protsesse ei otsitud lõpetamiseks ega puudutatud.
Need katsed ei mõõda mudelitöö ajal tekkivate kõikide järeltulijate sulgemist;
Codexi code-mode host, Claude'i native tööriistad, ACP failiproxy päris agendi
kutsel ja Windowsi signaali/protsessikäitumine jäävad katvusregistris avatuks.
