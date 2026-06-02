/**
 * Codex App Server dynamic-tools wiring for browser control (Sprint 69).
 *
 * Codex's `thread/start` supports an experimental `dynamicTools` parameter
 * that lets the client expose custom tool schemas. When the model calls one,
 * the App Server sends an `item/tool/call` JSON-RPC request to the client,
 * which executes the action and responds with the result.
 *
 * Tool names must match `^[a-zA-Z0-9_-]+$` and must NOT collide with
 * reserved Codex namespaces (functions, browser, computer, terminal, etc).
 * We use the `ritemark_browser_*` prefix.
 */

import {
  browserNavigate,
  browserClick,
  browserFill,
  browserType,
  browserScroll,
  browserSnapshot,
  formatActionResultForAgent,
} from './BrowserActionTools';
import type { DynamicToolDefinition } from '../codex/codexProtocol';

export const CODEX_BROWSER_TOOL_NAMES = [
  'ritemark_browser_navigate',
  'ritemark_browser_click',
  'ritemark_browser_fill',
  'ritemark_browser_type',
  'ritemark_browser_scroll',
  'ritemark_browser_snapshot',
] as const;

export type CodexBrowserToolName = typeof CODEX_BROWSER_TOOL_NAMES[number];

export function isCodexBrowserToolCall(toolName: string): toolName is CodexBrowserToolName {
  return (CODEX_BROWSER_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function buildCodexBrowserDynamicTools(): DynamicToolDefinition[] {
  return [
    {
      name: 'ritemark_browser_navigate',
      description:
        'Open or navigate the integrated Ritemark browser. With type="url" + url: reuses the FIRST existing browser tab if any are open, otherwise creates a new tab — call this directly when the user says "open browser and go to X". With type="back"/"forward"/"reload": acts on the active tab (requires one to exist).\n\nIf the URL is ambiguous (e.g. the user says "go to my company website" with no exact URL), run a web search FIRST to resolve the exact URL, then call this tool with that URL. Do not guess — the tool will navigate to whatever you give it.\n\nReturns the updated ARIA page summary so you can observe the resulting page in one round trip.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['url', 'back', 'forward', 'reload'],
            description: 'Navigation kind (default "url").',
          },
          url: {
            type: 'string',
            description: 'Target URL when type is "url". Must be a complete URL — resolve via web search first if the user gave an ambiguous name.',
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'ritemark_browser_click',
      description:
        'Click an element in the active integrated Ritemark browser tab. Prefer ARIA refs (e.g. "@e12") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button="right" for context menu. Do not call this without either ref or selector.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'ARIA ref from the page summary, e.g. "@e12".' },
          selector: { type: 'string', description: 'CSS selector. Use only if ref is not available.' },
          button: { type: 'string', enum: ['left', 'right', 'middle'] },
          dblClick: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'ritemark_browser_fill',
      description:
        'Replace the value of an input/textarea/select in the active integrated Ritemark browser tab. Calls Playwright fill() — clears the field before typing. Prefer this over browser_type when you know the target ref or selector.',
      inputSchema: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          selector: { type: 'string' },
          value: { type: 'string', description: 'Value to write into the field.' },
        },
        required: ['value'],
        additionalProperties: false,
      },
    },
    {
      name: 'ritemark_browser_type',
      description:
        'Send keystrokes to the active integrated Ritemark browser tab. Use "key" for shortcuts or single keys (e.g. "Enter", "Tab", "Control+A"). Use "text" only after an editable element is already focused; otherwise use browser_fill with a ref or selector.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          key: { type: 'string', description: 'Single key or key combo, e.g. "Enter", "Control+A".' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'ritemark_browser_scroll',
      description:
        'Scroll the active integrated Ritemark browser tab. direction: "up"/"down" by amount px (default 600); "top"/"bottom" jumps; "into-view" requires ref or selector.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom', 'into-view'] },
          amount: { type: 'number' },
          ref: { type: 'string' },
          selector: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'ritemark_browser_snapshot',
      description:
        'Return the current ARIA outline of the active integrated Ritemark browser tab — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling ritemark_browser_navigate again. Read-only: does not require browser control consent.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

/**
 * Dispatch a `item/tool/call` arrival from Codex to the corresponding
 * BrowserActionTools function. Returns an `{ text, success }` pair shaped
 * for `CodexAppServer.sendToolCallResponse(requestId, text, success)`.
 *
 * Never throws — wraps caught errors as `{ text: errorMsg, success: false }`
 * so the App Server can feed the failure back into the model turn instead
 * of breaking the JSON-RPC stream.
 */
export async function dispatchCodexBrowserToolCall(
  toolName: CodexBrowserToolName,
  args: Record<string, unknown>,
): Promise<{ text: string; success: boolean }> {
  try {
    let result;
    switch (toolName) {
      case 'ritemark_browser_navigate':
        result = await browserNavigate(args as Parameters<typeof browserNavigate>[0]);
        break;
      case 'ritemark_browser_click':
        result = await browserClick(args as Parameters<typeof browserClick>[0]);
        break;
      case 'ritemark_browser_fill':
        result = await browserFill(args as unknown as Parameters<typeof browserFill>[0]);
        break;
      case 'ritemark_browser_type':
        result = await browserType(args as Parameters<typeof browserType>[0]);
        break;
      case 'ritemark_browser_scroll':
        result = await browserScroll(args as Parameters<typeof browserScroll>[0]);
        break;
      case 'ritemark_browser_snapshot':
        result = await browserSnapshot();
        break;
      default: {
        const _exhaustive: never = toolName;
        return { text: `Unknown browser tool: ${String(_exhaustive)}`, success: false };
      }
    }
    return {
      text: formatActionResultForAgent(result),
      success: !result.error,
    };
  } catch (err) {
    return {
      text: err instanceof Error ? err.message : String(err),
      success: false,
    };
  }
}
