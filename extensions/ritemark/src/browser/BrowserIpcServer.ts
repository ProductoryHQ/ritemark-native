/**
 * BrowserIpcServer — Extension-host Unix socket (or named pipe on Windows)
 * that receives browser-action requests from the browserMcpAdapter subprocess
 * and dispatches them to BrowserActionTools.
 *
 * One server instance per ACP session; disposed when the session ends.
 */

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface BrowserIpcRequest {
  id: string;
  tool:
    | 'browser_navigate'
    | 'browser_click'
    | 'browser_fill'
    | 'browser_type'
    | 'browser_scroll'
    | 'browser_snapshot';
  params: Record<string, unknown>;
}

export interface BrowserIpcResponse {
  id: string;
  result?: string;
  error?: string;
}

export class BrowserIpcServer {
  private _server: net.Server | null = null;

  /** Absolute path to the socket file (Unix) or named-pipe name (Windows). */
  readonly socketPath: string;

  constructor(sessionId: string) {
    this.socketPath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\ritemark-browser-${sessionId}`
        : path.join(os.tmpdir(), `ritemark-browser-${sessionId}.sock`);
  }

  /**
   * Start listening. The `handler` is called for each incoming request and must
   * return the formatted text result (or throw on fatal error — the server
   * converts thrown errors into BrowserIpcResponse.error so the subprocess
   * can surface them to the model rather than crashing).
   */
  async start(handler: (req: BrowserIpcRequest) => Promise<string>): Promise<void> {
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

            let req: BrowserIpcRequest;
            try {
              req = JSON.parse(trimmed) as BrowserIpcRequest;
            } catch {
              // Malformed JSON — ignore.
              continue;
            }

            handler(req)
              .then((result) => {
                const response: BrowserIpcResponse = { id: req.id, result };
                socket.write(JSON.stringify(response) + '\n');
              })
              .catch((err) => {
                const response: BrowserIpcResponse = {
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
