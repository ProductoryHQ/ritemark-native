/**
 * Slash Commands Registry
 *
 * `/` triggered command system — real commands that control the AI chat/agent.
 * Built-in commands map to store actions.
 * Custom commands from .claude/commands/ and .claude/skills/ are sent as prompts to the agent.
 */

import type { DiscoveredCommand } from './types';

export type CommandAction =
  | 'clear'
  | 'new'
  | 'history'
  | 'compact'
  | 'help'
  | 'settings'
  | 'cancel'
  | 'cost'
  | 'custom';

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  action: CommandAction;
  /** For custom commands, the source directory */
  source?: 'commands' | 'skills';
}

/**
 * Built-in slash commands (always available)
 */
export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    id: 'clear',
    name: 'Clear',
    description: 'Clear current conversation',
    icon: 'Trash2',
    action: 'clear',
  },
  {
    id: 'new',
    name: 'New',
    description: 'Start a new conversation',
    icon: 'Plus',
    action: 'new',
  },
  {
    id: 'history',
    name: 'History',
    description: 'Show saved conversations',
    icon: 'History',
    action: 'history',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Compact conversation context',
    icon: 'Minimize2',
    action: 'compact',
  },
  {
    id: 'help',
    name: 'Help',
    description: 'Show available commands',
    icon: 'HelpCircle',
    action: 'help',
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Open Ritemark settings',
    icon: 'Settings',
    action: 'settings',
  },
  {
    id: 'cancel',
    name: 'Cancel',
    description: 'Cancel current request',
    icon: 'Square',
    action: 'cancel',
  },
  {
    id: 'cost',
    name: 'Cost',
    description: 'Show cost of last turn',
    icon: 'DollarSign',
    action: 'cost',
  },
];

/**
 * Convert discovered commands to SlashCommand format
 */
export function mergeCommands(discoveredCommands: DiscoveredCommand[]): SlashCommand[] {
  const builtinIds = new Set(BUILTIN_COMMANDS.map((c) => c.id));
  const customCommands: SlashCommand[] = discoveredCommands
    .filter((dc) => !builtinIds.has(dc.id)) // Don't override built-in commands
    .map((dc) => ({
      id: dc.id,
      name: dc.name,
      description: dc.description,
      icon: dc.source === 'skills' ? 'Sparkles' : 'Terminal',
      action: 'custom' as CommandAction,
      source: dc.source,
    }));

  return [...BUILTIN_COMMANDS, ...customCommands];
}

/**
 * Filter commands by query (prefix match)
 */
export function filterCommands(allCommands: SlashCommand[], query: string): SlashCommand[] {
  const lowerQuery = query.toLowerCase();
  return allCommands.filter(
    (cmd) =>
      cmd.id.toLowerCase().startsWith(lowerQuery) ||
      cmd.name.toLowerCase().startsWith(lowerQuery)
  );
}

/**
 * Find a command by ID or name
 */
export function findCommand(allCommands: SlashCommand[], idOrName: string): SlashCommand | undefined {
  const lower = idOrName.toLowerCase();
  return allCommands.find(
    (cmd) => cmd.id.toLowerCase() === lower || cmd.name.toLowerCase() === lower
  );
}

/**
 * Parse a slash command from input text.
 */
export interface ParsedCommand {
  command: SlashCommand;
  args: string;
  fullMatch: string;
}

export function parseCommand(allCommands: SlashCommand[], input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const match = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
  if (!match) return null;

  const cmdName = match[1];
  const args = match[2] || '';

  const command = findCommand(allCommands, cmdName);
  if (!command) return null;

  return {
    command,
    args,
    fullMatch: trimmed,
  };
}
