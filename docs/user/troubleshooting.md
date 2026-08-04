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

## AI Agents and Agent Library

> The earlier built-in "Ritemark Agent" chat assistant was removed in v1.7.2. The AI sidebar now runs
> **Claude** and **Codex** only. For per-agent setup and troubleshooting (sign-in, "needs repair",
> spawn errors), see [AI Agents](features/ai-agents.md). For OpenAI-key issues in Flows, see
> [Set Up AI → OpenAI API Key for Flows](setup-ai.md#openai-api-key-for-flows).

### "AI Offline" badge in the sidebar

If Ritemark can't reach the AI provider, the sidebar shows an **AI Offline** badge.

1. Check your internet connection.
2. Click **Check again** on the badge to re-test connectivity on demand — you'll see a brief "Checking…" state. (Added in v1.8.5; before that you had to wait out the ~30-second poll or restart.)
3. Once connectivity is back, **Check again** brings the sidebar online without a restart.
4. If it stays offline with a working connection, verify your API key / sign-in on the affected agent (see [AI Agents](features/ai-agents.md)).

### New helpers do not appear in the Agent Library

1. Check that the helper exists under `.claude/` or `.agents/`
2. Make sure the file uses the expected `.md` / `SKILL.md` structure
3. Reload the window if the sidebar has not refreshed yet

### Launch Chat is missing

1. Confirm you are right-clicking an **agent** row, not a skill row
2. Make sure the helper is recognized as an agent configuration file
3. If the helper is new, wait for the sidebar to rescan or reload the window

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

Ritemark ships two kinds of updates. Most day-to-day fixes and features arrive as a small **extension update** (auto-installed in the background by default); occasional bigger changes ship as a **full app update** (a DMG you install manually).

### Small updates (most common) — nothing to do

By default, small extension updates download and verify in the background automatically. When one's ready, a **"Ritemark X.Y.Z ready"** notice appears in the status bar (bottom of the window) — click it to relaunch and apply it. No separate download step.

Don't want this automatic? Set `ritemark.updates.mode` to `"prompt"` in Settings to go back to being asked before each install.

### "Update available" won't go away (full app updates only)

1. Download the new version from GitHub
2. Or dismiss with "Don't show again"
3. Settings remember your preference

### How to update (full app updates only)

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
