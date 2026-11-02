/**
 * The two messages a desk page posts for Ritemark's shell, not for its host (Sprint 152, PR 3; the Experience lead's
 * "One loading look, for every slot").
 *
 * While a tab's page isn't drawn yet, the shell shows its loading look over the tab (patch 002's
 * `ritemarkLoadingLook.ts`): the sheet, the turning mark after a second, at a start a line after ten. The page replaces it
 * in one change. A page whose content comes after its host answers (Home, the Task board, a document) posts
 * PAGE_DRAWING first, so the shell keeps its look above the page until it posts PAGE_DRAWN, once its content is on
 * screen (`webview/src/lib/pageDrawn.ts`). A page that posts neither is waited for until its first message.
 *
 * The shell's names are the same strings (`RITEMARK_PAGE_DRAWING`, `RITEMARK_PAGE_DRAWN`); a page posts them to the same
 * channel as its host's requests, so a host that checks what it receives skips them (`isShellPageSignal`).
 *
 * Dependency-free (no `vscode`), so the webview imports it too.
 */

export const PAGE_DRAWING = 'ritemark/pageDrawing';
export const PAGE_DRAWN = 'ritemark/pageDrawn';

/** Whether a page's message is one of the shell's two, which its host leaves alone. */
export function isShellPageSignal(raw: unknown): boolean {
  const type = typeof raw === 'object' && raw !== null ? (raw as { type?: unknown }).type : undefined;
  return type === PAGE_DRAWING || type === PAGE_DRAWN;
}
