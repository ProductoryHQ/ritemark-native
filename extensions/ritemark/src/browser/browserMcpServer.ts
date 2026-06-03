/**
 * In-process MCP server exposing browser-action tools to the Claude Agent
 * SDK (Sprint 69). When the `browser-agent-control` feature flag is on and
 * the active browser tab has been granted control consent, the
 * UnifiedViewProvider injects this server into the AgentSession config.
 *
 * The SDK auto-prefixes tool names with `mcp__<server>__<tool>`, so the
 * names Claude sees will be:
 *   - mcp__ritemark_browser__browser_navigate
 *   - mcp__ritemark_browser__browser_click
 *   - mcp__ritemark_browser__browser_fill
 *   - mcp__ritemark_browser__browser_type
 *   - mcp__ritemark_browser__browser_scroll
 *   - mcp__ritemark_browser__browser_snapshot  (Sprint 78 — read-only ARIA outline)
 *
 * Tool implementations always return text content — never throw — so the
 * agent runtime can surface workbench-side errors as a tool result instead
 * of breaking the turn.
 */

import { z } from 'zod';
import {
  browserNavigate,
  browserClick,
  browserFill,
  browserType,
  browserScroll,
  browserSnapshot,
  formatActionResultForAgent,
  type BrowserActionResult,
} from './BrowserActionTools';

export const BROWSER_MCP_SERVER_NAME = 'ritemark_browser';

const BROWSER_TOOL_BARE_NAMES = [
  'browser_navigate',
  'browser_click',
  'browser_fill',
  'browser_type',
  'browser_scroll',
  'browser_snapshot',
] as const;

/**
 * The fully-prefixed tool names the Claude SDK exposes to the model.
 * Match the `mcp__<server>__<tool>` convention so they can be added to the
 * `allowedTools` list.
 */
export const BROWSER_TOOL_ALLOW_NAMES: string[] = BROWSER_TOOL_BARE_NAMES.map(
  (bare) => `mcp__${BROWSER_MCP_SERVER_NAME}__${bare}`,
);

function toTextContent(result: BrowserActionResult): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  const text = formatActionResultForAgent(result);
  if (result.error) {
    return { content: [{ type: 'text', text }], isError: true };
  }
  return { content: [{ type: 'text', text }] };
}

/**
 * Build the SDK MCP server config. Imports the SDK lazily so the cost is
 * paid only when the browser-control feature is actually used.
 */
export async function createBrowserMcpServer(): Promise<unknown> {
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
  const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');

  return sdk.createSdkMcpServer({
    name: BROWSER_MCP_SERVER_NAME,
    version: '0.1.0',
    tools: [
      sdk.tool(
        'browser_navigate',
        'Open or navigate the integrated Ritemark browser. With type="url" + url: reuses the FIRST existing browser tab if any are open, otherwise creates a new tab — call this directly when the user says "open browser and go to X". With type="back"/"forward"/"reload": acts on the active tab (requires one to exist).\n\nIf the URL is ambiguous (e.g. the user says "go to my company website" with no exact URL), run a web search FIRST to resolve the exact URL, then call this tool with that URL. Do not guess — the tool will navigate to whatever you give it.\n\nReturns the updated ARIA page summary so you can observe the resulting page in one round trip.',
        {
          type: z.enum(['url', 'back', 'forward', 'reload']).optional().describe('Navigation kind (default "url").'),
          url: z.string().optional().describe('Target URL when type is "url". Must be a complete URL — resolve via web search first if the user gave an ambiguous name.'),
        },
        async (args) => toTextContent(await browserNavigate(args)),
      ),
      sdk.tool(
        'browser_click',
        'Click an element in the active integrated browser tab. Prefer ARIA refs (e.g. "@e12") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button="right" for context menu.',
        {
          ref: z.string().optional().describe('ARIA ref from the page summary, e.g. "@e12".'),
          selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
          button: z.enum(['left', 'right', 'middle']).optional(),
          dblClick: z.boolean().optional(),
        },
        async (args) => toTextContent(await browserClick(args)),
      ),
      sdk.tool(
        'browser_fill',
        'Replace the value of an input/textarea/select in the active integrated browser tab. Calls Playwright fill() — clears the field before typing. For sending individual key events use browser_type.',
        {
          ref: z.string().optional().describe('ARIA ref from the page summary.'),
          selector: z.string().optional().describe('CSS selector. Use only if ref is not available.'),
          value: z.string().describe('Value to write into the field.'),
        },
        async (args) => toTextContent(await browserFill(args)),
      ),
      sdk.tool(
        'browser_type',
        'Send keystrokes to the active integrated browser tab. Use "text" to type plain text into whatever has focus, or "key" to press a single named key (e.g. "Enter", "Tab", "Escape", "Control+A").',
        {
          text: z.string().optional().describe('Plain text to type via keyboard.'),
          key: z.string().optional().describe('Single key or key combo to press, e.g. "Enter", "Control+A".'),
        },
        async (args) => toTextContent(await browserType(args)),
      ),
      sdk.tool(
        'browser_scroll',
        'Scroll the active integrated browser tab. direction: "up"/"down" scrolls by amount px (default 600); "top"/"bottom" jumps; "into-view" requires ref or selector and scrolls that element into view.',
        {
          direction: z.enum(['up', 'down', 'top', 'bottom', 'into-view']).optional(),
          amount: z.number().optional().describe('Scroll distance in px (default 600) for up/down directions.'),
          ref: z.string().optional(),
          selector: z.string().optional(),
        },
        async (args) => toTextContent(await browserScroll(args)),
      ),
      sdk.tool(
        'browser_snapshot',
        'Return the current ARIA outline of the active integrated browser tab — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling browser_navigate again. Read-only: does not require browser control consent, but the tab must be shared with Ritemark AI by the user.',
        {},
        async () => toTextContent(await browserSnapshot()),
      ),
    ],
  });
}
