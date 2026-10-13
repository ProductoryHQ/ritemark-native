/**
 * RitemarkToolsInjector — gives each agent runtime Ritemark's own tools, from
 * the one registry in `ritemarkTools.ts` (Sprint 130, W5). Was
 * BrowserToolsInjector, which knew the browser tools alone.
 *
 *   - Claude: an in-process SDK MCP server per group, and the tools' names for
 *     `allowedTools` (`mcp__<server>__<tool>`), so they run without a prompt.
 *     The servers are new for every session: an MCP server object serves one
 *     connection at a time ("Already connected to a transport"), and Claude
 *     conversations stay connected between turns, so a shared object left every
 *     conversation but the first without the tools (seen live, 2026-10-12; the
 *     browser server was cached the same way before Sprint 130).
 *   - Codex: dynamic tools (`<codexPrefix><tool>`), fixed when a thread starts;
 *     a call comes back as `item/tool/call` and is routed here by name.
 *   - OpenCode: one stdio MCP adapter process per group (the same adapter
 *     file), which asks the host over IPC for the group's tools and calls.
 *
 * No tool here asks for approval: the browser tools act on a tab the user
 * shared, and the board tools change only the board, each change a history
 * line the user sees. Documents are changed only by the runtime's own (gated)
 * file tools.
 */

import * as path from 'path';
import type { AgentId } from '../agent/types';
import type { DynamicToolDefinition } from '../codex/codexProtocol';
import type { RitemarkIpcRequest, RitemarkIpcResult } from './RitemarkIpcServer';
import {
  claudeAllowName,
  codexDynamicTools,
  findCodexTool,
  mcpToolDefinition,
  runTool,
  toolGroupById,
  type RitemarkToolGroup,
  type ToolResult,
} from './ritemarkTools';

type McpContent = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function mcpContent(result: ToolResult): McpContent {
  return { content: [{ type: 'text', text: result.text }], ...(result.isError ? { isError: true } : {}) };
}

export class RitemarkToolsInjector {
  /** New in-process SDK MCP servers, one per group, keyed by server name. */
  async claudeMcpServers(groups: RitemarkToolGroup[]): Promise<Record<string, unknown> | undefined> {
    if (!groups.length) return undefined;
    const entries = await Promise.all(groups.map(async (group) => [group.server, await createClaudeServer(group)] as const));
    return Object.fromEntries(entries);
  }

  /** The tool names Claude may call without asking (`allowedTools`). */
  claudeAllowedTools(groups: RitemarkToolGroup[]): string[] {
    return groups.flatMap((group) => group.tools.map((tool) => claudeAllowName(group, tool)));
  }

  /** Codex dynamic tools for a new thread; undefined without groups. */
  codexDynamicTools(groups: RitemarkToolGroup[]): DynamicToolDefinition[] | undefined {
    return groups.length ? codexDynamicTools(groups) : undefined;
  }

  /** A Codex `item/tool/call`, routed by the tool's name. */
  async codexToolCall(groups: RitemarkToolGroup[], name: string, args: Record<string, unknown>): Promise<{ text: string; success: boolean }> {
    const found = findCodexTool(groups, name);
    if (!found) return { text: `Unknown tool: ${name}`, success: false };
    const result = await runTool(found.tool, args, { runtimeId: 'codex' });
    return { text: result.text, success: !result.isError };
  }

  /**
   * OpenCode MCP server descriptors: the adapter once per group, with the
   * host's socket and the group's id in its environment.
   */
  acpMcpServers(groups: RitemarkToolGroup[], ipcPath: string): unknown[] {
    if (!groups.length || !ipcPath) return [];
    // Sprint 92 R3: after esbuild bundling this file is inlined into `out/extension.js`,
    // so `__dirname` is `out/`. The adapter is its own esbuild entry point,
    // emitted at `out/browser/browserMcpAdapter.js`.
    const adapterPath = path.join(__dirname, 'browser', 'browserMcpAdapter.js');
    return groups.map((group) => ({
      name: group.server,
      command: process.execPath, // Node.js executable
      args: [adapterPath],
      env: [
        { name: 'RITEMARK_IPC', value: ipcPath },
        { name: 'RITEMARK_TOOL_GROUP', value: group.id },
      ],
    }));
  }

  /** An OpenCode adapter's request: a group's tools, or a call. */
  async handleIpc(request: RitemarkIpcRequest, runtimeId: AgentId = 'opencode'): Promise<RitemarkIpcResult> {
    const group = toolGroupById(request.group);
    if (!group) return { text: `Unknown tool group: ${String(request.group)}`, isError: true };
    if (request.op === 'list') return { tools: group.tools.map(mcpToolDefinition) };
    const tool = group.tools.find((item) => item.name === request.tool);
    if (!tool) return { text: `Unknown tool: ${String(request.tool)}`, isError: true };
    const result = await runTool(tool, request.params, { runtimeId });
    return { text: result.text, ...(result.isError ? { isError: true } : {}) };
  }
}

/** The SDK is imported lazily, so the cost is paid only when Claude runs. */
async function createClaudeServer(group: RitemarkToolGroup): Promise<unknown> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
  const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
  return sdk.createSdkMcpServer({
    name: group.server,
    version: '0.2.0',
    tools: group.tools.map((tool) =>
      sdk.tool(tool.name, tool.description, tool.input, async (args: unknown) =>
        mcpContent(await runTool(tool, args, { runtimeId: 'claude-code' })),
      ),
    ),
  });
}
