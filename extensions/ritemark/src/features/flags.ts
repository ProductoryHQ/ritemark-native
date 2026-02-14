/**
 * Feature Flag Definitions
 *
 * This module contains all feature flags for Ritemark.
 * Flags control feature availability based on:
 * - Platform (darwin, win32, linux)
 * - Status (stable, experimental, disabled, premium)
 * - User settings (for experimental features)
 */

import type { Platform } from '../utils/platform';

export interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  status: 'stable' | 'experimental' | 'disabled' | 'premium';
  platforms: Platform[];
}

/**
 * All known flag IDs
 */
export type FlagId = 'voice-dictation' | 'markdown-export' | 'document-search' | 'ritemark-flows' | 'agentic-assistant' | 'codex-integration';

/**
 * Feature flag registry
 */
export const FLAGS: Record<FlagId, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text using Whisper (macOS only)',
    status: 'stable',
    platforms: ['darwin'],
  },
  'markdown-export': {
    id: 'markdown-export',
    label: 'Markdown Export',
    description: 'Export documents as PDF and Word files',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'document-search': {
    id: 'document-search',
    label: 'Document Search (RAG)',
    description: 'Search your markdown documents with AI-powered semantic search',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'ritemark-flows': {
    id: 'ritemark-flows',
    label: 'Ritemark Flows',
    description: 'Visual automation workflows with AI and file operations',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'agentic-assistant': {
    id: 'agentic-assistant',
    label: 'Agentic AI Assistant',
    description: 'Enable Claude Code agent for autonomous file operations in the AI sidebar',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'codex-integration': {
    id: 'codex-integration',
    label: 'Codex CLI Integration',
    description: 'ChatGPT-authenticated coding agent using OpenAI Codex CLI',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
};

/**
 * Get all flag IDs
 */
export function getAllFlagIds(): FlagId[] {
  return Object.keys(FLAGS) as FlagId[];
}
