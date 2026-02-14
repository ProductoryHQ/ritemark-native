/**
 * Agent & Command Discovery
 *
 * Scans .claude/agents/, .claude/commands/, and .claude/skills/
 * to dynamically discover available sub-agents and custom slash commands.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
}

export interface DiscoveredCommand {
  id: string;
  name: string;
  description: string;
  source: 'commands' | 'skills';
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Extracts simple key: value pairs between --- markers.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let currentValue = '';

  for (const line of lines) {
    // Check for key: value pair
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      // Save previous key if exists
      if (currentKey) {
        result[currentKey] = currentValue.trim();
      }
      currentKey = kvMatch[1];
      currentValue = kvMatch[2].trim();
      // Handle multi-line value indicator (>)
      if (currentValue === '>') {
        currentValue = '';
      }
    } else if (currentKey && line.match(/^\s+/)) {
      // Continuation of multi-line value
      currentValue += (currentValue ? ' ' : '') + line.trim();
    }
  }
  // Save last key
  if (currentKey) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}

/**
 * Convert a filename or frontmatter name to a display name.
 * e.g. "sprint-manager" -> "Sprint Manager"
 */
function toDisplayName(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Scan .claude/agents/ for sub-agent definitions.
 */
export function discoverAgents(workspacePath: string): DiscoveredAgent[] {
  const agentsDir = path.join(workspacePath, '.claude', 'agents');
  if (!fs.existsSync(agentsDir)) return [];

  const agents: DiscoveredAgent[] = [];

  try {
    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const id = frontmatter.name || path.basename(file, '.md');
        const name = toDisplayName(id);
        const description = frontmatter.description || '';

        agents.push({ id, name, description });
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Directory not readable
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan .claude/commands/ and .claude/skills/ for custom slash commands.
 */
export function discoverCommands(workspacePath: string): DiscoveredCommand[] {
  const commands: DiscoveredCommand[] = [];
  const seen = new Set<string>();

  // Scan .claude/commands/*.md
  const commandsDir = path.join(workspacePath, '.claude', 'commands');
  if (fs.existsSync(commandsDir)) {
    try {
      const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
          const frontmatter = parseFrontmatter(content);
          const id = frontmatter.name || path.basename(file, '.md');

          if (!seen.has(id)) {
            seen.add(id);
            commands.push({
              id,
              name: toDisplayName(id),
              description: frontmatter.description || extractFirstLine(content),
              source: 'commands',
            });
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Directory not readable
    }
  }

  // Scan .claude/skills/*/SKILL.md
  const skillsDir = path.join(workspacePath, '.claude', 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      const dirs = fs.readdirSync(skillsDir).filter((d) => {
        try {
          return fs.statSync(path.join(skillsDir, d)).isDirectory();
        } catch {
          return false;
        }
      });
      for (const dir of dirs) {
        try {
          const skillFile = path.join(skillsDir, dir, 'SKILL.md');
          if (!fs.existsSync(skillFile)) continue;

          const content = fs.readFileSync(skillFile, 'utf-8');
          const frontmatter = parseFrontmatter(content);
          const id = frontmatter.name || dir;

          // Skills with user-invocable: false should be hidden
          if (frontmatter['user-invocable'] === 'false') continue;

          if (!seen.has(id)) {
            seen.add(id);
            commands.push({
              id,
              name: toDisplayName(id),
              description: frontmatter.description || extractFirstLine(content),
              source: 'skills',
            });
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Directory not readable
    }
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract first meaningful line from markdown content (skipping frontmatter).
 */
function extractFirstLine(content: string): string {
  // Remove frontmatter
  const withoutFm = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  const lines = withoutFm.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return lines[0]?.trim().substring(0, 100) || '';
}
