/**
 * RitemarkIpcServer — Extension-host Unix socket (or named pipe on Windows)
 * that answers the OpenCode MCP adapter subprocess (`browserMcpAdapter`): the
 * tools of a group (`list`) and a tool call (`call`), for every Ritemark tool
 * group (browser, task board; Sprint 130 W5). Was BrowserIpcServer, which knew
 * only the six browser tools.
 *
 * One server per OpenCode process; disposed when the process ends.
 */

import * as crypto from 'crypto';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * The longest Unix socket path we use, in bytes. macOS's `sun_path` holds 104
 * bytes including the NUL terminator (Linux 108), and macOS's `os.tmpdir()`
 * alone is 48 (`/var/folders/<2>/<28>/T`). Node 24 rejects a longer path with
 * `listen EINVAL`; Node 22 silently truncated it.
 */
export const MAX_UNIX_SOCKET_PATH_BYTES = 100;

/**
 * The socket path (Unix) or named-pipe name (Windows) for one session. On Unix
 * the name carries a short hash of the session id rather than the id itself,
 * so the path stays well under the limit for any id; a TMPDIR long enough to
 * break it falls back to `/tmp`.
 */
export function ritemarkIpcSocketPath(
  sessionId: string,
  platform: NodeJS.Platform = process.platform,
  tmpdir: string = os.tmpdir(),
): string {
  if (platform === 'win32') {
    return `\\\\.\\pipe\\ritemark-tools-${sessionId}`;
  }
  const shortId = crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
  const name = `rmt-${shortId}.sock`;
  const preferred = path.join(tmpdir, name);
  return Buffer.byteLength(preferred, 'utf8') <= MAX_UNIX_SOCKET_PATH_BYTES ? preferred : path.join('/tmp', name);
}

export type RitemarkIpcRequest =
  | { id: string; op: 'list'; group: string }
  | { id: string; op: 'call'; group: string; tool: string; params: Record<string, unknown> };

export interface RitemarkIpcToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** The answer to one request: the group's tools, or a call's text. */
export interface RitemarkIpcResult {
  tools?: RitemarkIpcToolDefinition[];
  text?: string;
  isError?: boolean;
}

export interface RitemarkIpcResponse extends RitemarkIpcResult {
  id: string;
  /** The host could not answer at all (a thrown error). */
  error?: string;
}

export class RitemarkIpcServer {
  private _server: net.Server | null = null;

  /** Absolute path to the socket file (Unix) or named-pipe name (Windows). */
  readonly socketPath: string;

  constructor(sessionId: string) {
    this.socketPath = ritemarkIpcSocketPath(sessionId);
  }

  /**
   * Start listening. The `handler` is called for each incoming request and
   * returns the tools or the call's text (a thrown error becomes
   * `RitemarkIpcResponse.error`, so the subprocess can tell the model rather
   * than crash).
   */
  async start(handler: (req: RitemarkIpcRequest) => Promise<RitemarkIpcResult>): Promise<void> {
    // Remove stale socket file so the bind succeeds on Unix.
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Does not exist — fine.
      }
    }

    return new Promise<void>((resolve, reject) => {
      this._server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', (chunk) => {
          buffer += chunk.toString('utf8');

          // Split on newline — adapter sends one JSON object per line.
          const lines = buffer.split('\n');
          // Last element is either empty or an incomplete line; keep it.
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            let req: RitemarkIpcRequest;
            try {
              req = JSON.parse(trimmed) as RitemarkIpcRequest;
            } catch {
              // Malformed JSON — ignore.
              continue;
            }

            handler(req)
              .then((result) => {
                const response: RitemarkIpcResponse = { id: req.id, ...result };
                socket.write(JSON.stringify(response) + '\n');
              })
              .catch((err) => {
                const response: RitemarkIpcResponse = {
                  id: req.id,
                  error: err instanceof Error ? err.message : String(err),
                };
                socket.write(JSON.stringify(response) + '\n');
              });
          }
        });

        socket.on('error', () => {
          // Connection-level error (e.g. broken pipe) — close the socket
          // gracefully without crashing the server.
          socket.destroy();
        });
      });

      this._server.on('error', (err) => {
        reject(err);
      });

      this._server.listen(this.socketPath, () => {
        resolve();
      });
    });
  }

  /** Stop the server and remove the socket file. */
  stop(): void {
    this._server?.close();
    this._server = null;

    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Already removed or never created.
      }
    }
  }
}
