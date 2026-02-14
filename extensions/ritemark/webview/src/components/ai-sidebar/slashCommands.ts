/**
 * Slash Commands Registry
 *
 * `/` triggered command system with autocomplete and built-in skills.
 * Commands are executed via the AI chat system.
 */

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  usage?: string;
  icon: string; // lucide-react icon name
  /**
   * Build the AI prompt for this command.
   * @param args - Arguments provided after the command name
   * @param context - Context from editor (selection, document content)
   */
  buildPrompt: (args: string, context: CommandContext) => string;
}

export interface CommandContext {
  selection?: string;
  documentContent?: string;
  filePath?: string;
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize the current document or selection',
    usage: '/summarize',
    icon: 'FileText',
    buildPrompt: (args, context) => {
      const text = context.selection || context.documentContent || '';
      if (!text) {
        return 'Please provide text to summarize by selecting it in the editor or opening a document.';
      }
      const lengthHint = args.trim() || 'concise';
      return `Summarize the following text in a ${lengthHint} manner:\n\n${text}`;
    },
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to another language',
    usage: '/translate [language]',
    icon: 'Languages',
    buildPrompt: (args, context) => {
      const text = context.selection || '';
      if (!text) {
        return 'Please select text to translate.';
      }
      const targetLang = args.trim() || 'English';
      return `Translate the following text to ${targetLang}. Only output the translation, no explanations:\n\n${text}`;
    },
  },
  {
    id: 'rewrite',
    name: 'Rewrite',
    description: 'Rewrite text in a different style',
    usage: '/rewrite [style]',
    icon: 'Pencil',
    buildPrompt: (args, context) => {
      const text = context.selection || '';
      if (!text) {
        return 'Please select text to rewrite.';
      }
      const style = args.trim() || 'more clearly';
      return `Rewrite the following text ${style}. Only output the rewritten text:\n\n${text}`;
    },
  },
  {
    id: 'expand',
    name: 'Expand',
    description: 'Expand on the current text with more detail',
    usage: '/expand',
    icon: 'Maximize2',
    buildPrompt: (args, context) => {
      const text = context.selection || '';
      if (!text) {
        return 'Please select text to expand.';
      }
      const focus = args.trim();
      const focusHint = focus ? `, focusing on ${focus}` : '';
      return `Expand on the following text with more detail and depth${focusHint}:\n\n${text}`;
    },
  },
  {
    id: 'fix',
    name: 'Fix',
    description: 'Fix grammar and spelling',
    usage: '/fix',
    icon: 'CheckCircle',
    buildPrompt: (args, context) => {
      const text = context.selection || '';
      if (!text) {
        return 'Please select text to fix.';
      }
      return `Fix the grammar, spelling, and punctuation in the following text. Only output the corrected text:\n\n${text}`;
    },
  },
  {
    id: 'explain',
    name: 'Explain',
    description: 'Explain the selected text or concept',
    usage: '/explain',
    icon: 'HelpCircle',
    buildPrompt: (args, context) => {
      const text = context.selection || args.trim();
      if (!text) {
        return 'Please select text or provide a topic to explain.';
      }
      return `Explain the following in clear, simple terms:\n\n${text}`;
    },
  },
  {
    id: 'outline',
    name: 'Outline',
    description: 'Create an outline from the document',
    usage: '/outline',
    icon: 'List',
    buildPrompt: (args, context) => {
      const text = context.selection || context.documentContent || '';
      if (!text) {
        return 'Please provide content to outline.';
      }
      return `Create a structured outline from the following text:\n\n${text}`;
    },
  },
  {
    id: 'simplify',
    name: 'Simplify',
    description: 'Simplify complex text',
    usage: '/simplify',
    icon: 'Minimize2',
    buildPrompt: (args, context) => {
      const text = context.selection || '';
      if (!text) {
        return 'Please select text to simplify.';
      }
      return `Simplify the following text to be easier to understand. Use simpler words and shorter sentences:\n\n${text}`;
    },
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
 * Returns the command, args, and whether the input starts with a valid command.
 */
export interface ParsedCommand {
  command: SlashCommand;
  args: string;
  fullMatch: string;
}

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  // Extract command name and args
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
