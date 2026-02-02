# Copywriting: Beta Installation Guide

Web copy for installing Ritemark before Apple notarization completes.

**Status:** Draft - awaiting review  
**Date:** 2026-01-14

* * *

## Context

Ritemark is code-signed with Apple Developer ID but awaiting notarization approval. macOS Gatekeeper will show a warning on first launch. This page guides users through the one-time approval process.

**Goals:**

-   Reassure users the app is safe
    
-   Make the process feel simple, not scary
    
-   Provide clear visual steps
    
-   Offer terminal option for technical users
    

* * *

## 1\. Kuidas alustada tab?

### Estonian (ET)

**Headline:** Ritemark'i paigaldamine

**Subhead:** Ritemark on Apple'i poolt allkirjastatud, kuid ootab veel Apple'i lõplikku heakskiitu. See tähendab, et macOS küsib sinult esmakordsel avamisel kinnitust. Teeme selle lihtsaks.

**Badge:** Beta · Turvaline · Ainult üks kord

### English (EN)

**Headline:** Installing Ritemark Beta

**Subhead:** Ritemark is signed with Apple Developer ID but still awaiting final Apple approval. This means macOS will ask for your confirmation on first launch. Let's make this easy.

**Badge:** Beta · Safe · One-time only

* * *

## 2\. Method A: Visual Guide (Recommended for most users)

### Estonian (ET)

**Section Title:** Variant A: Paigalda läbi seadete

**Intro:** Kõige lihtsam viis. Lihtsalt järgi neid samme:

**Steps:**

1.  **Lae alla ja ava**
    
    Lae Ritemark DMG alla Githubis, ava see ja tõmba sealt Ritemark.app Applications kausta. Topeltkliki rakenduse avamiseks.
    
2.  **macOS blokeerib rakenduse**
    
    Näed teadet: "Ritemarki ei saa avada, kuna Apple ei saa seda kontrollida." See on normaalne – kliki "OK".
    
3.  **Ava System Settings**
    
    Mine **System Settings → Privacy & Security**. Keri alla kuni näed teadet Ritemarki kohta.
    
4.  **Kliki "Open Anyway"**
    
    Kliki nuppu "Open Anyway" ja sisesta oma parool. See on kõik!
    
5.  **Valmis!**
    
    Ritemark avaneb nüüd normaalselt. Seda protsessi tuleb teha ainult üks kord.
    

**Note:** Kui sul on macOS 14 või vanem: tee lihtsalt paremkliki rakendusel ja vali "Open".

### English (EN)

**Section Title:** Option A: Install via System Settings

**Intro:** The simplest way. Just follow these steps:

**Steps:**

1.  **Download and open**
    
    Download Ritemark DMG, open it and drag it to your Applications folder. Double-click to open.
    
2.  **macOS blocks the app**
    
    You'll see: "Ritemark cannot be opened because Apple cannot check it for malicious software." This is normal – click "OK".
    
3.  **Open System Settings**
    
    Go to **System Settings → Privacy & Security**. Scroll down until you see the message about Ritemark.
    
4.  **Click "Open Anyway"**
    
    Click the "Open Anyway" button and enter your password. That's it!
    
5.  **Done!**
    
    Ritemark now opens normally. You only need to do this once.
    

**Note:** On macOS 14 or earlier: simply right-click the app and select "Open".

* * *

## 3\. Method B: Terminal One-Liner (For developers)

### Estonian (ET)

**Section Title:** Variant B: Paigalda terminaliga

**Intro:** Kui oled harjunud terminaliga, on see kõige kiirem viis. Ava terminal Macis ja kopeeri alltoodud kood!

**Code Block:**

```bash
curl -L -o ~/Downloads/Ritemark.dmg "https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg" && open ~/Downloads/Ritemark.dmg
```

**Explanation:** Terminali kaudu laetud failidel pole macOS karantiini märgendit, seega Gatekeeper hoiatust ei tule.

### English (EN)

**Section Title:** Option B: Install via Terminal

**Intro:** If you're comfortable with terminal, this is the fastest way:

**Code Block:**

```bash
curl -L -o ~/Downloads/Ritemark.dmg "https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg" && open ~/Downloads/Ritemark.dmg
```

**Explanation:** Files downloaded via terminal don't have the macOS quarantine flag, so no Gatekeeper warning appears.

* * *

## 4\. FAQ Section

### Estonian (ET)

**Section Title:** Korduma kippuvad küsimused

**Q: Kas Ritemark on turvaline?**

A: Jah. Ritemark on allkirjastatud Apple Developer ID-ga, mis tähendab, et Apple teab, kes rakenduse tegi. Notariseerimine on lihtsalt lisasamm Apple'i poolt, mis võtab uutel arendajatel aega. Sinu failid jäävad alati sinu arvutisse – me ei saada midagi kuhugi.

**Q: Miks ma pean seda tegema?**

A: Apple'i notariseerimisprotsess võtab uutelt arendajatelt kauem aega. Selle asemel, et oodata, laseme sul juba täna proovida. Kui Apple meid heaks kiidab, uuendame rakendust ja seda sammu pole enam vaja.

**Q: Kas see on ühekordselt?**

A: Jah! Kui oled rakenduse ühe korra heaks kiitnud, avaneb see edaspidi normaalselt.

**Q: Ma ei usalda seda. Mida teha?**

A: Täiesti mõistlik! Võid oodata, kuni Apple meid ametlikult notariseerib. Jälgi meie Githubi lehte värskenduste jaoks.

### English (EN)

**Section Title:** Frequently Asked Questions

**Q: Is Ritemark safe?**

A: Yes. Ritemark is signed with Apple Developer ID, which means Apple knows who made the app. Notarization is just an extra verification step that takes time for new developers. Your files always stay on your machine – we never send anything anywhere.

**Q: Why do I need to do this?**

A: Apple's notarization process takes longer for new developers. Instead of waiting, we're letting you try it today. Once Apple approves us, we'll update the app and this step won't be needed anymore.

**Q: Is this a one-time thing?**

A: Yes! Once you've approved the app once, it opens normally from then on.

**Q: I don't trust this. What should I do?**

A: Totally fair! You can wait until Apple officially notarizes us. Follow our GitHub page for updates.

* * *