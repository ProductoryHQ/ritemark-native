/**
 * Agent Registry — Available agents for @mention routing.
 *
 * These agents map to system prompts in `.claude/agents/{agent-id}.md`.
 * When a user types `@agent-name`, the message is routed to Claude Code
 * with the corresponding agent's system prompt.
 */

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
}

/**
 * Available agents that can be mentioned with @
 */
export const AVAILABLE_AGENTS: AgentDefinition[] = [
  {
    id: 'sprint-manager',
    name: 'Sprint Manager',
    description: 'Sprint workflow, approval gates',
  },
  {
    id: 'vscode-expert',
    name: 'VS Code Expert',
    description: 'Builds, extensions, patches',
  },
  {
    id: 'webview-expert',
    name: 'Webview Expert',
    description: 'TipTap, React, webview',
  },
  {
    id: 'qa-validator',
    name: 'QA Validator',
    description: 'Quality checks, commit validation',
  },
  {
    id: 'release-manager',
    name: 'Release Manager',
    description: 'Release process, notarization',
  },
  {
    id: 'product-marketer',
    name: 'Product Marketer',
    description: 'Changelog, release notes',
  },
  {
    id: 'ux-expert',
    name: 'UX Expert',
    description: 'UI/UX design, shadcn/ui',
  },
  {
    id: 'knowledge-builder',
    name: 'Knowledge Builder',
    description: 'Create new skills/agents',
  },
];

/**
 * Fuzzy filter agents by query
 */
export function filterAgents(query: string): AgentDefinition[] {
  const lowerQuery = query.toLowerCase();
  return AVAILABLE_AGENTS.filter(
    (agent) =>
      agent.id.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Find an agent by ID
 */
export function findAgent(id: string): AgentDefinition | undefined {
  return AVAILABLE_AGENTS.find((agent) => agent.id === id);
}

/**
 * Parse @mentions from text
 * Returns array of { agentId, start, end } for each valid mention
 */
export interface ParsedMention {
  agentId: string;
  start: number;
  end: number;
}

export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = /@([a-z0-9-]+)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const agentId = match[1].toLowerCase();
    const agent = findAgent(agentId);
    if (agent) {
      mentions.push({
        agentId: agent.id,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return mentions;
}
