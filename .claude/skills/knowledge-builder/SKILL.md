---
name: knowledge-builder
description: Meta-skill for creating new Claude Code skills and agents. Use when you need to systematize knowledge, create reusable capabilities, or build new agents/skills. Helps structure accumulated knowledge into properly formatted skills and agents.
version: 1.0.0
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
---

# Knowledge Builder

A meta-skill for creating and managing Claude Code skills and agents.

## Overview

This skill helps you:
1. Research and accumulate domain knowledge
2. Structure knowledge into reusable skills
3. Create specialized agents for specific tasks
4. Maintain and update existing skills/agents

## Creating a New Skill

### Step 1: Research Phase
- Use WebSearch/WebFetch to gather authoritative information
- Read existing codebase patterns
- Document findings before structuring

### Step 2: Create Skill Directory
```
.claude/skills/<skill-name>/
├── SKILL.md          # Required: Main skill file with frontmatter
├── REFERENCE.md      # Optional: Detailed reference docs
├── EXAMPLES.md       # Optional: Usage examples
└── scripts/          # Optional: Helper scripts
```

### Step 3: SKILL.md Template
```markdown
---
name: skill-name-lowercase-with-hyphens
description: Clear description of WHAT it does AND WHEN to use it. Max 1024 chars. Be specific - discovery depends on this!
version: 1.0.0
allowed-tools: Read, Grep, Glob  # Optional: restrict tools
disable-model-invocation: false   # Optional: require manual invocation
---

# Skill Name

## Overview
What this skill provides.

## When to Use
- Specific trigger scenarios
- Keywords that should activate this skill

## Instructions
Step-by-step guidance for Claude.

## Key Knowledge
Domain-specific information organized logically.

## Common Patterns
Frequently used solutions.

## Troubleshooting
Known issues and solutions.

## References
- External documentation links
- Related files in codebase
```

### Step 4: Validate
- Description must clearly state WHAT and WHEN
- Test discovery by asking related questions
- Verify tool restrictions work as intended

## Creating a New Agent

### Step 1: Define Specialization
- What specific role does this agent fill?
- What tools does it need (minimum necessary)?
- Should it be proactive or on-demand?

### Step 2: Create Agent File
Location: `.claude/agents/<agent-name>.md`

### Step 3: Agent Template
```markdown
---
name: agent-name-lowercase
description: Detailed description. Include "PROACTIVELY" if it should auto-invoke. Include specific trigger phrases. Max 1024 chars.
tools: Read, Grep, Glob, Edit, Write, Bash  # Only what's needed
model: sonnet  # or opus, haiku, inherit
priority: normal  # or high, low
---

You are a [ROLE] specialist. Your expertise includes:

1. [Core competency 1]
2. [Core competency 2]
3. [Core competency 3]

## Your Responsibilities
- [Responsibility 1]
- [Responsibility 2]

## How You Work
1. [Step 1]
2. [Step 2]

## Guidelines
- [Guideline 1]
- [Guideline 2]

## Output Format
[How to structure responses]
```

## Storage Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.claude/skills/` | Project | Higher (overrides user) |
| `~/.claude/skills/` | User global | Lower |
| `.claude/agents/` | Project | Higher |
| `~/.claude/agents/` | User global | Lower |

## Best Practices

### For Skills
1. **Progressive disclosure**: Split large docs into REFERENCE.md, EXAMPLES.md
2. **Clear triggers**: Description determines discovery - be specific
3. **Minimal tools**: Only grant tools actually needed
4. **Version tracking**: Use semantic versioning, add changelog

### For Agents
1. **Single responsibility**: One agent = one specialty
2. **Least privilege**: Only grant necessary tools
3. **Clear persona**: Define role and expertise clearly
4. **Proactive vs passive**: Use "PROACTIVELY" in description for auto-invoke

### Knowledge Organization
1. **Capture immediately**: Document learnings as you discover them
2. **Structure logically**: Group by topic, not chronology
3. **Include examples**: Real examples > abstract explanations
4. **Link related**: Reference related skills/agents/docs
5. **Update regularly**: Knowledge decays - keep it current

## Workflow: Building Knowledge from Research

```
1. Research (WebSearch, WebFetch, Read)
   └── Document findings in scratch notes

2. Identify patterns
   └── What problems recur? What solutions work?

3. Structure as skill
   └── Create SKILL.md with organized knowledge

4. Create supporting agent (if needed)
   └── Specialized agent that uses the skill

5. Test and iterate
   └── Use it, find gaps, improve
```

## Example: Creating a "React Best Practices" Skill

```bash
# 1. Create structure
mkdir -p .claude/skills/react-best-practices

# 2. Create SKILL.md with research findings
# 3. Add REFERENCE.md for detailed patterns
# 4. Optionally create react-developer.md agent
```

## Maintenance

### Updating Skills
1. Read current SKILL.md
2. Add new knowledge to appropriate section
3. Bump version number
4. Update changelog if present

### Deprecating
1. Add `deprecated: true` to frontmatter
2. Add deprecation notice with replacement info
3. Remove after transition period
