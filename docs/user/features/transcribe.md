# Transcribe

> Drop in a recording, get a document you can edit.

Turn a meeting, interview or workshop recording into a speaker-attributed transcript — then into Markdown — without leaving Ritemark or uploading it to a service you did not choose.

---

## What You Can Do

- **Transcribe an audio file** — `.m4a`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`
- **Choose where the audio goes** — on-device (private, free) or ElevenLabs (separates speakers, costs about $0.22 per hour)
- **Click any line to hear it** — verify a quote against the recording before you use it
- **Name the speakers once** — the rename applies to every line and to the saved document
- **See where the engine was unsure** — likely-misheard words are highlighted
- **Pull out the summary, decisions, action items and quotes** — each with a timestamp that plays the moment it came from
- **Save it as a document** — in a folder you pick, opened in Ritemark's editor

---

## How It Works

### 1. Add a recording

Click the waveform icon in the Activity Bar, then **Add recording** — or drag an audio file in from the Folder view.

Ritemark reads the length and shows what each engine would do with it. Nothing runs until you choose one.

### 2. Choose an engine

| | On-device · Whisper | ElevenLabs Scribe |
| --- | --- | --- |
| Where the audio goes | Stays on your machine | Uploaded to ElevenLabs |
| Cost | Free | About $0.22 per hour, shown before upload |
| Speakers | **Cannot separate them** | Separates them, up to 32 |
| Platform | macOS on Apple silicon only ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)) | macOS, Windows, Linux |

This is a real trade, not a preference: today, "the audio never leaves my machine" and "I know who said what" cannot both be true. Pick per recording.

To use ElevenLabs, add an API key in **Settings → API Keys → ElevenLabs**. The gear in the Transcribe title bar takes you there.

### 3. Work with the transcript

The recording opens in the **Transcript Workbench**:

- **Play** — space bar, or the play button. `←` and `→` skip five seconds
- **Click a line** — the audio jumps there and plays, and the line highlights as it goes
- **Click the waveform** — seek anywhere
- **1×** — cycle through 1×, 1.25×, 1.5×, 2×
- **Click a speaker chip** — rename that speaker everywhere. The chip tells you how many segments it will change

Amber, dotted-underlined words are ones the engine was not confident about — usually names, product terms, or a switch between languages. Click the line to hear what was actually said.

### 4. Insights

**Generate insights** reads the transcript and pulls out:

- a summary
- decisions
- action items, with owners where the transcript makes them clear
- open questions
- key quotes, verbatim

Every item carries a timestamp. Click it and the recording plays from there — so you can check any claim in a couple of seconds. Anything the model cannot tie to a real line in the transcript is discarded rather than shown to you.

Insights use whichever AI runtime you already have set up. On a non-diarized transcript nothing is attributed to a named person, because the transcript does not know who spoke.

### 5. Save it

**Save to document** asks which folder, then writes Markdown with front matter, speaker headings and timestamps — and opens it in Ritemark's editor. The document stays linked in the workbench header.

From there it is an ordinary Ritemark document: edit it, export it to PDF or Word, or ask the AI sidebar about it. With the workbench open, the sidebar treats the saved transcript as the active file.

---

## Good to Know

**Long recordings.** A 60-minute file transcribes on-device in roughly two and a half minutes on Apple silicon. Close the panel and it keeps going — the Activity Bar icon shows how many jobs are running. **Cancel** stops it at once. If Ritemark closes mid-transcription, the recording comes back marked **Interrupted**, never silently dropped.

**One project at a time.** Transcripts belong to the folder that was open when you made them. Opening a different project shows that project's recordings.

**If a recording moves.** The row says so and offers **Find it** — the transcript is not lost, only the path went stale.

**Video files are not supported yet.** Export the audio track first.

**Your transcripts are stored by Ritemark**, not in the folder. That is why saving matters: the saved document is the copy you own, back up and sync. **Settings** shows how much space transcripts use and can clear them — without touching your recordings or anything you saved.

---

## Requirements

- **On-device:** macOS on Apple silicon (M1 and later). The first run downloads a 1.5 GB speech model, once. On an Intel Mac the engine reports that it is missing from the build — use ElevenLabs there.
- **ElevenLabs:** an API key from [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys), and a connection.
- **Insights:** any configured AI runtime (Claude sign-in or an API key).
