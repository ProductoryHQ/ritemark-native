---
name: frontmatter-cleanup
description: Inspects YAML frontmatter in a markdown file (skill, agent, or generic document) for missing required fields and weak descriptions, then proposes specific fixes without modifying the file. Use before sharing a file, before committing a new agent or skill, or whenever the user asks to clean up, audit, or check frontmatter.
---

# Frontmatter Cleanup

Audit the YAML frontmatter at the top of the current document. Report what's missing, what's weak, and what to change.

## Process

1. Parse the frontmatter (everything between the leading `---` markers).
2. Identify document type by content and surrounding directory:
   - Inside `.claude/agents/` → agent. Required: `name`, `description`. Common: `tools`, `model`.
   - `SKILL.md` inside `.claude/skills/` → skill. Required: `name`, `description`. Common: `paths`, `disable-model-invocation`.
   - Other markdown → generic. Recommend `name` and `description` only if present at all. Do not invent a schema for documents that don't have one.
3. Score each field:
   - **Missing** — required field absent → flag as blocker.
   - **Weak description** — vague, generic, or doesn't name a *trigger condition*. Flag with a suggested rewrite.
   - **Unknown field** — preserve. Don't delete user-specific fields. Just note them.

## What "weak" means

A weak description starts with *"Helps with…"*, *"For…"*, or names a category without conditions. A strong description names a trigger condition: *"Reformats meeting notes into outlines. Use when the input is bulletless prose."*

## Output format

Three sections:

1. **Blockers** — required fields missing.
2. **Improvements** — weak fields with suggested rewrites.
3. **Unknown** — non-schema fields, preserved as-is.

Do not modify the file. Propose changes; let the user accept.

---

# Provenance

Ships with Ritemark Native as part of the first-run starter pack. File location: `~/.claude/skills/frontmatter-cleanup/SKILL.md`. Edit freely.
