# Transcribe

> Record or drop in a recording, get a document you can edit.

Turn a meeting, interview or workshop recording into a speaker-attributed transcript — then into Markdown — without leaving Ritemark or uploading it to a service you did not choose.

---

## What You Can Do

- **Transcribe an audio file** — `.m4a`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`
- **Record directly** — press Record, and the recording is saved into your project as an ordinary audio file
- **Choose where the audio goes** — on-device (private, free) or ElevenLabs (separates speakers, costs about $0.22 per hour)
- **Click any line to hear it** — verify a quote against the recording before you use it
- **Name the speakers once** — full names and spaces are preserved everywhere; long labels stay neatly ellipsized
- **See where the engine was unsure** — likely-misheard words are highlighted
- **Pull out the summary, decisions, action items and quotes in any language** — each with a timestamp that plays the moment it came from
- **Create a separate Insights document** — choose its name and location without changing the transcript
- **Save it as a document** — in a folder you pick, opened in Ritemark's editor

---

## How It Works

### 1. Add a recording

Click the waveform icon in the Activity Bar, then **Add recording** — or drag an audio file in from the Folder view.

Ritemark reads the length and shows what each engine would do with it. Nothing runs until you choose one.

#### Record directly

Press **Record**, the button with a dot beside **Add recording**. The first time, your computer asks whether Ritemark may use the microphone; the panel shows **Waiting for microphone permission…** until you answer. If access is denied, the panel says so, and **Microphone Settings** opens the right page of your system settings.

Where the recording is saved depends on what you have open:

| What is open | Where the recording goes |
| --- | --- |
| One folder | A `recordings` folder inside it |
| Several folders | The folder of the file you are editing; otherwise Ritemark asks which |
| No folder | Ritemark asks where before your first recording and remembers it. The place is shown under the buttons, with **Change** |

Each recording is its own file, named after when it started — `Recording 2026-09-22 14.05.wav` — and an existing file is never overwritten: a second recording in the same minute becomes `Recording 2026-09-22 14.05 (2).wav`. It is a standard WAV file of about 115 MB per hour.

While you record, the panel shows the time and how much audio has been saved so far.

- **Stop and use** stops the recording and puts it in the same engine choice as an added file. Nothing is transcribed, and nothing is uploaded, until you choose an engine. If you cancel that choice, the recording stays where it was saved.
- **Cancel** throws the recording away. Once there are more than a few seconds of audio it asks first, and the file goes to the Trash rather than being deleted.

Hover over any button in the panel to see what it does, or why it is unavailable.

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
- **Click a speaker chip** — rename that speaker everywhere. Full names such as `Jarmo Tuisk` work normally; Space and arrow keys edit the name instead of controlling playback

Amber, dotted-underlined words are ones the engine was not confident about — usually names, product terms, or a switch between languages. Click the line to hear what was actually said.

### 4. Insights

Search for a language by its English name, native name, common alias, or code —
or type any language or dialect and choose **Use …** — then select **Generate
insights**. **Auto** follows the detected transcript language when Ritemark
recognizes it and otherwise falls back to English. The choice affects Insights
only; it never translates the raw transcript.

Insights pull out:

- a summary
- decisions
- action items, with owners where the transcript makes them clear
- open questions
- key quotes, verbatim

Every item carries a timestamp. Click it and the recording plays from there — so you can check any claim in a couple of seconds. Anything the model cannot tie to a real line in the transcript is discarded rather than shown to you. Generated prose uses the chosen language; quotes, speaker names, and timestamps stay verbatim.

Insights use whichever AI runtime you already have set up, but run as a focused extraction without coding tools or project instructions. On a non-diarized transcript nothing is attributed to a named person, because the transcript does not know who spoke.

After generation, **Create insights document** asks for a filename and location.
It creates a new Insights-only Markdown snapshot with provenance, timestamps,
language, and model attribution. Existing files and the primary transcript are
never replacement targets. Cancelling or a failed write creates nothing; later
regeneration does not update a snapshot you already created.

### 5. Save it

**Save to document** asks which folder, then writes Markdown with front matter, speaker headings and timestamps — and opens it in Ritemark's editor. The document stays linked in the workbench header.

From there it is an ordinary Ritemark document: edit it, export it to PDF or Word, or ask the AI sidebar about it. With the workbench open, the sidebar treats the saved transcript as the active file.

The transcript Save action and **Create insights document** are deliberately
separate. Saving the transcript keeps its established link in the workbench;
creating an Insights document never changes that link.

---

## Good to Know

**Long recordings.** A 60-minute file transcribes on-device in roughly two and a half minutes on Apple silicon. Close the panel and it keeps going — the Activity Bar icon shows how many jobs are running. **Cancel** stops it at once. If Ritemark closes mid-transcription, the recording comes back marked **Interrupted**, never silently dropped.

**One project at a time.** Transcripts belong to the folder that was open when you made them. Opening a different project shows that project's recordings.

**If a recording moves.** The row says so and offers **Find it** — the transcript is not lost, only the path went stale.

**Video files are not supported yet.** Export the audio track first.

**A recording is saved while it happens.** Until you stop, the audio is written to `Recording … .wav.part` beside where the recording will land. If the panel reloads, or Ritemark quits or crashes in the middle, the audio is not lost: the panel shows **Recording interrupted**, with **Save recording** and **Discard**. Discard moves the file to the Trash.

**When a recording stops by itself.** If your computer pauses audio input, the microphone is unplugged, or Ritemark cannot keep up with saving, the recording stops and what was recorded is saved, with a note saying why. A notice appears after two hours; at four hours the recording stops and is saved automatically.

**Recording keeps everything the microphone hears.** There is no echo cancellation or noise suppression, so if you record a call played through your speakers, the other side is recorded too. The recording is an ordinary file in your folder and is uploaded only if you choose ElevenLabs for it.

**To hide Record**, turn off the setting `ritemark.features.transcribe-direct-recording`. A recording already in progress still finishes, and saved recordings are not touched.

**Your transcripts are stored by Ritemark**, not in the folder. That is why saving matters: the saved document is the copy you own, back up and sync. **Settings** shows how much space transcripts use and can clear them — without touching your recordings or anything you saved.

---

## Requirements

- **On-device:** macOS on Apple silicon (M1 and later). The first run downloads a 1.5 GB speech model, once. On an Intel Mac the engine reports that it is missing from the build — use ElevenLabs there.
- **ElevenLabs:** an API key from [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys), and a connection.
- **Insights:** any configured AI runtime (Claude sign-in or an API key).
- **Recording:** a microphone, and permission for Ritemark to use it.
