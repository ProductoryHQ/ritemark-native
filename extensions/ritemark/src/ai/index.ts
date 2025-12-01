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

// OpenAI Client
export {
  executeCommand,
  testConnection,
  type AICommandResult,
  type ConversationMessage,
  type EditorSelection
} from './openAIClient';

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
