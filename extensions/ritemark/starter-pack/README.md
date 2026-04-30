# Starter Pack

This directory ships pre-installed helpers that get seeded into `~/.claude/` on first run when the user has no existing skills or agents. Behavior is specified in [`docs/development/sprints/sprint-56-agent-authoring-loop/starter-pack.md`](../../../docs/development/sprints/sprint-56-agent-authoring-loop/starter-pack.md).

## What ships

| Path | Type | Source |
|---|---|---|
| `skills/skill-creator/` | Skill (with sub-agents) | Vendored from [anthropics/skills](https://github.com/anthropics/skills), Apache-2.0 |
| `skills/outline-from-notes/` | Skill | Ritemark-authored |
| `skills/frontmatter-cleanup/` | Skill | Ritemark-authored |
| `agents/document-reviewer.md` | Agent | Ritemark-authored |

## Layout

```
starter-pack/
├── README.md                  (this file)
├── VERSIONS.md                Pinned upstream commit hashes
├── skills/
│   ├── skill-creator/         (vendored verbatim — do not modify)
│   ├── outline-from-notes/
│   └── frontmatter-cleanup/
└── agents/
    └── document-reviewer.md
```

## Vendoring rules

- **`skill-creator` is vendored verbatim from `anthropics/skills`.** Do not edit any file inside `skills/skill-creator/`. Apache-2.0 requires that any modifications carry prominent notices; the cleanest posture is a pristine snapshot.
- The pinned commit hash is recorded in `VERSIONS.md`.
- `LICENSE.txt` inside `skill-creator/` must be preserved.

## Update procedure

When a sync from upstream is desired:

```bash
# (Phase 2 deliverable — not yet scripted)
git clone --depth 1 https://github.com/anthropics/skills.git /tmp/anthropics-skills
diff -r extensions/ritemark/starter-pack/skills/skill-creator/ /tmp/anthropics-skills/skills/skill-creator/
# Human review of the diff. If approved:
rm -rf extensions/ritemark/starter-pack/skills/skill-creator
cp -R /tmp/anthropics-skills/skills/skill-creator extensions/ritemark/starter-pack/skills/
# Update VERSIONS.md with new SHA
# Commit with the diff in the commit body for PR review
```

No CI-driven sync. Updates are deliberate maintenance, scheduled with VS Code upstream syncs.

## First-run seeding

Implemented in `extensions/ritemark/src/extension.ts` (Phase 3 deliverable). Triggered when:

- `~/.claude/skills/` and `~/.claude/agents/` are both empty or absent, AND
- `~/.ritemark/starter-pack-seeded` does not exist.

Seeding never overwrites user files; if a user has their own `skill-creator` already, ours is silently skipped.
