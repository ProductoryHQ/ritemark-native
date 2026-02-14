/**
 * Slash Commands Registry
 *
 * `/` triggered command system — real commands that control the AI chat/agent.
 * These map to actual store actions, not prompt templates.
 */

export type CommandAction =
  | 'clear'
  | 'new'
  | 'history'
  | 'compact'
  | 'help'
  | 'settings'
  | 'cancel'
  | 'cost';

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  action: CommandAction;
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS: SlashCommand[] = [
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
 * Filter commands by query (prefix match)
 */
export function filterCommands(query: string): SlashCommand[] {
  const lowerQuery = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.id.toLowerCase().startsWith(lowerQuery) ||
      cmd.name.toLowerCase().startsWith(lowerQuery)
  );
}

/**
 * Find a command by ID or name
 */
export function findCommand(idOrName: string): SlashCommand | undefined {
  const lower = idOrName.toLowerCase();
  return SLASH_COMMANDS.find(
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

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const match = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
  if (!match) return null;

  const cmdName = match[1];
  const args = match[2] || '';

  const command = findCommand(cmdName);
  if (!command) return null;

  return {
    command,
    args,
    fullMatch: trimmed,
  };
}
