/**
 * browserMcpAdapter.ts — Standalone MCP stdio server subprocess for OpenCode.
 *
 * Spawned by OpenCode as an MCP server (via McpServerStdio), once per Ritemark
 * tool group: `RITEMARK_TOOL_GROUP` names the group (`browser`, `board`), and
 * `RITEMARK_IPC` the extension host's socket. The adapter holds no tool
 * definitions of its own (Sprint 130, W5): `tools/list` asks the host for the
 * group's tools, generated from the one registry in `runtime/ritemarkTools.ts`,
 * and `tools/call` forwards the call. Before, it carried a hand copy of the six
 * browser tools that had drifted from the others (Phase 0, P4).
 *
 * The file keeps its name and output path (`out/browser/browserMcpAdapter.js`),
 * which the build and release scripts check.
 *
 * Zero external dependencies — Node.js built-ins only. This makes the script
 * work both in development (source tree) and in the production app bundle
 * where the real @modelcontextprotocol/sdk is not available.
 *
 * NOT imported by any other module — it is the entry point for the subprocess.
 */

'use strict';

import * as net from 'net';
import type { RitemarkIpcRequest, RitemarkIpcResponse, RitemarkIpcToolDefinition } from '../runtime/RitemarkIpcServer';

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

const ipcPath = process.env['RITEMARK_IPC'] ?? '';
// Before Sprint 130 the adapter served the browser alone, so no group means it.
const group = process.env['RITEMARK_TOOL_GROUP'] || 'browser';
const serverName = `ritemark_${group}`;

// ── IPC client ───────────────────────────────────────────────────────────────

type IpcBody = { op: 'list' } | { op: 'call'; tool: string; params: Record<string, unknown> };

function callIpc(body: IpcBody): Promise<RitemarkIpcResponse> {
  return new Promise((resolve, reject) => {
    if (!ipcPath) {
      reject(new Error('RITEMARK_IPC environment variable not set'));
      return;
    }

    const socket = net.createConnection(ipcPath);
    let buffer = '';
    let settled = false;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const req = { id, group, ...body } as RitemarkIpcRequest;

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
          const resp = JSON.parse(trimmed) as RitemarkIpcResponse;
          if (resp.id === id && !settled) {
            settled = true;
            socket.destroy();
            resolve(resp);
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

/** The group's tools, asked once: they do not change while OpenCode runs. */
let tools: Promise<RitemarkIpcToolDefinition[]> | null = null;
function listTools(): Promise<RitemarkIpcToolDefinition[]> {
  tools ??= callIpc({ op: 'list' }).then((resp) => {
    if (resp.error) throw new Error(resp.error);
    return resp.tools ?? [];
  });
  tools.catch(() => {
    // A failed ask is asked again next time.
    tools = null;
  });
  return tools;
}

// ── MCP stdio server ─────────────────────────────────────────────────────────

function send(obj: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function textResult(id: string | number, text: string, isError: boolean): void {
  send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError } });
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
          serverInfo: { name: serverName, version: '0.2.0' },
        },
      });
      return;
    }

    case 'tools/list': {
      listTools()
        .then((list) => send({ jsonrpc: '2.0', id: id as string | number, result: { tools: list } }))
        .catch((err: unknown) =>
          send({
            jsonrpc: '2.0',
            id: id as string | number,
            error: { code: -32603, message: `Ritemark tools are unavailable: ${err instanceof Error ? err.message : String(err)}` },
          }),
        );
      return;
    }

    case 'tools/call': {
      const params = msg.params as { name?: string; arguments?: Record<string, unknown> };
      const toolName = params?.name ?? '';
      const args = params?.arguments ?? {};

      listTools()
        .then((list) => {
          if (!list.some((tool) => tool.name === toolName)) {
            send({ jsonrpc: '2.0', id: id as string | number, error: { code: -32601, message: `Unknown tool: ${toolName}` } });
            return;
          }
          return callIpc({ op: 'call', tool: toolName, params: args }).then((resp) => {
            if (resp.error !== undefined) textResult(id as string | number, `Error: ${resp.error}`, true);
            else textResult(id as string | number, resp.text ?? '', Boolean(resp.isError));
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          textResult(id as string | number, `Error: ${message}`, true);
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
