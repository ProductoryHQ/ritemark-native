# Social / Announcement — Ritemark v1.8.5

## Short post (Twitter/X, Mastodon, Bluesky)

Ritemark v1.8.5 is out, and the AI sidebar just grew a second seat — actually, as many as you want.

**Parallel agent chats** are here. Run several AI conversations at once, each with its own session, in a new thread rail down the right edge. Switch between them while the agents keep working; history restores per thread.

Also in this release: bundled Claude Code + OpenCode upgraded and re-validated for parallel sessions, **Claude Opus 5** in the model picker, and agents that now know they're inside Ritemark (not a bare terminal). Live now on macOS.

## Shorter variant (≤280 chars)

Ritemark v1.8.5 adds **parallel agent chats**: run several AI conversations at once, each in its own thread on the new right-edge rail. Switch freely while agents keep working. Plus Claude Opus 5 in the picker + upgraded runtimes. Live now on macOS.

## LinkedIn (longer, professional tone)

**Ritemark v1.8.5 is here — and the AI sidebar now runs conversations in parallel.**

Until now, Ritemark's AI sidebar had a single seat. Ask Claude to draft a section and you had to wait before starting anything else — or throw away context to switch tasks. That's not how people actually work with agents.

v1.8.5 changes that with **parallel agent chats**:
- Open multiple independent conversations at once, each with its own session.
- A new **thread rail** down the right edge shows your open threads — click to switch, and the active thread's history restores instantly.
- Agents keep working in the background; replies always land in the thread that asked, never crossing over.
- Runtime is per thread — switch Claude, Codex, or OpenCode inside any conversation.

The rest of the release makes those parallel agents better:
- **Bundled Claude Code (2.1.217) and OpenCode (1.18.4)** were upgraded and re-validated specifically against parallel sessions.
- **Claude Opus 5** joins the model picker for the heaviest work.
- Agents now start with a **capability context** describing the Ritemark environment — a Markdown editor with an integrated browser and a real toolset — so they act like Ritemark assistants rather than generic command-line agents.

And behind the scenes, a new shell-level watchdog hardens the update path so a broken extension update can never strand an installation.

Live now on macOS (Apple Silicon + Intel, Apple-notarized); the Windows installer follows shortly.

## Hashtags

#Ritemark #Markdown #Writing #AI #Agents
