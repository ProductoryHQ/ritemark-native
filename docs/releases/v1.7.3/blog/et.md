---
title: 'Ritemark 1.7.3: Agendid, mida sa näed'
slug: ritemark-1-7-3-agendid-mida-naed
description: >-
  Ritemark v1.7.3 teeb AI-agendid esmaklassiliseks — sirvi neid agentide kogus,
  seadista visuaalselt ilma YAML-ita, too oma võti kolmanda runtime'iga OpenCode.
  Pluss silmad brauserisse.
date: '2026-06-06'
category: tooted
image: /images/blog/ritemark-1-7-3-agendid.avif
author: jarmo-tuisk
featured: true
lang: et
tags:
  - ritemark
  - release
  - agendid
  - agentide-kogu
  - opencode
  - byok
  - acp
  - brauser
  - tehisintellekt
---

# Agendid, mida sa näed

Ritemark on juba mõnda aega lasknud sul ehitada omaenda AI-agente — väikseid spetsialiseeritud abilisi, igaüks oma juhiste, mudeli ja õigustega. Aga ausalt öeldes olid need agendid nähtamatud. Markdown-failid, mis elasid peidetud `.claude/agents/` kaustas, ja seadistamine tähendas käsitsi YAML-ploki kirjutamist, mille kuju pidid peast teadma.

v1.7.3 on **AI-väljalase**. Selle põhiidee on lihtne: muuta agendid millekski, mida sa näed, korrastad ja mille vahel valid.

## Agentide kogu — kõik AI ühes kohas

Klõpsa roboti-ikoonil vasakus tegevusribas ja avaneb **agentide kogu**. See koondab kogu su töötsooni AI-poole kokkuvolditavatesse sektsioonidesse:

- **Juhised** — `CLAUDE.md` ja `AGENTS.md`. Need ei ole agendid, vaid projektiülesed reeglid, mis laaditakse igasse AI-sessiooni. Majareeglid, mitte meeskonnaliikmed — sellepärast on neil nüüd oma sektsioon.
- **Agendid** — su enda spetsialiseeritud abilised kaustast `.claude/agents/`.
- **Oskused**, **Käsud** ja **Vood** — ülejäänud AI-tööriistad.

Sektsioone saab kokku voltida ja olek jääb meelde — kui töötad ainult agentide ja oskustega, voldi ülejäänu kokku ja kogu jääb selliseks. Lisaks: projekti/kasutaja ulatuse vahekaardid, otsing, sorteerimine, loomine (+) ja täielikud reaaktsioonid (ava, dubleeri, käivita vestlus, muuda ulatust, kustuta).

## Agendi konfiguraator — ilma YAML-ita

Ava ükskõik milline agendifail ja Ritemark lülitub agendi muutmise režiimi: dokumendiala näitab agendi juhiseid, parem paan avab **agendi konfiguraatori**.

See on ehitatud **päris Claude Code'i agendiformaadile** — see, mida sa seadistad, on täpselt see, mida AI-runtime loeb. Ükski väli ei ole kosmeetiline.

- **Kirjeldus** *(kohustuslik)* — kõige tähtsam väli. See ütleb AI-le, **millal sellele agendile tööd delegeerida**. Kirjuta see nagu töökuulutus. Kui kirjeldus on tühi, ei kutsuta agenti kunagi automaatselt — konfiguraator hoiatab sind selle eest.
- **Mudel** — Päri / Sonnet / Opus / Haiku / kohandatud mudeli ID.
- **Tööriistad** kui lubade-loend õige loogikaga: mitte midagi märgitud = agent pärib kõik tööriistad; mõni märgitud = agent saab ainult need (vähima privileegi põhimõte). Märkimata tööriista lihtsalt ei eksisteeri selle agendi jaoks.
- **Oskused** ette laadimiseks ja **Lisavalikud** (pingutus, mälu, värv).

Iga muudatus kirjutatakse otse agendi faili — eraldi salvestusnuppu pole. Kuna agendid on tavalised failid, näeb iga muudatust git-diffis ja saab tagasi võtta nagu mis tahes muu muudatuse.

## Kolmas runtime: OpenCode, oma võtmega

Ritemark pakib nüüd kaasa **OpenCode'i** kolmanda vestlus-runtime'ina Claude Code'i ja Codexi kõrval, integreerituna **Agent Client Protocoli (ACP)** kaudu. Kui Claude Code ja Codex kasutavad oma sisselogimist, siis OpenCode töötab **oma võtmega**: suuna see ükskõik millise pakkuja peale, mille võti sul juba on, ja vali selle pakkuja mudelid.

- **Mudelivalija** näitab **OpenCode'i** gruppi (Codexi järel). Nähtavale ilmuvad ainult need pakkujad, mille võti on seadistatud — lisa Google AI võti ja Gemini mudelid ilmuvad, lisa OpenAI ja saad GPT-mudelid. Ilma võtmeta suunab grupp sind seadeid avama. Uus **OpenRouteri** API-võtme väli liitub seadetes OpenAI / Google AI / Anthropicuga.
- **Voogedastus ja arutlus** — vastused voogedastatakse, arutlus võetakse kokku mõne "Mõtleb" kirjena (mitte sadade ühe-sõnaliste tegevustena) ja tööriistakutsed ilmuvad tegevustena.
- **Failimuudatuse kinnitamine** — kui OpenCode tahab avatud faili muuta, saad ühe **failimuudatuse kinnitamise** kaardi sihttee'ga. Fail kettal jääb puutumata, kuni klõpsad Kinnita. Töötsoonist välja jäävad kirjutamised lükatakse automaatselt tagasi. Kui tahad, et see jookseks vabakäeliselt, on seadetes → OpenCode lüliti **Kinnita muudatused ja tööriistakutsed automaatselt** (töötsoonist väljapoole kirjutamine jääb ka siis blokeerituks).

Kaasapakitud OpenCode'i binaar on uuesti allkirjastatud Ritemarki Developer ID-ga, nii et see käivitub macOS-il puhtalt, ilma Gatekeeperi hoiatusteta.

## Brauser, mida agent saab uuesti vaadata

AI-agentidel, kes töötavad integreeritud brauseriga, oli varem ainult üks viis lehte "vaadata" — navigeerida sinna. Pärast klõpsamist või vormi täitmist lehe uuesti kontrollimine tähendas uuesti navigeerimist (ja lehe oleku kaotamist).

Uus **`browser_snapshot`** tööriist tagastab aktiivse brauseri vahekaardi praeguse ARIA-ülevaate (URL, pealkiri ja täielik ligipääsetavuspuu) — **ilma navigeerimata**. See on saadaval nii Claude Code'ile kui ka Codexile, **ainult lugemiseks ja nõusolekuteadlik**: tööriist töötab ainult vahekaartidel, mille oled Ritemark AI-ga jaganud. Jagamata vahekaart tagastab vea — ei leki ei URL, pealkiri ega lehe sisu.

Ja kui annotatsioonirežiim on sees (kaameranupp brauseri tööriistaribal), näitab komposer nüüd **päris ekraanipildi pisipilti** eksitava URL-kiipi asemel. Pisipilt näitab täpselt seda ekraanipilti, mille AI saab, ja värskendub, kui kerid lehte.

## Väiksemad asjad, mis päeva siledamaks teevad

- **Komposer ei lukustu enam agendi jooksu ajal.** Trüki järgmine mõte, kui Claude Code või Codex veel töötab, ja vajuta Enter — see pargitakse sisendi kohale "Järjekorras" sälku ja saadetakse automaatselt, kui jooks lõpeb. Korraga üks järjekorras prompt; loobu ×-ga.
- **Plaani kinnitamine kinnitab nüüd päriselt.** Varem renderdusid Kinnita/Lükka tagasi nupud *pärast* seda, kui kinnitusaken oli juba sulgunud — klõps ei teinud vaikselt midagi. Nüüd ilmub kaart ainult siis, kui agent on tõesti blokeeritud, näitab usaldusväärselt **kogu plaani teksti** ja Kinnita on selge indigo-värvi peategevus.
- **Lingi muutmise dialoog saab muuta lingi teksti.** Uus valikuline väli "Kuvatav tekst" eeltäidetakse praegusest valikust või olemasoleva lingi tekstist, nii et lingi ümbernimetamine on üks samm.
- **Lühikesed koodiplokid ei näita enam fantoom-kerimisriba.** Põhjuseks oli kopeerimisnupu vihje, mis voolas konteinerist üle — see on parandatud.

## Kellele see on

**Agentide ehitajatele:** kirjuta agendi kirjeldus ja juhised nagu töökuulutus, lukusta tema tööriistad vähima privileegi põhimõttel — ja näe kohe kogus, mis sul olemas on.

**Neile, kes toovad oma võtme:** OpenCode avab Ritemarki vestluse ükskõik millisele pakkujale, mille võti sul juba on — Gemini, GPT, Anthropic, OpenRouteri kaudu veel rohkem.

**Kõigile, kes lasevad agentidel päriselt tööd teha:** failimuudatuse kinnitamine, järjekorda pandud promptid ja töötav plaani-kinnitamine teevad pika jooksu jälgimise rahulikumaks.

## Allalaadimine

| Platvorm | Link |
|----------|------|
| macOS Apple Silicon | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe) |

Automaatne uuendus pakub v1.7.3 olemasolevatele kasutajatele järgmisel käivitamisel. Seaded, dokumendid ja vestlusajalugu säilivad.
