# Agendi sisu ja kasutajaliidese usalduspiiri rakenduskatse

Alus: `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`, macOS arm64, 2026-09-13.
See täpsustab leidu A08. Kinnitatud on CSS-i mõju päris AI webview juhtnuppudele;
skripti käivitamist ega hosti kooskõlastusest möödumist ei ole tõendatud.

## Keskkond ja katse sisenemiskoht

Taaskasutati vormingukatsete isoleeritud tavarežiimi profiili ning füüsiliselt
eraldi staged extension'it. Uus app PID oli 4404 ja extension host PID 4637;
CDP port 9239. Aktiivse laienduse tee ning `package.json`, `out/extension.js` ja
`media/webview.js` SHA-256 vastasid varasema auditi muutmata artefaktidele.
Laiendus töötas production-režiimis, ilma `extensionDevelopmentPath` argumendita.
Installitud ühilduv shell ei ole selles auditis ehitatud uus release kandidaat.

CDP kaudu saadeti AI webview olemasolevale MessageEvent-kuulajale sünteetiline
`conversation/get` tulemus ja `agent-approval-request`. Kasutati toote enda
projektsiooni, React renderdajaid, kooskõlastuskaarti ja CSP-d. Sõnum kujutas
üht lõpetatud vastust ja järgnevat kooskõlastust ootavat vooru. Native vooru,
mudelipäringut ega tegelikku käsu täitmise päringut ei loodud; nuppe ei vajutatud.
See kontrollib renderduse lepingut. See **ei tõenda**, et väline sisu saab
võltsida hosti MessageEvent-sõnumeid või käivitada agendi sessiooni.

Varasem vormingukäivituse kirjeldus säilis failis
[formats-session-before-security.json](evidence/formats-session-before-security.json).
Uus käivitus lisandus [seansiregistrisse](evidence/formats-session.json).

## Vaatlused ja kontrollid

| Katse | Päris webview tulemus | Tähendus |
| --- | --- | --- |
| Kasutaja sõnumis raw `<style>` | Markup oli nähtav tekstina; style-elementi DOM-is ei tekkinud | Kasutaja tekstimulli escaping toimis selles kontrollis |
| Tavaline Markdown | Pealkiri, rõhutatud tekst, inline code ja tabel renderdusid | Lihtne rich-text kontroll toimis |
| Assistendi sõnumis raw `<style>` | Style-element asus `.rendered-markdown` sees; väljaspool seda asuvad Approve/Reject said magenta kontuuri ning Message textarea kollase tausta | Assistendi sisu CSS ei ole piiratud oma tekstimulliga |
| Assistendi HTTPS-pilt | CDP nägi Image-päringut; lokaalselt vastatud PNG laadis 1 × 1 pikslina | Kehtiv CSP lubas selle HTTPS-pildi; päris võrguühendust ei katsetatud |
| Pildi `onload` ja vigase data-pildi `onerror` | Mõlemad kontrollmuutujad jäid false; kaks `script-src-attr` rikkumist olid `enforce` olekus | CSP tõepoolest blokeeris need inline-käsitlejad |
| Algse assistenditeksti taastamine | Style-element kadus, sisestusvälja taust ja mõlema nupu kontuur taastusid | Mõju oli seotud sõnumi sisuga ja selles proovis tagasipööratav |

HTTPS-aadress oli ainult `https://audit.invalid/pixel.png?fixture=A08`.
Fetch-interception aktiveeriti enne sisu lisamist ja vastus anti request-etapis
kohalike PNG-baitidega. See ei ole DNS/TLS edukuse, tegeliku andmeedastuse ega
kasutajaandmete väljaviimise tõend. CSP pildiluba ja skriptikeeld on eri piirid.
`innerHTML` kaudu lisatud script-tag'i tegevusetust ei kasutatud CSP tõendina.

Workbench'i eraldi DOM-is audit-style-elementi ei olnud; vaadeldud body-stiil
ei muutunud. AI webview sees tõendatud CSS-i mõju ei üldistata teistele
dokumendivaadetele ega native shellile. Nuppude välimuse mõjutamine võib aidata
eksitava UI loomist, kuid selle katsega ei näidatud kasutaja eksitamist ega
UnifiedApprovalGate'i või native runtime'i õiguskontrollist möödumist.

## Arhitektuuriline tähendus

Hosti runtime-callback'id saadavad assistenditeksti ja deltasid UI-sse ning
kanooniline projektsioon taastab vastuse tekstina. Ühine `RenderedMarkdown`
kasutab `marked.parse` väljundit otse `dangerouslySetInnerHTML` sisendina.
Sama komponent teenindab Claude vastuseid, Codex/OpenCode tekstimulle ja
plaanide esitust. Tegelik rakenduskatse kasutas Codexi projektsiooni; teisi
runtime'e ei käivitatud ning nende katsetamist ei väideta.

Usaldatud tegevusnupud ja madalama usaldusega vastuse sisu jagavad sama DOM-i
ning CSS-i ulatust. Nonce CSP kaitseb üht tegevusklassi, kuid ei asenda HTML-i
ja URL-ide lubatud loendit. Turvapiir peab asuma ühises renderdamistees, et
runtime'i vahetamine või vana vestluse taastamine ei muudaks reeglit.
Kohandatud klassinimi üksi ei isoleeri sisusse lisatud style-elemendi CSS-i.

Paranduse vastuvõtukatse peab kontrollima nii saabuvat kui taastatud sisu:
lubamatu HTML/CSS ei mõjuta sõnumist väljaspool olevaid juhte; HTTPS-piltide
võrgupoliitika on teadlikult valitud; Markdowni tabelid, kood ja plaanid töötavad;
nonce-põhine skriptikaitse säilib. See audit ei muuda tootmiskoodi.

## Tõendid ja lõpetamine

- [Katseprogramm](evidence/formats-security-probe.mjs) ja
  [toorvaatlused](evidence/formats-security-probe.json) sisaldavad täpset payload'i,
  transporti, tegelikku CSP-d, DOM-i computed style'e, võrgu intercept'i ning
  negatiivseid kontrolle.
- [Algne vaade](evidence/formats-security-baseline.png) ja
  [muudetud nupud](evidence/formats-security-styled-controls.png) jäädvustati
  päris app'i CDP kaudu ning kontrolliti visuaalselt. Sisestusvälja taust on
  tõendatud computed style'iga; ekraanipilt ei näita kogu sisestusala.
- [Puhastamise tulemus](evidence/formats-security-cleanup-probe.json) kinnitab
  kõigi 12 enne sulgemist registreeritud auditi protsessi lõppemist ja CDP pordi
  sulgumist. Kliendi terminaliprotsess lõpetas exit-koodiga 0. Sõnumi CSS eemaldati
  juba katse lõpus. Endpoint'ide autentimistokeneid tõenditesse ei kopeeritud.
