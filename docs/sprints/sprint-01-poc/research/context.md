# Sprint 01 POC - Project Context

## What We're Building

**Ritemark Native** - A standalone native app built from VS Code OSS with Ritemark embedded as the default markdown editor.

- **Not an extension** - Full VS Code fork with complete control
- **Target users** - Local-first, offline-capable markdown editing
- **Examples** - Cursor, Windsurf, Positron (all VS Code forks)

---

## Repository Structure

```
/Users/jarmotuisk/Projects/
├── ritemark/              ← Web app (existing, reference only)
├── ritemark-native/       ← This repo - VS Code fork
└── ritemark-shared/       ← Shared packages (future)
```

---

## Key Documentation

**External references (in ritemark repo):**
1. `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/README.md` - Master plan
2. `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md` - Technical spec

---

## Architecture Decisions (Locked)

These decisions are **final** - do not revisit:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| VS Code integration | Git submodule (not fork) | Easy upstream sync |
| Integration point | Custom Editor Provider | Native tab experience |
| Marketplace | Hidden by default | Prevent conflicts |
| Default .md handler | Ritemark WYSIWYG | Core UX |
| Telemetry | Minimal, opt-out | Privacy first |

---

## Development Environment

| Component | Version |
|-----------|---------|
| macOS | 15.5 (Sequoia) |
| Architecture | arm64 (Apple Silicon) |
| Node | v23.0.0 |
| npm | 10.9.0 |
| Python | 3.11.3 |
| Xcode CLI | Installed |

**Build target:** `darwin-arm64`

---

## Team

- **Jarmo** = Product Owner (decisions, testing, approval)
- **Claude** = Engineering (implementation)

**When uncertain → Ask Jarmo**
