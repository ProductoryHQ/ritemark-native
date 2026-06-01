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
  // Extended frontmatter fields (Phase 1, R4)
  runtime?: string;
  runtimeModel?: string;
  schedule?: string;
  routine?: string;
  skills?: string[];
  allowedTools?: string[];
  worktree?: boolean;
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
  provenance?: 'claude' | 'codex' | 'shared'; // only set for source: 'skills'
}

function safeMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

export type FrontmatterValue = string | string[] | number | boolean;
export type FrontmatterRecord = Record<string, FrontmatterValue>;

/**
 * Parse YAML frontmatter from a markdown file.
 * Handles: simple key: value, inline arrays [a, b], multi-line lists (- item),
 * numbers, booleans, and quoted strings.
 */
function parseFrontmatter(content: string): FrontmatterRecord {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: FrontmatterRecord = {};
  const lines = match[1].split('\n').map(l => l.replace(/\r$/, ''));
  let currentKey = '';
  let currentListItems: string[] | null = null;
  let currentValue = '';

  const commitCurrent = () => {
    if (!currentKey) return;
    if (currentListItems !== null) {
      result[currentKey] = currentListItems;
    } else {
      result[currentKey] = coerceValue(currentValue.trim());
    }
    currentKey = '';
    currentListItems = null;
    currentValue = '';
  };

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      commitCurrent();
      currentKey = kvMatch[1];
      const raw = kvMatch[2].trim();
      if (raw === '' || raw === '>' || raw === '>-' || raw === '|' || raw === '|-') {
        currentValue = '';
        currentListItems = null;
      } else if (raw.startsWith('[') && raw.endsWith(']')) {
        // Inline array: [a, b, c]
        currentListItems = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        commitCurrent();
      } else {
        currentValue = raw;
        currentListItems = null;
      }
    } else if (currentKey && /^\s+-\s+/.test(line)) {
      // Multi-line list item
      if (currentListItems === null) currentListItems = [];
      currentListItems.push(line.replace(/^\s+-\s+/, '').trim());
    } else if (currentKey && /^\s+/.test(line)) {
      // Continuation of scalar value
      currentValue += (currentValue ? ' ' : '') + line.trim();
    }
  }
  commitCurrent();

  return result;
}

function coerceValue(raw: string): FrontmatterValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (raw !== '' && !isNaN(num)) return num;
  // Strip surrounding quotes
  return raw.replace(/^['"]|['"]$/g, '');
}

/** Extract a string value from a FrontmatterRecord, or undefined. */
function fmStr(fm: FrontmatterRecord, key: string): string | undefined {
  const v = fm[key];
  return typeof v === 'string' ? v : undefined;
}

/** Extract a string[] value from a FrontmatterRecord, or undefined. */
function fmStrArr(fm: FrontmatterRecord, key: string): string[] | undefined {
  const v = fm[key];
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string' && v) return [v];
  return undefined;
}

/** Extract a boolean value from a FrontmatterRecord, or undefined. */
function fmBool(fm: FrontmatterRecord, key: string): boolean | undefined {
  const v = fm[key];
  return typeof v === 'boolean' ? v : undefined;
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
 * Resolve the display name for an item using (in priority order):
 *   1. Explicit `displayName` frontmatter field — used as-is
 *   2. `name` frontmatter, when it looks like a real display name
 *      (contains a space or any uppercase letter — e.g. "UX Expert")
 *   3. Fallback: title-case the kebab `name` or filename slug
 *      ("sprint-manager" -> "Sprint Manager")
 *
 * This preserves acronyms and branded casing without forcing every existing
 * agent file (which all use kebab-case `name`) to be rewritten.
 */
function resolveDisplayName(frontmatter: FrontmatterRecord, slug: string): string {
  const explicit = fmStr(frontmatter, 'displayName')?.trim();
  if (explicit) return explicit;

  const fmName = fmStr(frontmatter, 'name')?.trim();
  if (fmName && (/\s/.test(fmName) || /[A-Z]/.test(fmName))) {
    return fmName;
  }

  return toDisplayName(fmName || slug);
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
      const fm = parseFrontmatter(content);
      const id = fileName.replace('.md', '');
      const description = fmStr(fm, 'description') || 'Main agent configuration';
      const { icon, color } = resolveIconAndColor(fm, fileName, description, true);
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
        const fm = parseFrontmatter(content);
        const slug = path.basename(file, '.md');
        const id = fmStr(fm, 'name') || slug;
        const name = resolveDisplayName(fm, slug);
        const description = fmStr(fm, 'description') || '';
        const isMain = isClaudeMd(filePath);
        const { icon, color } = resolveIconAndColor(fm, name, description, isMain);

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
          runtime: fmStr(fm, 'runtime'),
          runtimeModel: fmStr(fm, 'model'),
          schedule: fmStr(fm, 'schedule'),
          routine: fmStr(fm, 'routine'),
          skills: fmStrArr(fm, 'skills'),
          allowedTools: fmStrArr(fm, 'allowedTools'),
          worktree: fmBool(fm, 'worktree'),
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
    // .agents/ has no agents/ sub-directory convention — skills only (via discoverCommands)
  }

  const userClaude = path.join(os.homedir(), '.claude');
  if (fs.existsSync(userClaude)) {
    addAgents(discoverAgentsInRoot(userClaude, 'user'));
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan a single root for commands and skills.
 * framework: 'claude' for .claude/ roots, 'codex' for .agents/ roots.
 */
function discoverCommandsInRoot(
  claudeRoot: string,
  scope: ItemScope,
  framework: 'claude' | 'codex' = 'claude'
): DiscoveredCommand[] {
  const commands: DiscoveredCommand[] = [];

  // Scan commands/*.md (claude framework only — no Codex commands convention)
  if (framework === 'claude') {
    const commandsDir = path.join(claudeRoot, 'commands');
    if (fs.existsSync(commandsDir)) {
      try {
        const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
          try {
            const filePath = path.join(commandsDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const hasFm = hasFrontmatterBlock(content);
            const fm = parseFrontmatter(content);
            const slug = path.basename(file, '.md');
            const id = fmStr(fm, 'name') || slug;
            const displayName = resolveDisplayName(fm, slug);
            const description = fmStr(fm, 'description') || extractFirstLine(content);
            const { icon, color } = resolveIconAndColor(fm, displayName, description);

            commands.push({
              id,
              name: displayName,
              description,
              source: 'commands',
              filePath,
              scope,
              hasFrontmatter: hasFm && !!fmStr(fm, 'description'),
              modifiedAt: safeMtime(filePath),
              icon,
              color,
              // provenance is intentionally omitted for commands
            });
          } catch {
            // Skip
          }
        }
      } catch {
        // Directory not readable
      }
    }
  }

  // Scan skills/*/SKILL.md
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
          const fm = parseFrontmatter(content);
          const id = fmStr(fm, 'name') || dir;

          if (fm['user-invocable'] === false || fmStr(fm, 'user-invocable') === 'false') continue;

          const displayName = resolveDisplayName(fm, dir);
          const description = fmStr(fm, 'description') || extractFirstLine(content);
          const { icon, color } = resolveIconAndColor(fm, displayName, description);

          commands.push({
            id,
            name: displayName,
            description,
            source: 'skills',
            filePath: skillFile,
            scope,
            hasFrontmatter: hasFm && !!fmStr(fm, 'description'),
            modifiedAt: safeMtime(skillFile),
            icon,
            color,
            provenance: framework,
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
 * Skills present in both .claude/skills/ and .agents/skills/ are merged into
 * a single entry with provenance 'shared'.
 */
export function discoverCommands(workspacePath: string | undefined): DiscoveredCommand[] {
  // Collect commands (no dedup needed — no Codex equivalent)
  const commandList: DiscoveredCommand[] = [];
  // Collect skills separately for dedup by skill folder id
  const skillMap = new Map<string, DiscoveredCommand>(); // id → entry

  const addItems = (discovered: DiscoveredCommand[]) => {
    for (const cmd of discovered) {
      if (cmd.source === 'commands') {
        commandList.push(cmd);
      } else {
        // skill dedup: if already seen, merge to 'shared'
        const existing = skillMap.get(cmd.id);
        if (existing) {
          existing.provenance = 'shared';
          // canonical filePath stays as .claude/ copy (the first-seen entry)
        } else {
          skillMap.set(cmd.id, { ...cmd });
        }
      }
    }
  };

  if (workspacePath) {
    addItems(discoverCommandsInRoot(path.join(workspacePath, '.claude'), 'project', 'claude'));
    addItems(discoverCommandsInRoot(path.join(workspacePath, '.agents'), 'project', 'codex'));
  }

  const userClaude = path.join(os.homedir(), '.claude');
  if (fs.existsSync(userClaude)) {
    addItems(discoverCommandsInRoot(userClaude, 'user', 'claude'));
  }

  const all = [...commandList, ...skillMap.values()];
  return all.sort((a, b) => a.name.localeCompare(b.name));
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

/**
 * Validate an agent's extended frontmatter fields.
 * Returns an array of human-readable error strings (empty = valid).
 */
export function validateAgentFrontmatter(agent: DiscoveredAgent): string[] {
  const errors: string[] = [];
  if (agent.schedule) {
    if (!agent.runtime) {
      errors.push('schedule requires runtime to be set');
    }
    if (!agent.routine) {
      errors.push('schedule requires routine to be set');
    }
  }
  if (agent.routine) {
    const resolvedPath = path.resolve(path.dirname(agent.filePath), agent.routine);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(`routine path does not exist: ${agent.routine}`);
    }
  }
  return errors;
}

/**
 * Parse only the frontmatter record from a file's text content.
 * Exported for use by RitemarkEditorProvider in agent mode.
 */
export function parseFrontmatterFromText(text: string): FrontmatterRecord {
  return parseFrontmatter(text);
}

/**
 * Serialise a frontmatter record back to a YAML block (---\n...\n---).
 * Exported for use by RitemarkEditorProvider when writing agent files.
 */
export function serializeFrontmatter(fm: FrontmatterRecord): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      (v as string[]).forEach(item => lines.push(`  - ${item}`));
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else {
      const s = String(v);
      const safe = /[:#\[\]{}&*!|>'",%@`]/.test(s) || s.includes('\n') ? JSON.stringify(s) : s;
      lines.push(`${k}: ${safe}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
