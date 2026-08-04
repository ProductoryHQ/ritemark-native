---
date: '2026-07-29'
title: 'Ritemark v1.8.5 — Parallel Agent Chats'
author: Jarmo Tuisk
status: Released
sprints:
  - sprint-98
  - sprint-99
  - sprint-100
  - sprint-101
tags:
  - sprint-98
  - sprint-99
  - sprint-100
  - sprint-101
  - parallel-chats
  - thread-rail
  - runtimes
  - opus-5
  - capability-context
  - safe-updates
---

# Ritemark v1.8.5 — Parallel Agent Chats

**Type:** Patch (1.8.4 → 1.8.5) — full app release (DMG)
**Focus:** Making Ritemark's AI sidebar feel like a real workspace instead of a single chat box. This release debuts **parallel agent chats** — run several AI conversations at once, each with its own session, visible in a new **thread rail** down the right edge of the sidebar. Switch threads freely while agents keep working; history restores per thread. Alongside that, the bundled **Claude Code** and **OpenCode** runtimes are upgraded and validated against parallel sessions, **Claude Opus 5** joins the model picker, and agents now receive a **capability context** so they behave like Ritemark assistants rather than generic CLIs. A new **shell-level watchdog** closes the failure mode behind July's `1.8.3-ext.1` incident. Closes [#154](https://github.com/ProductoryHQ/ritemark-native/issues/154), [#125](https://github.com/ProductoryHQ/ritemark-native/issues/125), and [#136](https://github.com/ProductoryHQ/ritemark-native/issues/136); advances [#146](https://github.com/ProductoryHQ/ritemark-native/issues/146) and [#142](https://github.com/ProductoryHQ/ritemark-native/issues/142).

**Availability:** Live now on **macOS** (Apple Silicon + Intel, Apple-notarized). The **Windows** (x64, code-signed) installer is being prepared and will be added to this release shortly; until then the update feed keeps Windows on v1.8.4.

* * *

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — code-signed (arriving shortly) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.

* * *

## Highlights

- **Parallel agent chats.** Run several AI conversations at once — each thread gets its own session, visible in the new thread rail on the right edge of the AI sidebar. Switch threads freely while agents keep working; history restores per thread.
- **History restores per thread.** Closing and reopening a thread brings back its full conversation, and a thread cap keeps resource use in check.
- **Updated AI runtimes.** Bundled Claude Code (2.1.217) and OpenCode (1.18.4) upgraded and validated against parallel sessions with a per-runtime compatibility matrix.
- **Claude Opus 5 in the model picker.** The catalog now includes Anthropic's newest Opus-tier model, alongside Sonnet 5, Fable 5, and Haiku 4.5.
- **Agents that know their surroundings.** Agents now receive a capability context describing the Ritemark environment (editor, integrated browser, tools), so they act like Ritemark assistants rather than generic CLIs.
- **Safer update system.** A shell-level watchdog quarantines a broken extension update and falls back to the built-in copy automatically.

* * *

## Why This Release

Ritemark's AI sidebar had one seat. If you asked Claude to draft a section and then wanted a second opinion from Codex — or simply wanted to keep one long-running task going while you started another — you had to wait, or throw away context. That's not how people actually work with agents. You run a few things in parallel, glance between them, and pick up whichever one finished.

v1.8.5 makes that real. The sidebar now holds **multiple independent chats**, each with its own session and history, laid out in a **thread rail** on the right edge. Start a thread, kick off a run, open another, and switch between them — the agents keep working in the background and their replies land in the right thread, never crossing over.

The rest of the release makes those parallel agents better citizens. The bundled runtimes were bumped and — this is the part that matters — **re-validated against parallel sessions** rather than just single-turn chats, so two Claude threads running at once behave. **Opus 5** shows up in the picker for the heaviest work. And every agent now starts with a short **capability context** that tells it where it is: a Markdown editor with an integrated browser and a specific set of tools, not a bare terminal. The practical effect is agents that reach for Ritemark's own capabilities instead of guessing.

Finally, this release quietly hardens the update path itself. After July's `1.8.3-ext.1` packaging incident, a new **shell-level watchdog** guarantees that a bad extension update can never strand an installation — it quarantines the broken copy and falls back to the built-in one automatically.

Sprint docs: `docs/development/sprints/sprint-98-*` (safe update lane), `sprint-99-*` (parallel chats), `sprint-100-*` (runtime bumps), and `sprint-101-*` (capability context).

* * *

## What's New

### Parallel agent chats — the thread rail (sprint-99)

The AI sidebar is no longer a single conversation:

- **Multiple threads at once.** Open a new chat while another is mid-run. Each thread carries its own session, so agents keep working in the background and responses always land in the thread that asked — no cross-talk.
- **The thread rail.** A slim rail down the right edge of the AI sidebar shows your open threads. Click to switch; the active thread's history is restored instantly. Thread-rail icons use Ritemark's brand indigo in both light and dark themes.
- **A sensible cap.** A thread cap keeps resource use in check — open past it and Ritemark tells you rather than silently spawning more sessions.
- **Per-thread runtime.** Switch Claude ↔ Codex ↔ OpenCode inside any thread; the choice is per thread, and each conversation stays continuous.

This is the headline of v1.8.5.

### Updated runtimes + Claude Opus 5 (sprint-100)

- **Bundled Claude Code upgraded to 2.1.217** and **OpenCode to 1.18.4.** Both were re-validated specifically against **parallel** sessions — two threads on the same runtime at once — with a per-runtime compatibility matrix, so the new parallel-chat feature is proven on the new binaries, not just single-turn chat. Advances [#146](https://github.com/ProductoryHQ/ritemark-native/issues/146).
- **Claude Opus 5 in the model picker.** Anthropic's newest Opus-tier model now appears in the Claude section, between Sonnet 5 and Opus 4.8. Existing installs pick it up automatically via the live model-catalog feed — no reinstall needed.

### Agents that know their surroundings (sprint-101, #154)

Every agent run now starts with a **capability context**: a short system description of the Ritemark environment — that it's a Markdown editor, that there's an integrated browser, and which tools are available. The result is agents that behave like Ritemark assistants (reaching for the editor and browser tools) rather than generic command-line agents guessing at a foreign environment. Prompt-injection safety is unchanged: agents still refuse instructions embedded inside opened documents. Closes [#154](https://github.com/ProductoryHQ/ritemark-native/issues/154).

* * *

## Fixes &amp; Polish

- **"AI Offline" badge now has a "Check again" link (#125).** When the sidebar shows the AI Offline badge, you can re-test connectivity on demand — click **Check again** for a brief "Checking…" state instead of waiting out the 30-second poll or restarting the app. Closes [#125](https://github.com/ProductoryHQ/ritemark-native/issues/125).
- **Voice dictation defaults to 5-second chunks (#136).** The default recording chunk moved from 3s to 5s, noticeably improving transcription accuracy for Estonian and other smaller languages. 3s and 10s remain selectable in Dictation Settings. Closes [#136](https://github.com/ProductoryHQ/ritemark-native/issues/136).
- **Thread-rail robot icons use Ritemark's brand indigo** in both light and dark themes, instead of picking up per-runtime brand colors.
- **Retro-credit — attachment chips show visual feedback (#103).** The chat composer's visual feedback when a text/Markdown file is attached actually shipped in **v1.8.4**, but was missed in that release's notes. Release-notes tooling has been fixed so agent-delivered fixes are always credited. Closed in v1.8.4; noted here for the record.

* * *

## Safer Updates

Behind the scenes, v1.8.5 hardens the extension-update path so the `1.8.3-ext.1` incident can't repeat:

- **Shell-level watchdog (patch 012).** On activation failure, Ritemark now quarantines a broken user-directory copy of the extension and falls back to the bundled built-in copy automatically — a broken extension update can no longer strand an installation.
- **Copy-then-overlay installer** and a new **`ritemark.updates.channel`** setting (defaults to `stable`) lay the groundwork for the lightweight update lane's return. Advances [#142](https://github.com/ProductoryHQ/ritemark-native/issues/142).

* * *

## Known Issues &amp; Deferred

- **Windows installer arriving shortly.** The v1.8.5 Windows (x64) installer is still being prepared and will be added to this GitHub release; until it lands, the update feed keeps Windows users on v1.8.4.
- **The `-ext.N` fast-lane stays closed (#142).** Lightweight extension-only updates remain disabled until a deliberately trivial extension update passes end-to-end in production on top of this release's safeguards. Full app updates (DMG) are unaffected.

* * *

## Upgrade Notes

Standard upgrade. macOS users on v1.8.4 will be offered v1.8.5 through the in-app updater; new users can download the DMG from the release page. Windows stays on v1.8.4 until the v1.8.5 installer is added. Before opening the DMG, quit any running Ritemark (Cmd+Q) so two instances don't share the user-data directory.
