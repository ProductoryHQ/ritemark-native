# Starter Pack — Sprint 56

Phase 1 deliverable. Defines what ships pre-installed under `~/.claude/` on first run, where those files live in the Ritemark repo, the licensing/vendoring strategy, and how upstream updates are tracked.

---

## 1. What ships

Four items, deliberately small. The cap is 5; we sit at 4 to leave room for one team-vetted addition without breaching the cap.

| # | Item | Type | Source | Why this one |
|---|---|---|---|---|
| 1 | **skill-creator** *(anchor)* | Skill (with sub-agents) | [anthropics/skills/skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Meta-skill for authoring skills. Interviews the user, writes SKILL.md, ships its own evaluation sub-agents (`analyzer.md`, `comparator.md`, `grader.md`) for empirical quality testing. Largely obviates our deferred Builder-agent and description-coach work. |
| 2 | **outline-from-notes** | Skill | Ritemark-authored | Writer-focused, demonstrates a typical Ritemark use case (turn raw notes into structured outline). Teaches the description pattern that `skill-creator` advocates. |
| 3 | **frontmatter-cleanup** | Skill | Ritemark-authored | Reflexive — the helper improves the same kind of file the user is now authoring. Demonstrates how a skill can act on the *current document*. Useful self-referentially because every starter we ship has frontmatter. |
| 4 | **document-reviewer** | Agent | Ritemark-authored | One agent so the **Agents** section isn't empty on first run. Reads the current document and surfaces inconsistencies, weak passages, and structural issues. The "delegate to a reviewer" pattern, made concrete. |

### 1.1 Why these specifically

- **The anchor is non-negotiable.** It's the only one that actively helps the user create more.
- **Two skill exemplars** show what a *good* skill looks like by example, with descriptions written the way `skill-creator` advocates. They are short on purpose — long exemplars become walls of opaque prose users won't read.
- **One agent exemplar** is the minimum to demonstrate the agent type and to populate the AGENTS list. We deliberately don't ship a generic "researcher" agent — too vague, won't trigger well, would teach the wrong lesson about descriptions.
- **No release-notes drafter, todo-extractor, shorten-this, or tone-changer.** Tempting, but each is a marketing-shaped curation choice and we said "no premature curation." Ship four; let usage signal what's next.

---

## 2. Repo layout

Vendor the starters at a stable path inside the extension:

```
extensions/ritemark/starter-pack/
├── README.md                       # Provenance, version pins, update procedure
├── VERSIONS.md                     # Pinned upstream commit hashes per item
├── skills/
│   ├── skill-creator/              # Snapshot of anthropics/skills/skill-creator
│   │   ├── SKILL.md
│   │   └── agents/
│   │       ├── analyzer.md
│   │       ├── comparator.md
│   │       └── grader.md
│   ├── outline-from-notes/
│   │   └── SKILL.md
│   └── frontmatter-cleanup/
│       └── SKILL.md
└── agents/
    └── document-reviewer.md
```

This mirrors the layout of the destination directory (`~/.claude/{skills,agents}/`), so seeding is a recursive copy with no path translation.

---

## 3. Licensing & vendoring

### 3.1 skill-creator (the anchor) — outstanding work

**Action item before implementation:** confirm the LICENSE on `anthropics/skills` permits redistribution as part of an installer. The repo is public and Anthropic's stated intent is that these skills be reused, but "public on GitHub" ≠ "free to redistribute in a downstream product." Phase 1 task: read the LICENSE and confirm.

**Two contingencies:**

- **If LICENSE permits redistribution:** snapshot at a pinned commit, vendor under `extensions/ritemark/starter-pack/skills/skill-creator/`. Track the commit hash in `VERSIONS.md`. Ship.
- **If LICENSE does not permit redistribution:** fall back to a *first-run install prompt* — empty state shows a one-click button *"Install starter pack from anthropics/skills"* that runs `claude plugins install` (if available) or shells out to `git clone` into `~/.claude/`. Network required at install time, not at runtime. Same final user experience, different distribution mechanism.

The sprint plan and creation-spec assume the first contingency. If we land on the second, the empty state copy and seed timing change but nothing else does.

### 3.2 Ritemark-authored starters

`outline-from-notes`, `frontmatter-cleanup`, `document-reviewer` are written by the team for this sprint. Licensed identically to Ritemark itself (presumably MIT or whatever the parent project uses — confirm in Phase 1 against `LICENSE` at repo root). No external dependency.

### 3.3 Vendoring strategy: snapshot, not fetch

We snapshot at pinned commits and vendor the files. We do not fetch from GitHub on first run.

**Why snapshot:**

- Ritemark is local-first. First-run network dependency would break the offline-install promise on the website.
- A pinned commit means a user's experience is reproducible — installer X gives skill-creator vY, always.
- Upstream churn on `skill-creator` (sub-agents added/removed, description tweaked) won't surprise users between Ritemark releases.

**Why not fetch:**

- Network failures on first run produce an empty starter pack — worse first impression than a slightly-stale starter pack.
- `git clone`-on-activation introduces an attack surface (someone tampers with anthropics/skills, all our users get it next launch). Snapshot means the security posture is reviewed at vendor-update time.

### 3.4 Update procedure

Manual, scripted. `scripts/sync-starter-pack.sh` (Phase 2 deliverable) does:

1. `git clone` `anthropics/skills` to a temp directory.
2. Diff the current vendored `starter-pack/skills/skill-creator/` against upstream.
3. If differences exist, emit a unified diff to stdout. Human review required.
4. If reviewer approves, copy upstream files into the vendor directory and update `VERSIONS.md` with the new commit hash.
5. Commit the update on a branch with the diff in the commit body for PR review.

No auto-sync, no CI-driven sync. Updates are a deliberate maintenance act, scheduled with VS Code upstream syncs.

---

## 4. First-run seeding

### 4.1 Trigger

On extension activation, after the Agent Library view registers but before its first discovery pass.

### 4.2 Detection logic

A user is "first-run" if **all** of the following are true:

- `~/.claude/skills/` does not exist OR is empty.
- `~/.claude/agents/` does not exist OR is empty.
- `~/.ritemark/starter-pack-seeded` (a marker file) does not exist.

The third condition is the durable signal. Even if a user clears their `~/.claude/` later, we don't re-seed — the marker file is the source of truth that we've seeded once. The user has explicitly opted into an empty library and we respect that.

### 4.3 Seed action

If first-run is detected:

1. `mkdir -p ~/.claude/skills/`, `mkdir -p ~/.claude/agents/`.
2. Recursive copy `extensions/ritemark/starter-pack/skills/*` → `~/.claude/skills/`.
3. Recursive copy `extensions/ritemark/starter-pack/agents/*` → `~/.claude/agents/`.
4. `mkdir -p ~/.ritemark/`, write `~/.ritemark/starter-pack-seeded` with the timestamp and the starter-pack version (read from `VERSIONS.md`).

### 4.4 Idempotency & failure

- If any copy step fails (permission denied, disk full), abort the whole seed and do not write the marker file. Log to extension output channel. Next activation re-tries.
- If the marker file exists but `~/.claude/` is empty, we've seeded before and the user has cleared it. Do not re-seed.
- Never overwrite an existing file in `~/.claude/`. If a user has a `skill-creator` of their own, ours is silently skipped (their copy wins).

### 4.5 No telemetry, no nag

We do not telemetry-report seed events. We do not show a toast. The user opens the Agent Library and the starters are there. That's the whole UX.

---

## 5. Version tracking

`VERSIONS.md` at the root of the starter pack. Format:

```markdown
# Starter Pack Versions

Last synced: YYYY-MM-DD by <author>

| Item | Source | Pinned commit |
|---|---|---|
| skill-creator | anthropics/skills | <40-char SHA> |
| outline-from-notes | (Ritemark-authored, this repo) | n/a |
| frontmatter-cleanup | (Ritemark-authored, this repo) | n/a |
| document-reviewer | (Ritemark-authored, this repo) | n/a |
```

Update on every sync. Reviewers checking PRs that touch the starter pack should compare the SHA against upstream's HEAD before approving.

---

## 6. Ritemark-authored starters: minimum bar

Each Ritemark-authored starter (`outline-from-notes`, `frontmatter-cleanup`, `document-reviewer`) must:

1. Have a `description` field that follows `skill-creator`'s "be a little pushy" guidance — concrete trigger conditions, not generic prose.
2. Be under 50 lines of body content. Starters teach by example; long bodies discourage reading.
3. Carry a `# Provenance` section in the body footer noting that it ships with Ritemark and pointing the user at the file location for editing.

These three constraints exist so the starters remain *exemplary* — when a user reads them after running `/skill-creator`, they should reinforce the lessons skill-creator taught.

The actual prompt text of each starter is **not** specified in this doc. That's content work, drafted in Phase 2 alongside implementation. The drafts are reviewed against the three constraints above before merge.

---

## 7. Out of scope

- Marketplace UI / browser inside Ritemark.
- Updating starters silently on app update.
- Per-starter telemetry.
- A "restore default starters" command.
- Localization of starter content.

All of the above are reasonable future work but not for Sprint 56.
