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
import { isButtonAddress, isWordLinkAddress } from './blocks/buttonBlock';

/** Open a slide's Open in address in the person's browser; false (and nothing opened) for any other value. */
export function openInBrowser(url: unknown): boolean {
  const target = openInTarget(url);
  if (target === null) return false;
  // The runtime takes a string here and keeps it as written (above); the typing names only a Uri.
  void Promise.resolve(vscode.env.openExternal(target as unknown as vscode.Uri)).catch(() => false);
  return true;
}

/**
 * Sprint 163 PR 3: a Button block's address, in the person's own browser, as the string it is (as above). Only a full
 * https address (`isButtonAddress`) is opened, and, when `onDeck` is given (Present's wall and presenter view), only one
 * a button of the deck carries. False, and nothing opened, for anything else.
 */
export function openButtonLink(url: unknown, onDeck?: (address: string) => boolean): boolean {
  if (!isButtonAddress(url)) return false;
  if (onDeck && !onDeck(url)) return false;
  void Promise.resolve(vscode.env.openExternal(url as unknown as vscode.Uri)).catch(() => false);
  return true;
}

/**
 * #930: a link in a slide's words, from Present's wall or presenter view, in the person's own browser (or mail app), as
 * the string it is. Only a full http(s) or mailto address (`isWordLinkAddress`) that a link of the deck carries
 * (`onDeck`). False, and nothing opened, for anything else.
 */
export function openWordLink(url: unknown, onDeck: (address: string) => boolean): boolean {
  if (!isWordLinkAddress(url) || !onDeck(url)) return false;
  void Promise.resolve(vscode.env.openExternal(url as unknown as vscode.Uri)).catch(() => false);
  return true;
}
