# Creation Spec — Sprint 58

Phase 1 deliverable. Defines the new authoring affordances landing in the Agent Library and the editor: per-section `+`, empty-state buttons, new-file flow, frontmatter skeleton, row context menu, and file watcher.

Treat this as the contract for Phases 2–3. Out-of-scope items (test loop, capture, coach, builder, templates) are not addressed here.

---

## 1. Per-section `+` affordance

The Agent Library has visible sections — **AGENTS** and **SKILLS** (and **COMMANDS** if any exist). The `+` lives on each section header.

### 1.1 Layout

- A single 16×16 `+` icon, right-aligned in the section header row, after the section count badge.
- Hover state: faint background, ink-strong glyph color.
- Tooltip: *"New skill"* or *"New agent"* (whichever section).
- Hidden when the active scope tab has zero items in *any* section (the empty state owns the affordance there — see §2).

### 1.2 Behavior

Clicking the `+`:

1. Opens a modal dialog using the existing Ritemark `Dialog` primitive (`webview/src/components/Dialog.tsx`).
2. Modal title: *"New skill"* or *"New agent"* — determined by which section's `+` was clicked.
3. Modal body, in this order:
   - **Name** field — single-line text input, autofocused, placeholder *"e.g. Outline from notes"*.
   - **Scope** — two-option segmented control: *Project (this workspace)* / *User (all projects)*. Defaults to **Project**.
4. Modal actions: **Cancel** / **Create**. *Create* is disabled while the name field is empty or whitespace-only. `Enter` confirms; `Escape` cancels.
5. On **Create**: the file is created at the path derived from name + scope (§3), the modal closes, the file opens in the editor with the **Properties** panel auto-opened, cursor in the **Description** field.
6. On **Cancel** or `Escape`: the modal closes; no file is created.

Modal width follows the standard Ritemark dialog. Single-screen, no tabs, no "advanced" section. The modal collects only the two pieces of information needed to *create* the file; every other field is filled in via the Properties panel after.

### 1.3 Section guard

`+` next to **COMMANDS** is **not shipped** in this sprint. Commands are deprecated upstream in favor of skills; we don't want to encourage authoring them. Existing command files still display, but no creation affordance.

---

## 2. Empty state

When the active scope tab has zero items, the sidebar replaces the file-path instructions with two action buttons.

### 2.1 Layout

```
                  No skills or agents yet

                ┌──────────────┐  ┌──────────────┐
                │  + New skill │  │  + New agent │
                └──────────────┘  └──────────────┘

         Helpers live in {project}/.claude/ — they're just
                       markdown files.
```

- Centered, vertical stack.
- Title: *"No skills or agents yet"* — 13px, ink-strong, 500 weight.
- Two buttons side by side, button variant `secondary`, equal width.
- Footnote: 11px, ink-muted. Path adapts to active scope tab (`.claude/` for project, `~/.claude/` for user).
- No starter-pack pitch in the empty state — the starter pack auto-seeds on first run, so a user only sees the empty state if they explicitly cleared starters or if seeding failed.

### 2.2 Behavior

Each button opens the same modal as the corresponding section `+` (§1.2). The modal's title reflects the type chosen (*"New skill"* / *"New agent"*); the rest of the flow is identical.

---

## 3. New-file flow

Triggered from §1 or §2. Identical for skills and agents apart from directory + extension and frontmatter shape.

### 3.1 File placement

| Scope | Skill path | Agent path |
|---|---|---|
| Project (default) | `{workspace}/.claude/skills/{slug}/SKILL.md` | `{workspace}/.claude/agents/{slug}.md` |
| User | `~/.claude/skills/{slug}/SKILL.md` | `~/.claude/agents/{slug}.md` |

`{slug}` is derived from the user-typed name: lowercase, ASCII, hyphens between words, alphanumerics + hyphens only. *"Outline From Notes!"* → `outline-from-notes`.

### 3.2 Slug collisions

If `{slug}` already exists in the target directory, append `-2`, `-3`, … until free. The display name in the file's frontmatter remains exactly as the user typed it; only the slug is suffixed.

### 3.3 Frontmatter skeleton

The skeleton includes **all known frontmatter fields**, populated with empty strings or sensible defaults. The Properties panel renders every field as a row from creation — the user sees the full schema surface and discovers capabilities (`paths`, `disable-model-invocation`, `effort`, etc.) by seeing them in the panel, not by reading docs.

**Skill** (`SKILL.md`):

```yaml
---
name: {user-typed name}
description: 
when_to_use: 
disable-model-invocation: false
user-invocable: true
arguments: 
allowed-tools: 
paths: 
---

<!-- Plain-language description of WHEN this skill should activate.
     Be specific. Weak descriptions are the #1 reason skills don't trigger.
     Example: "Reformats meeting notes into structured outlines with action items." -->
```

**Agent** (`{slug}.md`):

```yaml
---
name: {user-typed name}
description: 
tools: 
model: 
effort: 
skills: 
memory: 
---

<!-- Plain-language description of what this agent does and when to delegate to it.
     Anthropic does not publish an "agent-creator" guide; refer to
     https://code.claude.com/docs/en/sub-agents.md for the full schema. -->
```

**Tradeoff acknowledged:** the Properties panel will show many empty fields immediately after creation. Users scroll past them and start with `name` + `description`. The benefit outweighs the visual cost: no hidden schema, no surprise capabilities, no "I didn't know I could set that" moments three weeks later.

The existing `AddPropertyMenu.tsx` remains useful for adding *custom* (non-schema) properties beyond what ships in the skeleton.

**Rationale for the comment block:** new files open with the Properties panel active. The body comment is what the user sees if they collapse Properties. It coaches without nagging.

### 3.4 Post-create state

- File is opened in the editor.
- The **Properties** side panel is auto-opened (overrides the user's last-used panel preference for *this* open only — subsequent opens of any other file respect the saved preference).
- Cursor is in the **Description** field of the Properties panel, since `description` is the field most likely to be wrong and the field that controls auto-invocation.

---

## 4. Row context menu

Right-click on any row in the Agent Library opens a native VS Code context menu with these actions, in this order:

| # | Action | Behavior |
|---|---|---|
| 1 | **Open** | Same as left-click. Included for discoverability. |
| 2 | **Duplicate** | Copies the file (or directory, for skills) to a sibling with `-copy` suffix on the slug. Opens the duplicate in the editor with the **Name** field of Properties focused for renaming. |
| 3 | **Reveal in Finder / Explorer** | `vscode.commands.executeCommand('revealFileInOS', uri)`. OS-native label adapts (Finder on macOS, Explorer on Windows). |
| 4 | **Move to User scope** *(when project)* / **Move to Project scope** *(when user)* | `vscode.workspace.fs.rename` to the matching directory in the other scope. Confirmation dialog if a same-named file already exists at the destination. |
| 5 | **Delete…** | `vscode.workspace.fs.delete(uri, { useTrash: true, recursive: true })`. Confirmation dialog beforehand. For project-scope files, the dialog adds: *"This file is part of your project. Teammates who pull this branch will lose access to it."* |

### 4.1 CLAUDE.md guard

The main agent config file (`CLAUDE.md`, marked with the star icon) hides **Delete** and **Duplicate** from its context menu. A `CLAUDE.md` is structural; mass-deleting it via right-click is a footgun. The user can still delete it by opening the file and using the system file manager — we just don't surface the gun.

### 4.2 Skill directories

Skills are directories (`{slug}/SKILL.md`), not single files. Operations apply to the whole directory:

- **Duplicate** copies the entire directory.
- **Move to scope** moves the entire directory.
- **Delete** trashes the entire directory (with `recursive: true`).
- **Reveal in Finder** reveals `SKILL.md` inside the directory (matches user expectation when they clicked on the row).

---

## 5. File watcher

Discovery currently runs only on view-mount and explicit refresh. This sprint adds live refresh.

### 5.1 Workspace watcher

- `vscode.workspace.createFileSystemWatcher('{workspace}/.claude/{agents,skills,commands}/**/*.md')`.
- Wire `onDidCreate`, `onDidChange`, `onDidDelete` → `agentLibraryViewProvider.refresh()`.

### 5.2 User-home watcher

`~/.claude/` is *outside* the workspace, so VS Code's workspace watcher won't catch it. Use `fs.watch(homedir + '/.claude', { recursive: true })` and re-trigger discovery on any event.

Caveat: `fs.watch` recursive mode is not supported on all Linux distributions. If `recursive: true` throws, fall back to polling (`setInterval` re-discovery every 5 seconds) — only when the Agent Library view is visible.

### 5.3 Debounce

Bursts of filesystem events (e.g. `git pull` updating ten files) should not produce ten re-discoveries. Debounce refresh to 200 ms.

### 5.4 Disposal

Both watchers register in `extension.ts` as part of `agentLibraryViewProvider` lifecycle. Disposed when the view is disposed.

---

## 6. Tests

This sprint must add unit tests for:

- Slug derivation (`"Outline From Notes!"` → `outline-from-notes`; non-ASCII handled; collision suffixing works).
- Frontmatter skeleton generation (skill vs agent shapes).
- Discovery → re-discovery on file watcher event.

UI behavior (inline-edit row, context menu) is covered by manual smoke test against the build, not automated.

---

## 7. Out of scope (cross-reference to sprint-plan §"Out of Scope")

This spec does **not** define:

- The *Try it* test loop in Properties (deferred).
- Capture-from-conversation flows (deferred).
- Description-quality coach UI (largely obviated by `skill-creator` in starter pack).
- Template chooser, builder agent, share/install-from-URL.

If any of those leak into PRs against this sprint, reject and reroute to a future sprint.
