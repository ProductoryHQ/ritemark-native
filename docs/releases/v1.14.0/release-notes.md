# Ritemark 1.14.0 Release Notes

> **Draft.** This holds Sprint 129's part. The introduction and the other sprints' sections are added when the release scope is settled ([release plan](../../development/releases/v1.14.0/release-plan.md)).

## Voice dictation and on-device transcription on Windows

- **Dictate on Windows and Intel Macs.** The microphone in the document header now works on Windows PCs and Intel Macs, as it does on Apple silicon Macs. Your voice is turned into text on your own computer: nothing is uploaded, and after a one-time download it works offline.
- **Speak, then text.** Windows PCs and Intel Macs do this work on the processor alone, so Ritemark doesn't type along while you speak. You talk, press Stop, and the text arrives about 20 seconds later on a typical laptop, even after a long dictation, because Ritemark works through the recording while you speak. A note at the cursor says it is recording, then that it is processing and how long that usually takes.
- **A smaller download.** Windows and Intel Macs download an 834 MB speech model instead of 1.5 GB, with the same accuracy.
- **Transcribe on-device.** Transcribe's On-device · Whisper engine now works on Windows and Intel Macs for MP3, WAV, FLAC, OGG and Record files. A typical Windows laptop takes about as long as the recording. On Windows, `.m4a` and `.aac` files still need ElevenLabs.
- **Older Macs.** Apple silicon Macs with macOS 12, 13 or 14 can now dictate and transcribe on-device. Before, the on-device engine needed macOS 15.

## Dictation, everywhere

- **It says why it can't start.** A blocked microphone, no microphone, security software stopping it, a processor that is too old, or a missing speech model each get a plain explanation with the right button. **Open Microphone Settings** names the exact switches on Windows and macOS. Ritemark never offers the download on a computer where dictation can't run.
- **Nothing you say is dropped.** When the computer fell behind, speech that came in meanwhile was thrown away. It now waits its turn and goes in, in order.
- **The last words after Stop.** The microphone now shows **Adding your last words...** until the last sentence is in, instead of looking finished.
- **The dictation note stays out of your file.** The grey **Listening...** note at the cursor used to be saved into the document while you dictated. It is now drawn on top of the document and never saved.
- **Cancel a start.** Clicking the microphone again while it gets ready now cancels.
- **Intel Macs.** Dictation used to download the speech model and then never insert any text there.

New: a guide to [voice dictation](../../user/features/dictation.md).
