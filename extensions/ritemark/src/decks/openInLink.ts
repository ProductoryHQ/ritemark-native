/**
 * Sprint 163 PR 1: a slide's ↗ Open in Claude or Open in ChatGPT, from the deck view and from Present, opened in the
 * person's own browser. Only an address `codeTools.openInAddresses` makes is opened (`openInTarget`); anything else
 * is dropped.
 *
 * The address goes to `openExternal` as the string it is: VS Code opens a string exactly as written
 * (`extHostWindow.openUri`, then the opener's `preserveOriginalString`), while a `Uri` is written out again decoded
 * (`toString(true)` and `encodeURI`), which reads a prompt's own `&` or `#` as the address's and cuts the prompt there.
 */
import * as vscode from 'vscode';
import { openInTarget } from './blocks/codeTools';

/** Open a slide's Open in address in the person's browser; false (and nothing opened) for any other value. */
export function openInBrowser(url: unknown): boolean {
  const target = openInTarget(url);
  if (target === null) return false;
  // The runtime takes a string here and keeps it as written (above); the typing names only a Uri.
  void Promise.resolve(vscode.env.openExternal(target as unknown as vscode.Uri)).catch(() => false);
  return true;
}
