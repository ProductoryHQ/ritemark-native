/**
 * browserMcpAdapter.ts — Standalone MCP stdio server subprocess.
 *
 * Spawned by OpenCode as an MCP server (via McpServerStdio). Exposes the same
 * 6 browser tools as browserMcpServer.ts over the MCP stdio protocol
 * (JSON-RPC 2.0, newline-delimited). Forwards each tool call to the extension
 * host via the Unix socket / named pipe whose path is in RITEMARK_IPC.
 *
 * Zero external dependencies — Node.js built-ins only. This makes the script
 * work both in development (source tree) and in the production app bundle
 * where the real @modelcontextprotocol/sdk is not available.
 *
 * NOT imported by any other module — it is the entry point for the subprocess.
 */

'use strict';

import * as net from 'net';
import type { BrowserIpcRequest, BrowserIpcResponse } from './BrowserIpcServer';

// ── MCP protocol types (inline — avoids SDK dependency) ─────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ── Tool definitions (mirrors browserMcpServer.ts exactly) ──────────────────

const TOOLS: McpToolDef[] = [
  {
    name: 'browser_navigate',
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
          description:
            'Target URL when type is "url". Must be a complete URL — resolve via web search first if the user gave an ambiguous name.',
        },
      },
    },
  },
  {
    name: 'browser_click',
    description:
      'Click an element in the active integrated browser tab. Prefer ARIA refs (e.g. "@e12") from the page summary; CSS selectors are a fallback. Use dblClick=true for double-click, button="right" for context menu.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'ARIA ref from the page summary, e.g. "@e12".',
        },
        selector: {
          type: 'string',
          description: 'CSS selector. Use only if ref is not available.',
        },
        button: { type: 'string', enum: ['left', 'right', 'middle'] },
        dblClick: { type: 'boolean' },
      },
    },
  },
  {
    name: 'browser_fill',
    description:
      'Replace the value of an input/textarea/select in the active integrated browser tab. Calls Playwright fill() — clears the field before typing. For sending individual key events use browser_type.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'ARIA ref from the page summary.',
        },
        selector: {
          type: 'string',
          description: 'CSS selector. Use only if ref is not available.',
        },
        value: {
          type: 'string',
          description: 'Value to write into the field.',
        },
      },
      required: ['value'],
    },
  },
  {
    name: 'browser_type',
    description:
      'Send keystrokes to the active integrated browser tab. Use "text" to type plain text into whatever has focus, or "key" to press a single named key (e.g. "Enter", "Tab", "Escape", "Control+A").',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Plain text to type via keyboard.' },
        key: {
          type: 'string',
          description: 'Single key or key combo to press, e.g. "Enter", "Control+A".',
        },
      },
    },
  },
  {
    name: 'browser_scroll',
    description:
      'Scroll the active integrated browser tab. direction: "up"/"down" scrolls by amount px (default 600); "top"/"bottom" jumps; "into-view" requires ref or selector and scrolls that element into view.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'top', 'bottom', 'into-view'],
        },
        amount: {
          type: 'number',
          description: 'Scroll distance in px (default 600) for up/down directions.',
        },
        ref: { type: 'string' },
        selector: { type: 'string' },
      },
    },
  },
  {
    name: 'browser_snapshot',
    description:
      'Return the current ARIA outline of the active integrated browser tab — URL, title, and full accessibility tree snapshot. Use this to re-observe page state after an action without calling browser_navigate again. Read-only: does not require browser control consent, but the tab must be shared with Ritemark AI by the user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

const VALID_TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

// ── IPC call helper ─────────────────────────────────────────────────────────

const ipcPath = process.env['RITEMARK_IPC'] ?? '';

/**
 * Send a browser-action request to the extension host via the IPC socket and
 * return the text result. Creates a fresh connection for each call to keep the
 * protocol simple (no multiplexing needed at this call rate).
 */
function callIpc(tool: BrowserIpcRequest['tool'], params: Record<string, unknown>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!ipcPath) {
      reject(new Error('RITEMARK_IPC environment variable not set'));
      return;
    }

    const socket = net.createConnection(ipcPath);
    let buffer = '';
    let settled = false;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const req: BrowserIpcRequest = { id, tool, params };

    socket.on('connect', () => {
      socket.write(JSON.stringify(req) + '\n');
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const resp: BrowserIpcResponse = JSON.parse(trimmed) as BrowserIpcResponse;
          if (resp.id === id && !settled) {
            settled = true;
            socket.destroy();
            if (resp.error !== undefined) {
              resolve(`Error: ${resp.error}`);
            } else {
              resolve(resp.result ?? '');
            }
          }
        } catch {
          // Malformed response — keep reading.
        }
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    socket.on('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('IPC connection closed before response received'));
      }
    });
  });
}

// ── MCP stdio server ─────────────────────────────────────────────────────────

function send(obj: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function handleRequest(msg: JsonRpcRequest): void {
  const id = msg.id ?? null;

  switch (msg.method) {
    case 'initialize': {
      send({
        jsonrpc: '2.0',
        id: id as string | number,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'ritemark_browser', version: '0.1.0' },
        },
      });
      return;
    }

    case 'tools/list': {
      send({
        jsonrpc: '2.0',
        id: id as string | number,
        result: { tools: TOOLS },
      });
      return;
    }

    case 'tools/call': {
      const params = msg.params as { name?: string; arguments?: Record<string, unknown> };
      const toolName = params?.name ?? '';
      const args = params?.arguments ?? {};

      if (!VALID_TOOL_NAMES.has(toolName)) {
        send({
          jsonrpc: '2.0',
          id: id as string | number,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
        return;
      }

      callIpc(toolName as BrowserIpcRequest['tool'], args)
        .then((text) => {
          send({
            jsonrpc: '2.0',
            id: id as string | number,
            result: {
              content: [{ type: 'text', text }],
              isError: text.startsWith('Error:'),
            },
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          send({
            jsonrpc: '2.0',
            id: id as string | number,
            result: {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true,
            },
          });
        });
      return;
    }

    default: {
      // Notifications (method only, no id) require no response.
      if (id === null || id === undefined) {
        return;
      }
      send({
        jsonrpc: '2.0',
        id: id as string | number,
        error: { code: -32601, message: `Method not found: ${msg.method}` },
      });
    }
  }
}

// ── Entry point: read newline-delimited JSON from stdin ──────────────────────

let stdinBuffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk: string) => {
  stdinBuffer += chunk;
  const lines = stdinBuffer.split('\n');
  stdinBuffer = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const msg = JSON.parse(trimmed) as JsonRpcRequest;
      handleRequest(msg);
    } catch {
      // Ignore malformed lines.
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
