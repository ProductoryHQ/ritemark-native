/**
 * AI Module Exports
 */

// API Key Management
export {
  APIKeyManager,
  initAPIKeyManager,
  getAPIKeyManager,
  apiKeyChanged
} from './apiKeyManager';

// Editor selection shape shared between the webview and the extension host.
export interface EditorSelection {
  text: string;
  isEmpty: boolean;
  from: number;
  to: number;
  /**
   * Up to ~80 chars on either side of the selection, supplied by the
   * editor webview. Used to produce an unambiguous fingerprint of the
   * selection's location for the LLM (line numbers proved unreliable —
   * TipTap from/to are ProseMirror positions that don't map cleanly to
   * source offsets, and fallback string searches hit the wrong
   * occurrence when the same word appears in frontmatter and body).
   */
  contextBefore?: string;
  contextAfter?: string;
}

// Text Search
export {
  findTextInDocument,
  findAllInDocument,
  normalizeMarkdown,
  normalizeUnicode,
  type Position
} from './textSearch';

// Widget Types
export * from './widgets/types';

// Connectivity
export {
  initConnectivity,
  isOnline,
  connectivityChanged,
  forceConnectivityCheck
} from './connectivity';
