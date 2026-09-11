# Ritemark 1.10.1 — Windowsi testimise juhend

Uuendatud 2026-09-11 v1.10.1 candidate 3 jaoks. See fail on iseseisev: kopeeri see Windowsi arvutisse ja ava tekstiredaktoris. Repositooriumi, Node.js-i ega arendustööriistu pole Windowsis vaja.

Eesmärk: koguda avaldatud installeri Defenderi, Smart App Controli, allkirja, paigaldamise, kasutamise ja eemaldamise tõendid. Selle juhendi täitmine ei esita rakendust Microsoft Store'i. Store'ist paigaldamise test tuleb hiljem eraldi.

## 1. Vali testmasin ja kasutaja

Kasuta uuendatud Windows 11 x64 testmasinat, eelistatult puhast installi või eraldi virtuaalmasinat. Praegune installer on x64; ARM-masina emulatsioonitest ei asenda seda testi.

- Ära kasuta masinat, kus Ritemarkiga tehakse parasjagu päris tööd: juhend sisaldab eemaldamist.
- Virtuaalmasinas tee enne alustamist snapshot.
- Vaja on internetti ning tavalist Windowsi kasutajakontot (Standard user). Administraator võib aidata Windowsi uuenduste ja turvalogide eksportimisega, kuid installimise ja eemaldamise katsed tee tavakasutajana.
- Settings → Accounts → Other users alt saab administraator luua eraldi testkasutaja ja määrata konto tüübiks Standard User. Logi seejärel selle kasutajaga sisse.
- Settings → Apps → Installed apps: kontrolli, et Ritemarki pole juba paigaldatud. Kui on, vali teine puhas testkasutaja/masin; ära eemalda oma tööversiooni kogemata.

## 2. Uuenda Windows ja kontrolli turbekaitset

1. Settings → Windows Update → Check for updates. Paigalda uuendused ja taaskäivita, kui küsitakse.
2. Start → Windows Security → Virus & threat protection.
3. Virus & threat protection updates / Protection updates → Check for updates.
4. Manage settings: Real-time protection peab olema On. Ära lisa Ritemarki välistuste hulka.
5. Windows Security → App & browser control → Smart App Control settings.
6. Testiks peab Smart App Control olema **On**. Tee sellest ekraanipilt.

**Evaluation ei ole On.** Kui On pole sinu Windowsi versioonis valitav, märgi SAC-test BLOCKED ja kasuta teist sobivat testmasinat. Windowsi versiooniti erineb sisselülitamise võimalus; ära muuda selle testi jaoks registrit, BitLockerit ega turvapoliitikaid ja ära lähtesta oma tööarvutit.

Kui Defenderit asendab teine viirusetõrje, märgi see üles. Defenderi testi jaoks kasuta masinat, kus Defender on aktiivne; ära eemalda tööarvuti turvatarkvara.

## 3. Loo tõendikaust ja ava PowerShell

Start → kirjuta **Windows PowerShell** → ava tavaliselt. Ära vali Run as administrator.

Kopeeri järgmised plokid ükshaaval PowerShelli ja vajuta Enter. Ära kopeeri Markdowni kolmekordseid tagurpidi ülakomasid. Hoia sama PowerShelli aken kogu testi vältel avatuna: hilisemad käsud kasutavad siin määratud muutujaid.

```powershell
$ErrorActionPreference = 'Stop'
$testDir = Join-Path ([Environment]::GetFolderPath('Desktop')) ('Ritemark-1.10.1-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $testDir | Out-Null
$testStart = Get-Date
Start-Transcript -Path (Join-Path $testDir 'powershell-transcript.txt')
Get-Date -Format o
whoami
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture | Format-List
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
"Elevated administrator: " + $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Get-MpComputerStatus | Select-Object AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, AntivirusSignatureVersion, AntivirusSignatureLastUpdated | Format-List
explorer.exe $testDir
```

Oodatud: Windows 11, 64-bit; `Elevated administrator: False`; Defenderi kaitseväljad True ja värske uuenduse aeg. False kinnitab, et aken pole kõrgendatud õigustes; konto Standard User staatust kontrolli lisaks Settingsis.

Ekraanipilt: Win+Shift+S, vali ala, ava teavitus ja salvesta avanenud tõendikausta. Salvesta `01-windows-version.png` (käivita Start → `winver`) ja `02-sac-on.png`.

## 4. Laadi installer Edge'iga alla

Ava Edge'is täpselt see URL:

https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe

Salvesta fail Downloads-kausta nimega `Ritemark-Setup.exe`. Ära käivita seda veel. Kui samanimeline fail on juba olemas, kontrolli uut failinime ja kasuta järgmises käsus tegelikku nime.

Kui Edge näitab hoiatust või blokeerib faili, tee ekraanipilt `03-download-warning.png`, kirjuta hoiatus täpselt üles ja peata tavakasutaja allalaadimise test. Ära vajuta hoiatuse vältimiseks Keep anyway, Run anyway ega lülita kaitseid välja. Hoiatuse põhjus tuleb eraldi uurida.

PowerShellis (vaikimisi Downloads-asukoha korral):

```powershell
$installer = Join-Path $env:USERPROFILE 'Downloads\Ritemark-Setup.exe'
if (-not (Test-Path -LiteralPath $installer)) { throw 'Faili ei leitud. Määra $installer väärtuseks Edge allalaaditud faili tegelik täistee.' }
$expectedHash = '93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250'
$actualHash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
$actualSize = (Get-Item -LiteralPath $installer).Length
[pscustomobject]@{ File=$installer; Bytes=$actualSize; SHA256=$actualHash } | Format-List
if ($actualHash -ne $expectedHash -or $actualSize -ne 436614200) { throw 'STOP: faili SHA-256 või suurus ei ühti kinnitatud installeriga.' }
'PASS: approved installer hash and size match'
```

Oodatud: **436614200 baiti**, täpselt sama SHA-256 ja PASS. Erinevuse korral ära faili käivita.

## 5. Kontrolli digitaalallkirja

```powershell
$signature = Get-AuthenticodeSignature -LiteralPath $installer
$signature | Select-Object Status, StatusMessage, Path | Format-List
$signature.SignerCertificate | Select-Object Subject, Issuer, Thumbprint, NotBefore, NotAfter | Format-List
$signature.TimeStamperCertificate | Select-Object Subject, Issuer, Thumbprint | Format-List
if ($signature.Status -ne 'Valid') { throw 'STOP: installeri allkiri pole Valid.' }
```

Seejärel File Exploreris installer → paremklõps → Properties → Digital Signatures → vali allkiri → Details.

- Oodatud: allkiri on kehtiv ja allkirjastaja on **Productory Services OÜ**.
- Salvesta `04-installer-signature.png`, kus nimi ja kehtivus on nähtavad.
- Salvesta ka ajatempli info, kui see on dialoogis nähtav. Kui PowerShelli TimeStamperCertificate väljund on tühi, märgi ajatempli kontroll REVIEW; ära järelda üksnes kehtivast allkirjast, et ajatempel on kontrollitud.
- Vale allkirjastaja või vigase allkirja korral peatu.

## 6. Skanni installer Defenderiga

1. Windows Security → Virus & threat protection → Scan options.
2. Vali Custom scan → Scan now.
3. Vali kaust, kuhu installer alla laaditi (tavaliselt Downloads).
4. Oota, kuni skannimine lõpeb.
5. Salvesta tulemusest `05-defender-scan-result.png`: nähtav peab olema lõpetatud skannimine ja leitud ohtude arv.
6. Ava Protection history ja salvesta `06-protection-history-before-install.png`.

Oodatud: skannimine lõpetatud ja installeriga seotud ohte pole. Ka kogu Downloads-kausta skannimisel leitud muu oht tuleb eraldi tuvastada; ära omista seda automaatselt Ritemarkile. Ritemarki tuvastus või karantiini viimine tähendab FAIL: salvesta ohu nimi, failitee ja kellaaeg ning peatu. Ära vali Allow on device.

## 7. Tee vaikne install tavakasutajana

Sama tavalise PowerShelli akna sees:

```powershell
$installLog = Join-Path $testDir 'install.log'
$installArgs = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER /LOG="' + $installLog + '"'
$installProcess = Start-Process -FilePath $installer -ArgumentList $installArgs -Wait -PassThru
"Installer exit code: $($installProcess.ExitCode)"
if ($installProcess.ExitCode -ne 0) { throw 'STOP: installi veakood pole 0. Säilita install.log.' }
```

Oodatud: veakood 0, installiviisardit pole, administraatori parooli pole vaja. Kui ilmub UAC, turvahoiatus või muu dialoog, pildista ja märgi tulemus REVIEW/FAIL; ära kinnita kõrgendamist, et tõestada tavakasutaja installi.

## 8. Kontrolli paigaldust ja tee ekraanipildid

1. Start → otsi Ritemark. Käivita rakendus.
2. Settings → Apps → Installed apps → otsi Ritemark.
3. Kontrolli ühte rakenduse registreeringut, versiooni 1.10.1 ja avaldajat Productory Services OÜ, kui need väljad on kuvatud.
4. Salvesta `07-installed-apps.png` ja `08-start-menu.png`. Eraldi uninstall-otsetee ei ole teine rakenduse registreering; märgi nähtavad otseteed üles.

Leia installitee registreeringust:

```powershell
$uninstallRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$appEntries = @(Get-ItemProperty "$uninstallRoot\*" | Where-Object { $_.DisplayName -like '*Ritemark*' })
$appEntries | Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation, UninstallString | Format-List
if ($appEntries.Count -ne 1) { throw 'STOP: oodati ühte Ritemarki HKCU registreeringut. Salvesta väljund.' }
$appDir = $appEntries[0].InstallLocation
if ([string]::IsNullOrWhiteSpace($appDir) -or -not (Test-Path -LiteralPath $appDir)) { throw 'Installitee puudub. Ära arva teed: salvesta väljund ja küsi abi.' }
```

## 9. Proovi rakenduse kasutamist SAC On olekus

Tee tõendikausta oma testdokument; ära kasuta päris kliendiandmeid.

1. Loo Ritemarkis uus Markdowni dokument.
2. Kirjuta pealkiri, lõik, loend ja täpitähed `õäöü ÕÄÖÜ`.
3. Salvesta tõendikausta nimega `ritemark-test.md`.
4. Sule dokument, ava uuesti ja kontrolli sisu säilimist.
5. Muuda üks lause, salvesta, sule rakendus ning ava sama fail uuesti.
6. Lülita testmasina võrguühendus ajutiselt välja. Kontrolli kohalikku avamist, muutmist ja salvestamist. Võrgupõhised AI-funktsioonid võivad anda arusaadava ühendusvea; rakendus ei tohi kokku joosta. Taasta internet.
7. Proovi Windowsis nähtavaid AI/agentide funktsioone, mille kasutamiseks on sul testkonto ja ligipääs. Anna näiteks ülesanne teha testdokumendist lühikokkuvõte. Märgi iga kasutatud agendi nimi ja tulemus. Puuduva konto korral kirjuta NOT TESTED, mitte PASS.
8. Proovi nähtavaid faili avamise, salvestamise ja ekspordi funktsioone, mida soovid selle kandidaadi tõendites katta. Märgi täpselt, mida testisid; ära väida kogu rakenduse katvust ühe dokumenditesti põhjal.
9. Ava uuesti Smart App Control settings ja kinnita, et olek on endiselt On.

Salvesta `09-editor-document.png`, `10-agent-result.png` (kui testitud) ja `11-sac-on-after-use.png`. Store'i võimalikeks ekraanipiltideks salvesta lisaks puhtad rakendusepildid ilma isikuandmete, tokenite, testivigade või töölaua muu sisuta; lõplik valik tehakse hiljem.

Iga turvablokeering, käivitumata abiprotsess või krahh: pildista veateade, kirjuta toiming ja kellaaeg ning märgi FAIL. Ära lülita kaitset välja.

## 10. Eemalda rakendus vaikselt

Sulge Ritemark täielikult. Järgmine käsk eemaldab just testitud paigalduse; dokumentide tõendikaust jääb alles.

```powershell
$uninstaller = Join-Path $appDir 'unins000.exe'
if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Uninstallerit ei leitud. Ära käivita arvatud teed; kontrolli registreeringut.' }
$uninstallLog = Join-Path $testDir 'uninstall.log'
$uninstallArgs = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="' + $uninstallLog + '"'
$uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList $uninstallArgs -Wait -PassThru
"Uninstaller exit code: $($uninstallProcess.ExitCode)"
Start-Sleep -Seconds 5
"Install directory still exists: $(Test-Path -LiteralPath $appDir)"
$remainingEntries = @(Get-ItemProperty "$uninstallRoot\*" | Where-Object { $_.DisplayName -like '*Ritemark*' })
"Remaining Ritemark registrations: $($remainingEntries.Count)"
$remainingEntries | Select-Object DisplayName, InstallLocation | Format-List
```

Oodatud: veakood 0, installikausta enam pole, registreeringuid 0. Värskenda Installed apps vaadet ja kontrolli Start-menüüd: rakenduse kirje ja selle Start-menüü grupp peavad kaduma. Salvesta `12-after-uninstall.png`.

Kui midagi jääb alles, kirjuta täpne tee ja salvesta pilt. Ära kustuta jääke enne nende uurimist. Kasutaja dokumendid peavad säilima; AppData kasutajaseadistuste säilimine märgi eraldi, see ei ole automaatselt paigaldusfailide koristusviga.

## 11. Salvesta turvalogid

1. Windows Security → Virus & threat protection → Protection history. Salvesta `13-protection-history-after-test.png` ja märgi Ritemarkiga seotud sündmused.
2. Start → Event Viewer.
3. Applications and Services Logs → Microsoft → Windows → CodeIntegrity → Operational.
4. Paremklõps Operational → Save All Events As → salvesta tõendikausta `CodeIntegrity-Operational.evtx`. Kui küsitakse kuvamisteavet, lisa ingliskeelne teave, kui saadaval.
5. Sama puu all Windows Defender → Operational → Save All Events As → `Windows-Defender-Operational.evtx`.
6. Kui logide lugemine nõuab administraatorit, lase administraatoril need eksportida testkasutaja tõendikausta. Ära korda installi administraatorina.

CodeIntegrity sündmus **3077** tähistab enforcement-blokeeringut; **3076** audit-režiimi tulemust. Vaata testimise ajavahemikku ja sündmuses nimetatud faili. Kõik masina vanad sündmused ei kuulu Ritemarkile. Tühi logi üksi ei tõesta edukat testi: vajalikud on ka SAC On olek ja tegelikult läbitud toimingud.

Logid võivad sisaldada kasutajanimesid ja kohalikke failiteid. Jaga neid privaatselt; ära pane toorloge avalikku reposse enne ülevaatust.

## 12. Kirjuta tulemus ja paki tõendid

Loo Notepadiga tõendikausta `RESULTS.txt` ja täida järgmine mall:

```text
Testija:
Kuupäev ja ajavöönd:
Windowsi versioon / build / arhitektuur:
Füüsiline masin või VM; puhas testkeskkond?:
Konto tüüp: Standard user / muu
URL: https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe
SHA-256: 93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250
Faili suurus: 436614200

Iga rea tulemus: PASS / FAIL / BLOCKED / NOT TESTED / REVIEW
Allalaadimine ilma hoiatuseta:
SHA-256 ja suurus:
Allkiri Valid ja avaldaja Productory Services OÜ:
Ajatempel:
Defenderi versioon ja kirjelduste kuupäev:
Defenderi lõpetatud skannimine / ohud:
SAC On enne ja pärast testi:
Vaikne tavakasutaja install / exit code:
Üks Apps registreering / Start-menüü:
Rakenduse käivitamine:
Markdowni loomine, muutmine, salvestamine, taasavamine:
Võrguühenduseta kohalik töö:
Testitud agendid ja funktsioonid (igaüks eraldi):
Testimata funktsioonid ja põhjus:
Vaikne eemaldamine / exit code:
Installikausta, Start-menüü ja registreeringu koristus:
Säilinud kasutajadokumendid / AppData:
Ritemarkiga seotud Defenderi või CodeIntegrity sündmused:
Hoiatused, krahhid, täpsed kellaajad ja failiteed:
Üldtulemus ja lahtised küsimused:
```

Lõpeta PowerShelli logi ja loo jagatav ZIP:

```powershell
Get-Date -Format o
Stop-Transcript
$evidenceZip = "$testDir.zip"
Compress-Archive -LiteralPath $testDir -DestinationPath $evidenceZip
explorer.exe /select,$evidenceZip
```

Saada ZIP privaatselt tagasi. Installerit ei ole vaja ZIP-i lisada. Säilita tõendid kuni ülevaatuseni. Pärast kinnitust võid kustutada oma allalaaditud testinstalleri ja üleliigsed kohalikud tõendikoopiad; avaldatud R2 objekti ei muudeta.

## 13. Hilisem Store'ist paigaldamise test

Seda saab teha alles siis, kui Microsofti kaudu on päris pakett kättesaadav. Praegune otse-URL-i test ei tõesta Store'ist paigaldamist.

1. Kasuta puhast testkeskkonda ja salvesta Windowsi ning SAC olek.
2. Ava Ritemarki kinnitatud Microsoft Store'i tooteleht, salvesta selle URL ja tootetunnus.
3. Vajuta Store'is Install. Salvesta tulemus ja paigaldatud versioon.
4. Korda selle juhendi dokumendi-, agentide-, turvalogide- ja eemaldamiskontrolle; eemalda seekord Settings → Apps kaudu.
5. Salvesta eraldi tõendikomplekt märkega Store-origin. Märgi vead ja blokeeringud; testi edukust ei saa ette kinnitada.

## Viited

- Ritemarki kandidaadi identiteet: `release-candidates/v1.10.1-candidate-3.md`.
- Ritemarki nõuded: `PACKAGE-AND-CERTIFICATION.md`.
- Microsoft: [Smart App Control testimine ja sündmused](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control).
- Microsoft: [Smart App Control KKK](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).
- Microsoft: [EXE/MSI sertifitseerimise protsess](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-certification-process).

See juhend ei kinnita testide läbimist: tulemused täidetakse Windowsis päriselt tehtud katsete põhjal.
