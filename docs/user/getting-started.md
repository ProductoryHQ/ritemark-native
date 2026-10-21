# Getting Started

> From download to editing in 5 minutes.

This guide walks you through installing Ritemark and creating your first document.

---

## 1. Download

Get Ritemark from GitHub:
1. Download the build for your machine:
   - **macOS (Apple Silicon / M1+):** [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg)
   - **macOS (Intel):** [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg)
   - **Windows (x64):** [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe)
2. Open the downloaded file

---

## 2. Install

**macOS:**
1. Drag **Ritemark** to your **Applications** folder
2. Eject the disk image
3. Open Ritemark from Applications

Ritemark is signed with its Developer ID and notarized by Apple. The first time you open it, macOS asks whether you want to open an app downloaded from the internet. Click **Open**.

**Windows:** run `Ritemark-Setup.exe` and follow the installer. Ritemark then appears in the Start menu.

System requirements and uninstall steps are in [Installing Ritemark](installation.md).

---

## 3. The Welcome

Ritemark works with folders (projects), not individual files. The first time you open it, the welcome asks two things:

1. **Which AI do you use?** Sign in to ChatGPT or Claude with the account you already use, or set up OpenCode with an API key of your own. You can use more than one, or choose **Skip for now**.
2. **Where is your work?** Choose **Open a folder…** for a folder you already have, **Start a new project** for a new folder in Documents/Ritemark (**Change…** picks another place), or **Try the sample project**.

The welcome also has the usage-data switch, **Share anonymous usage data to improve Ritemark**. It is on by default, and nothing is sent until you leave the welcome with it on. You can turn it off there, or later in Settings.

Your project opens on its **Home**, with the AI beside it on the right.

Later, File → Open Folder… opens another folder, and Home lists your projects.

### Finding your way

- **The places row**, at the top of the left column: Home, Documents, Tasks, Browser, Agents and Transcribe. **More** (⋯) at its end holds File changes, Extensions, Search, and Copilot Chat if you have it installed (it opens as a tab)
- **The tab row**: Home and the Task board are always the first two tabs. The **+** at its end makes a new Text, Table, Web page or Terminal tab (Cmd+T, Ctrl+T on Windows)
- **The terminal is a tab**: open one from the **+**, or with Control+` (Ctrl+` on Windows)
- **You**, at the top right, holds **Settings** and **Help**. Cmd+, (Ctrl+, on Windows) opens Ritemark Settings
- **On Windows**, the File, Edit, View and Help menus are behind the menu button at the start of the left column's top strip; Alt opens it

---

## 4. Create Your First Document

1. Under **Start something** on Home, click **Text**. Or click the **+** at the end of the tab row and choose **Text**
2. Ritemark makes `Untitled.md` in your project and opens it
3. Start typing

To give it a name, open **Documents** in the places row at the top left, right-click the file and choose **Rename**. **New**, under the project's name in Documents, also makes a Table, a Flow or a folder.

---

## 5. Try the Editor

### Write Some Text

Just type. Your text appears formatted as you type.

### Use Slash Commands

Type `/` to see available blocks:
- `/heading1` - Large heading
- `/bullet` - Bullet list
- `/task` - Checklist

### Format Text

1. Select some text
2. A bubble menu appears
3. Click **B** for bold or **I** for italic

Or use shortcuts: **Cmd+B** (bold), **Cmd+I** (italic)

---

## 6. Auto-Save

Your work saves automatically. No save button needed.

- Make a change
- Wait 1 second
- File is saved

The document's bar says **Saved** once your document is on disk.

---

## What's Next?

### Enable AI Features

If you skipped the AI on the welcome, sign in later in Settings (**You** at the top right ▸ **Settings**, or Cmd+, / Ctrl+,). [Set up AI →](setup-ai.md)

If you plan to use Claude or ChatGPT, or want to create your own helpers, check out the [AI Agents](features/ai-agents.md) and [Agents](features/agent-library.md) guides.

### Learn the Features

- [Core Editor](features/editor.md) - How the editor works
- [Block Types](features/blocks.md) - All available blocks
- [Keyboard Shortcuts](features/keyboard-shortcuts.md) - Speed up your workflow

### Share Documents

Send a copy as PDF or Word, or publish to Google Docs, from **Share** on the document's bar. [Learn about Share →](features/export.md)

---

## Tips for New Users

| Tip | Why |
|-----|-----|
| Use slash commands | Faster than menus for inserting blocks |
| Learn Cmd+B and Cmd+I | Quick formatting without leaving keyboard |
| Open folders, not files | Ritemark is project-based |
| Trust auto-save | No need to Cmd+S constantly |

---

## Quick Reference

| Task | How |
|------|-----|
| Create new document | The **+** in the tab row → Text, or Cmd+N |
| Open folder | File → Open Folder… |
| Open a terminal | The **+** → Terminal, or Control+` (Ctrl+` on Windows) |
| Open Settings | **You** → Settings, or Cmd+, (Ctrl+, on Windows) |
| Bold text | Select text, press Cmd+B |
| Insert heading | Type `/heading1` |
| Insert list | Type `/bullet` or `/task` |
| PDF copy | Click Share → PDF |

---

## Need Help?

- [Common Issues](troubleshooting.md) - Solutions to frequent problems
- [Feature Documentation](features/README.md) - Complete feature reference
- **You** → Help opens Ritemark's support pages, and **Help → Getting started** opens the online guide
