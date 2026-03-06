/**
 * Claude model fallback list
 *
 * Used as initial/default models before the SDK session reports
 * the actual available models via supportedModels().
 */

import type { ModelOption } from './types';

export const CLAUDE_FALLBACK_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4-5', label: 'Sonnet', description: 'Fast & capable' },
  { id: 'claude-opus-4-6', label: 'Opus', description: 'Most powerful' },
  { id: 'claude-haiku-4-5', label: 'Haiku', description: 'Quick & light' },
];
