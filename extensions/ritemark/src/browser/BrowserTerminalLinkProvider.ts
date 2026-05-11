import * as vscode from 'vscode';

/**
 * Subclass of TerminalLink that carries the matched URL through to
 * handleTerminalLink without a separate lookup map.
 */
class LocalhostTerminalLink extends vscode.TerminalLink {
  constructor(
    startIndex: number,
    length: number,
    public readonly url: string
  ) {
    super(startIndex, length, `Open ${url} in Ritemark Browser`);
  }
}

/**
 * Regex covering localhost + loopback addresses with an explicit scheme.
 *
 * Matches:
 *   http://localhost:5173
 *   https://localhost:5173/path?query=1
 *   http://127.0.0.1:3000
 *   http://0.0.0.0:8080
 *   http://[::1]:3000
 *   http://[::]:3000
 *
 * Does NOT match bare "localhost:5173" — VS Code's built-in already handles
 * those and we do not want to shadow it.
 */
const LOCALHOST_PATTERN =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::]):\d+(?:\/[^\s]*)?/g;

/**
 * Terminal link provider that intercepts localhost / loopback URLs and routes
 * them to the shell-level integrated BrowserView instead of the system browser.
 */
export class BrowserTerminalLinkProvider
  implements vscode.TerminalLinkProvider<LocalhostTerminalLink>
{
  constructor(private readonly openUrl: (url: string) => Promise<void>) {}

  provideTerminalLinks(
    context: vscode.TerminalLinkContext,
    _token: vscode.CancellationToken
  ): LocalhostTerminalLink[] {
    const links: LocalhostTerminalLink[] = [];
    let match: RegExpExecArray | null;

    LOCALHOST_PATTERN.lastIndex = 0; // reset global regex state
    while ((match = LOCALHOST_PATTERN.exec(context.line)) !== null) {
      links.push(
        new LocalhostTerminalLink(match.index, match[0].length, match[0])
      );
    }

    return links;
  }

  handleTerminalLink(link: LocalhostTerminalLink): void {
    this.openUrl(link.url).catch((err) => {
      void vscode.window.showErrorMessage(
        err instanceof Error ? err.message : String(err)
      );
    });
  }
}
