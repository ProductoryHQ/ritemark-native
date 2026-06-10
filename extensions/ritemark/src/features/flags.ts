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
export type FlagId =
  | 'voice-dictation'
  | 'markdown-export'
  | 'save-as-markdown-from-preview'
  | 'document-search'
  | 'ritemark-flows'
  | 'agentic-assistant'
  | 'codex-integration'
  | 'scheduled-flow-runs'
  | 'analytics'
  | 'browser-agent-control'
  // Sprint 76 R7: ACP + OpenCode BYOK runtime
  | 'opencode-integration'
  // Sprint 80: scheduled agent tasks daemon
  | 'scheduled-tasks-daemon'
  // Sprint 82: draw.io diagram embedding
  | 'drawio-diagrams';

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
  'save-as-markdown-from-preview': {
    id: 'save-as-markdown-from-preview',
    label: 'Save as Markdown from Preview',
    description: 'Convert .docx / .pdf previews to editable markdown',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'document-search': {
    id: 'document-search',
    label: 'Document Search (RAG)',
    description: 'Removed in Sprint 74. Flag retained as a kill-switch tombstone.',
    status: 'disabled',
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
    description: 'Enable Claude for autonomous file operations in the AI sidebar',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'codex-integration': {
    id: 'codex-integration',
    label: 'Codex CLI Integration',
    description: 'ChatGPT-authenticated coding agent using OpenAI Codex CLI',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'scheduled-flow-runs': {
    id: 'scheduled-flow-runs',
    label: 'Scheduled Flow Runs',
    description: 'Run eligible flows automatically on a local schedule while Ritemark is open',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'analytics': {
    id: 'analytics',
    label: 'Analytics',
    description: 'Anonymous usage analytics and reaction feedback via PostHog',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'browser-agent-control': {
    id: 'browser-agent-control',
    label: 'AI Browser Control',
    description: 'Let the AI agent navigate, click, and fill forms in the integrated browser',
    status: 'stable',
    platforms: ['darwin'],
  },
  // Sprint 76 R7: ACP + OpenCode BYOK runtime. Status 'stable' (spec Q3 —
  // still ON by default per HARD RULE #2, flag exists as a kill-switch).
  'opencode-integration': {
    id: 'opencode-integration',
    label: 'OpenCode Runtime',
    description: 'Open-source ACP agent that uses your own API keys (Gemini, GPT, Claude, OpenRouter)',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 80: scheduled agent tasks. Shipped ENABLED ('stable') — daemon is on
  // by default (Jarmo's decision, 2026-06-08).
  'scheduled-tasks-daemon': {
    id: 'scheduled-tasks-daemon',
    label: 'Scheduled Tasks Daemon',
    description: 'Run AI agents on a schedule while Ritemark is open',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 82: status 'stable' per Q3 (Jarmo, 2026-06-10) — ON by default,
  // flag exists as a kill-switch only and is not surfaced in Settings.
  'drawio-diagrams': {
    id: 'drawio-diagrams',
    label: 'Draw.io Diagram Editing',
    description: 'Create and edit draw.io diagrams (.drawio.svg) embedded in markdown files',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
};

/**
 * Get all flag IDs
 */
export function getAllFlagIds(): FlagId[] {
  return Object.keys(FLAGS) as FlagId[];
}
