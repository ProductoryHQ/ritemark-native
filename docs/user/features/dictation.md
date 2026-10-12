# Voice Dictation

> Speak into your document. Your voice is turned into text on your own computer.

Dictation types what you say at the cursor in any Markdown document. The speech is turned into text on your computer with Whisper; nothing is uploaded, and after a one-time download it works offline.

---

## What You Can Do

- **Dictate at the cursor**: click the microphone in the document header and start talking
- **Pick the language**: Estonian and English are at the top, and **More languages...** lists every language Whisper knows
- **Keep working while it finishes**: the text goes where you started dictating, even if you have clicked somewhere else meanwhile

---

## How It Works

### 1. Start

Put the cursor where the text should go, then click the microphone in the document header. The button shows the language it will use, such as **ET**. To use another language, open the arrow beside it and pick one; dictation starts in that language, and the button remembers it.

The first time, Ritemark asks whether to download the speech model, once. When the download finishes, click the microphone again. If you stop the download, the next click offers to resume it.

| Computer | Speech model |
| --- | --- |
| Mac with Apple silicon (M1 and later) | 1.5 GB |
| Windows PC, Intel Mac | 834 MB |

The first time you dictate, your computer also asks whether Ritemark may use the microphone.

### 2. Speak

How the text arrives depends on your computer:

- **Mac with Apple silicon:** text appears while you speak, a few seconds behind you. A grey note at the cursor shows **Listening...** and **Processing...** in turn.
- **Windows and Intel Macs: speak, then text.** These computers turn speech into text more slowly, so Ritemark doesn't type along. While you speak, the note says **Recording... your text appears after you stop**. Ritemark still works through what you said in the background, so the wait after Stop stays short.

The grey note is not part of your document and is never saved into the file.

### 3. Stop

Click the microphone again. While you dictate, its label says what a click does: **Stop** on a Mac with Apple silicon, **Transcribe now** on Windows and Intel Macs.

- **Mac with Apple silicon:** the note says **Adding your last words...** for a moment, and the last sentence goes in.
- **Windows and Intel Macs:** the note says **Processing your recording** and how long it usually takes on your computer. On a typical laptop that is about 20 seconds, also after a long dictation. Then all of the text goes in at once, in the order you said it.

While the text is on its way the microphone button is unavailable (**Finishing…** or **Transcribing…**). Hover over it to see why.

---

## Settings

Open the arrow beside the microphone and choose **Settings...**:

- **Model:** shows the speech model and its size. **Remove** deletes it to free the space; dictation offers the download again next time.
- **Update text every** (Mac with Apple silicon only): how often new text appears while you speak, 3, 5 or 10 seconds. Longer pieces are a little more accurate. Windows and Intel Macs don't show this, because their text comes after Stop.

The speech model lives in your user folder, in `.ritemark/models`. On-device Transcribe uses the same file.

---

## When Dictation Can't Start

Ritemark says what stopped it, in a dialog, with a button that helps:

| What you see | What to do |
| --- | --- |
| **Microphone Access Is Off** (Mac) | **Open Microphone Settings**, turn on **Ritemark** in the list, then **Try Again** |
| **Microphone Access Is Off** (Windows) | **Open Microphone Settings**, turn on both **Microphone access** and **Let desktop apps access your microphone**, then **Try Again** |
| **No Microphone Found** | Connect a microphone, then try again |
| **Microphone Couldn't Start** | Another app may be using the microphone. Close it and try again |
| **Dictation Can't Start**: Windows Security or your antivirus stopped it | Allow Ritemark in Windows Security or your antivirus, then **Try Again**. See also [Windows Smart App Control](../windows-smart-app-control.md) |
| **Dictation Can't Start**: needs a newer processor | The processor is too old for on-device speech recognition; dictation can't run on this computer |
| **Speech Model Needed** | **Download Speech Model** downloads it again |
| **Ritemark Heard Nothing** | The microphone sent only silence. Check that it isn't muted (many laptops have a mute key); on Windows, also that desktop apps may use it. Ritemark stops after a few seconds of total silence, so you don't talk into a muted microphone for long |

Ritemark checks that dictation can run on your computer before it offers the download, so the model is never downloaded for nothing.

---

## Good to Know

**Accuracy.** Whisper is good with clear speech and common words, and weaker with names, product terms and switching languages in mid-sentence. Read the text through once.

**Silence is skipped.** Pauses in your speech are never turned into text, so a long pause doesn't add invented words.

**Pauses help.** Ritemark cuts the audio into pieces at fixed times, so a word that lands on a cut can come out wrong. Pausing briefly between sentences gives the cleanest text. Cutting at your pauses is planned ([#411](https://github.com/ProductoryHQ/ritemark-native/issues/411)).

**A slow computer.**
- **Mac with Apple silicon:** if the text falls more than a minute behind, dictation stops listening and says so. The rest of what you said still appears.
- **Windows and Intel Macs:** dictation never stops on its own. A slow computer only makes the wait after Stop longer.

---

## Requirements

- A Mac with Apple silicon or an Intel processor (macOS 12 or later), or a Windows PC.
- A microphone, and permission for Ritemark to use it.
- The speech model, downloaded once (1.5 GB on Apple silicon, 834 MB on Windows and Intel Macs).
