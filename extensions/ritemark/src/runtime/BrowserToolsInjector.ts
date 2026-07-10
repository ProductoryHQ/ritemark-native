import * as path from 'path';
import { createBrowserMcpServer, BROWSER_MCP_SERVER_NAME } from '../browser/browserMcpServer';

export class BrowserToolsInjector {
  private cachedServer: unknown | null = null;

  async getMcpServers(enabled: boolean): Promise<Record<string, unknown> | undefined> {
    if (!enabled) {
      return undefined;
    }
    if (!this.cachedServer) {
      this.cachedServer = await createBrowserMcpServer();
    }
    return { [BROWSER_MCP_SERVER_NAME]: this.cachedServer };
  }

  /**
   * Return ACP McpServerStdio descriptors for the browser adapter subprocess.
   *
   * @param enabled - Whether the browser-agent-control feature flag is on.
   * @param ipcPath - Absolute path to the running BrowserIpcServer socket.
   */
  getAcpMcpServers(enabled: boolean, ipcPath: string): unknown[] {
    if (!enabled || !ipcPath) {
      return [];
    }

    // Sprint 92 R3: after esbuild bundling this file is inlined into `out/extension.js`,
    // so `__dirname` is `out/` (pre-bundle it was `out/runtime/`, hence the old '..').
    // The adapter is its own esbuild entry point, emitted at `out/browser/browserMcpAdapter.js`.
    const adapterPath = path.join(__dirname, 'browser', 'browserMcpAdapter.js');

    return [
      {
        name: 'ritemark_browser',
        command: process.execPath, // Node.js executable
        args: [adapterPath],
        env: [{ name: 'RITEMARK_IPC', value: ipcPath }],
      },
    ];
  }

  getCodexDynamicTools(_enabled: boolean): unknown[] | undefined {
    return undefined;
  }
}
