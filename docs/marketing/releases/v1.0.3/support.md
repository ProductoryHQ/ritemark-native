# Support Content for v1.0.3

Content for the support/help section of the website. Each major feature needs a help entry.

---

## Voice Dictation

### How to Use

1. Click the microphone button in the editor toolbar
2. On first use, Ritemark downloads the speech model (~1.5GB one-time download)
3. Start speaking - text appears in real-time as you talk
4. Click the microphone button again to stop

### Changing Language

- Click the dropdown arrow (chevron) next to the mic button
- Select from recent languages or click "More languages..." for 50+ options
- Ritemark remembers your last used language

### Settings

- Click the dropdown arrow > "Settings..." to adjust:
  - **Chunk duration** (3s / 5s / 10s) - how often audio is sent for transcription
  - Shorter = more responsive, longer = more accurate

### Troubleshooting

#### "Microphone Access Required" modal appears
- Click "Open System Settings" in the modal
- Enable Ritemark under Privacy & Security > Microphone
- Restart Ritemark after granting permission

#### Dictation not starting / "Loading..." stuck
- Ensure the speech model is downloaded (Settings > Model section should show model name and size)
- Check your internet connection for first-time model download
- Model is stored at `~/.ritemark/models/`

#### Poor transcription quality
- Speak clearly and at a normal pace
- Reduce background noise
- Try a longer chunk duration (10s) for better accuracy
- The model works best with clear, continuous speech

#### Estonian language not working well
- Ensure you selected "Estonian" (not another language) from the dropdown
- Estonian works best with the large-v3-turbo model (default)
- Speak in full sentences for better results

### Technical Details

- Model: OpenAI Whisper large-v3-turbo (runs locally via whisper.cpp)
- Audio: 16kHz mono PCM, processed locally
- Storage: ~/.ritemark/models/ (~1.5GB)
- No internet required after model download
- No audio data ever leaves your machine

---

## Copy as Markdown

### How to Use

1. Open the **Export** menu in the toolbar
2. Click **Copy as Markdown**
3. Paste the clean markdown anywhere (GitHub, email, other editors)

### With Selection
- Select text in the editor first
- Export > Copy as Markdown copies only the selected text

### Without Selection
- If nothing is selected, the entire document is copied

### What's Preserved
- Headings, bold, italic, links
- Lists (ordered and unordered)
- Tables
- Images (as markdown image syntax)
- Code blocks
- Blockquotes

---

## FAQ Updates for v1.0.3

### Q: Does Voice Dictation need internet?
**A:** Only for the one-time model download (~1.5GB). After that, everything runs locally - you can dictate offline.

### Q: Is my voice data sent anywhere?
**A:** No. All speech processing happens on your machine using the bundled Whisper model. No audio ever leaves your computer.

### Q: Which languages are supported for dictation?
**A:** 50+ languages including Estonian, English, German, French, Spanish, Russian, and many more. Estonian is a first-class supported language.

### Q: How much disk space does the speech model need?
**A:** About 1.5GB in ~/.ritemark/models/. You can remove it anytime via Dictation Settings > Model > Remove.

### Q: Can I use dictation and typing at the same time?
**A:** Yes. Dictated text is inserted at the cursor position. You can type normally between dictation sessions.
