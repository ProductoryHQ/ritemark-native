# Common Issues

> Solutions to frequently encountered problems.

---

## Installation

### "Cannot be opened because Apple cannot check it"

Ritemark isn't notarized with Apple yet. To open:

1. **Right-click** on Ritemark in Applications
2. Select **Open**
3. Click **Open** in the dialog

You only need to do this once.

### App won't open at all

1. Check you're on macOS (Windows not yet supported)
2. Verify you have an Apple Silicon Mac (Intel not supported)
3. Try downloading the DMG again
4. Move to Applications folder before opening

---

## Editor

### Blank editor / Nothing shows

The editor webview didn't load. Try:

1. **Reload Window**: Cmd+Shift+P → "Reload Window"
2. **Restart Ritemark**: Quit and reopen
3. **Check file type**: Only `.md` files open in WYSIWYG mode

### Changes not saving

Ritemark auto-saves after 1 second. If changes aren't saving:

1. Check file permissions (can you write to that folder?)
2. Look for error messages in bottom status bar
3. Try saving manually: Cmd+S

### Formatting looks wrong

1. Reload the window: Cmd+Shift+P → "Reload Window"
2. Check if the file is valid markdown
3. Complex HTML in markdown may not render correctly

### Text selection issues

1. Click outside the editor, then back inside
2. Reload window if persistent

---

## AI Assistant

### "AI Offline" in status bar

The AI assistant can't connect. Check:

1. **Internet connection** - Are you online?
2. **API key** - Is one configured?
3. **API credits** - Do you have OpenAI credits?

### No response from AI

1. Wait longer - some requests take time
2. Check for error messages in the AI sidebar
3. Try a simpler request
4. Verify your API key is valid

### "Invalid API key" error

1. **Cmd+Shift+P** → "Configure OpenAI API Key"
2. Enter a valid key (starts with `sk-`)
3. Make sure no extra spaces were copied

### AI changes wrong text

1. **Select text first** before making a request
2. Check the selection indicator in the AI sidebar
3. Be specific about what you want changed

---

## Export

### PDF export fails

1. Check you have write permission to save location
2. Try saving to Desktop first
3. Make sure document isn't corrupted

### Word export has wrong formatting

1. Complex tables may need manual adjustment
2. Some markdown features don't translate perfectly
3. Consider PDF for consistent formatting

### Export button not visible

Export only works for markdown files. CSV and Excel files use different tools.

---

## Files

### CSV file shows as text

1. Make sure file extension is `.csv`
2. Close and reopen the file
3. Check file isn't corrupted

### Excel file won't open

1. Verify extension is `.xlsx` or `.xls`
2. File might be corrupted - try opening in Excel
3. Very large files may fail to load

### Large file warning

Files over 5MB or 10,000 rows may:
- Take longer to load
- Be truncated (CSV shows first 10K rows)
- Cause performance issues

For very large data, use a dedicated spreadsheet app.

---

## Performance

### Slow typing / lag

1. Close other resource-heavy applications
2. Reload window: Cmd+Shift+P → "Reload Window"
3. Very long documents may be slower

### High memory usage

1. Close unused files
2. Restart Ritemark
3. This is a known issue being improved

---

## Updates

### "Update available" won't go away

1. Download the new version from GitHub
2. Or dismiss with "Don't show again"
3. Settings remember your preference

### How to update

1. Download new DMG from GitHub
2. Open DMG
3. Drag Ritemark to Applications (replace existing)
4. Launch Ritemark

---

## Still Stuck?

### Get Help

- Check [Feature Documentation](../features/README.md) for how things should work
- Review [Getting Started](../guides/getting-started.md) for setup steps

### Report an Issue

If you've found a bug:
1. Note what you were doing
2. Note any error messages
3. Check if it's reproducible
4. Report at GitHub Issues

---

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Editor blank | Cmd+Shift+P → Reload Window |
| AI not working | Check internet + API key |
| Can't open app | Right-click → Open |
| File won't save | Check folder permissions |
| Slow performance | Restart Ritemark |
