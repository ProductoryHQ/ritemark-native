/**
 * Agent & Command Discovery
 *
 * Scans .claude/agents/, .claude/commands/, and .claude/skills/
 * to dynamically discover available sub-agents and custom slash commands.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ColorName, IconName, resolveIconAndColor } from './iconPack';

export type ItemScope = 'project' | 'user';

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  filePath: string;
  scope: ItemScope;
  hasFrontmatter: boolean;
  isMainAgent: boolean;
  modifiedAt: number;
  icon: IconName;
  color: ColorName;
}

export interface DiscoveredCommand {
  id: string;
  name: string;
  description: string;
  source: 'commands' | 'skills';
  filePath: string;
  scope: ItemScope;
  hasFrontmatter: boolean;
  modifiedAt: number;
  icon: IconName;
  color: ColorName;
}

function safeMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Extracts simple key: value pairs between --- markers.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  const lines = match[1].split('\n').map(l => l.replace(/\r$/, ''));
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
      if (currentValue === '>' || currentValue === '>-' || currentValue === '|' || currentValue === '|-') {
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
 * Check if a file is a main agent config (CLAUDE.md or AGENTS.md).
 */
function isClaudeMd(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return base === 'claude.md' || base === 'agents.md';
}

/**
 * Check if content has valid YAML frontmatter (between --- markers).
 */
function hasFrontmatterBlock(content: string): boolean {
  return /^---\s*\n[\s\S]*?\n---/.test(content);
}

/**
 * Scan a single .claude/ root for agent definitions.
 * Looks in .claude/agents/ for .md files and also checks for CLAUDE.md at the root.
 */
function discoverAgentsInRoot(claudeRoot: string, scope: ItemScope): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];

  // Check for CLAUDE.md and AGENTS.md at the parent (project root or home dir)
  const parentDir = path.dirname(claudeRoot);
  for (const fileName of ['CLAUDE.md', 'AGENTS.md']) {
    const mdPath = path.join(parentDir, fileName);
    if (!fs.existsSync(mdPath)) continue;
    try {
      const content = fs.readFileSync(mdPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const id = fileName.replace('.md', '');
      const description = frontmatter.description || 'Main agent configuration';
      const { icon, color } = resolveIconAndColor(frontmatter, fileName, description, true);
      agents.push({
        id,
        name: fileName,
        description,
        filePath: mdPath,
        scope,
        hasFrontmatter: hasFrontmatterBlock(content),
        isMainAgent: true,
        modifiedAt: safeMtime(mdPath),
        icon,
        color,
      });
    } catch {
      // Skip
    }
  }

  const agentsDir = path.join(claudeRoot, 'agents');
  if (!fs.existsSync(agentsDir)) return agents;

  try {
    const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const filePath = path.join(agentsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const hasFm = hasFrontmatterBlock(content);
        const frontmatter = parseFrontmatter(content);
        const id = frontmatter.name || path.basename(file, '.md');
        const name = toDisplayName(id);
        const description = frontmatter.description || '';
        const isMain = isClaudeMd(filePath);
        const { icon, color } = resolveIconAndColor(frontmatter, name, description, isMain);

        agents.push({
          id,
          name,
          description,
          filePath,
          scope,
          hasFrontmatter: hasFm && !!description,
          isMainAgent: isMain,
          modifiedAt: safeMtime(filePath),
          icon,
          color,
        });
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Directory not readable
  }

  return agents;
}

/**
 * Scan both workspace and user-level .claude/agents/ for agent definitions.
 */
export function discoverAgents(workspacePath: string | undefined): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];
  const seen = new Set<string>();

  const addAgents = (discovered: DiscoveredAgent[]) => {
    for (const agent of discovered) {
      if (!seen.has(agent.id)) {
        seen.add(agent.id);
        agents.push(agent);
      }
    }
  };

  if (workspacePath) {
    addAgents(discoverAgentsInRoot(path.join(workspacePath, '.claude'), 'project'));
    addAgents(discoverAgentsInRoot(path.join(workspacePath, '.agents'), 'project'));
  }

  const userClaude = path.join(os.homedir(), '.claude');
  if (fs.existsSync(userClaude)) {
    addAgents(discoverAgentsInRoot(userClaude, 'user'));
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan a single .claude/ root for commands and skills.
 */
function discoverCommandsInRoot(claudeRoot: string, scope: ItemScope): DiscoveredCommand[] {
  const commands: DiscoveredCommand[] = [];

  // Scan .claude/commands/*.md
  const commandsDir = path.join(claudeRoot, 'commands');
  if (fs.existsSync(commandsDir)) {
    try {
      const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        try {
          const filePath = path.join(commandsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const hasFm = hasFrontmatterBlock(content);
          const frontmatter = parseFrontmatter(content);
          const id = frontmatter.name || path.basename(file, '.md');
          const displayName = toDisplayName(id);
          const description = frontmatter.description || extractFirstLine(content);
          const { icon, color } = resolveIconAndColor(frontmatter, displayName, description);

          commands.push({
            id,
            name: displayName,
            description,
            source: 'commands',
            filePath,
            scope,
            hasFrontmatter: hasFm && !!(frontmatter.description),
            modifiedAt: safeMtime(filePath),
            icon,
            color,
          });
        } catch {
          // Skip
        }
      }
    } catch {
      // Directory not readable
    }
  }

  // Scan .claude/skills/*/SKILL.md
  const skillsDir = path.join(claudeRoot, 'skills');
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
          const hasFm = hasFrontmatterBlock(content);
          const frontmatter = parseFrontmatter(content);
          const id = frontmatter.name || dir;

          if (frontmatter['user-invocable'] === 'false') continue;

          const displayName = toDisplayName(id);
          const description = frontmatter.description || extractFirstLine(content);
          const { icon, color } = resolveIconAndColor(frontmatter, displayName, description);

          commands.push({
            id,
            name: displayName,
            description,
            source: 'skills',
            filePath: skillFile,
            scope,
            hasFrontmatter: hasFm && !!(frontmatter.description),
            modifiedAt: safeMtime(skillFile),
            icon,
            color,
          });
        } catch {
          // Skip
        }
      }
    } catch {
      // Directory not readable
    }
  }

  return commands;
}

/**
 * Scan both workspace and user-level .claude/ for commands and skills.
 */
export function discoverCommands(workspacePath: string | undefined): DiscoveredCommand[] {
  const commands: DiscoveredCommand[] = [];
  const seen = new Set<string>();

  const addCommands = (discovered: DiscoveredCommand[]) => {
    for (const cmd of discovered) {
      if (!seen.has(cmd.id)) {
        seen.add(cmd.id);
        commands.push(cmd);
      }
    }
  };

  if (workspacePath) {
    addCommands(discoverCommandsInRoot(path.join(workspacePath, '.claude'), 'project'));
    addCommands(discoverCommandsInRoot(path.join(workspacePath, '.agents'), 'project'));
  }

  const userClaude = path.join(os.homedir(), '.claude');
  if (fs.existsSync(userClaude)) {
    addCommands(discoverCommandsInRoot(userClaude, 'user'));
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
