/**
 * Agent Registry — Available agents for @mention routing.
 *
 * Agents are dynamically discovered from `.claude/agents/` directory.
 * The extension scans the filesystem and sends the list to the webview.
 */

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
}

/**
 * Filter agents by query (fuzzy match on id, name, description)
 */
export function filterAgents(agents: AgentDefinition[], query: string): AgentDefinition[] {
  const lowerQuery = query.toLowerCase();
  return agents.filter(
    (agent) =>
      agent.id.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Find an agent by ID
 */
export function findAgent(agents: AgentDefinition[], id: string): AgentDefinition | undefined {
  return agents.find((agent) => agent.id === id);
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

export function parseMentions(agents: AgentDefinition[], text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = /@([a-z0-9-]+)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const agentId = match[1].toLowerCase();
    const agent = findAgent(agents, agentId);
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
