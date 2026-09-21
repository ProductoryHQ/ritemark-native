/**
 * Type declarations for @mixmark-io/domino, the server-side DOM Turndown uses
 * in Node. The package's own typings declare `module 'domino'`, which does not
 * match its published name. Only what the webview tests use is declared.
 */

declare module '@mixmark-io/domino' {
  export function createDocument(html?: string, force?: boolean): Document
}
