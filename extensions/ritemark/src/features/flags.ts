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
  // Sprint 106 (#74): persistent Home / first-task launcher
  | 'home-launcher'
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
  | 'drawio-diagrams'
  // Sprint 89: remote model catalog (GH #109) — fetch model lists from ritemark-public
  | 'remote-model-catalog'
  // Sprint 94: comment callouts (#81) — editor-only comments + AI assignment
  | 'comment-callouts'
  // Sprint 99 (R15): parallel agent chats — multi-conversation store + rail
  | 'parallelChats'
  // Sprint 108: audio transcription workbench (Transcribe activity-bar app)
  | 'transcription-workbench';

/**
 * Feature flag registry
 */
export const FLAGS: Record<FlagId, FeatureFlag> = {
  // Sprint 106 (#74): persistent Home re-entry surface (Activity Bar view with
  // New document / New AI task / recent work). Experimental = real runtime
  // kill-switch during rollout; ON by default per HARD RULE #2.
  'home-launcher': {
    id: 'home-launcher',
    label: 'Home Launcher',
    description: 'Persistent Home view in the Activity Bar: create a Markdown document, start an AI task, or reopen recent work after the Welcome page is gone.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 99 (R15): parallel agent chats. Default ON per HARD RULE #2. This is a
  // CODE-LEVEL KILL-SWITCH ONLY — Settings has no flag-toggle UI, so flipping it
  // requires an emergency follow-up release, not a user action. With the flag off
  // the sidebar collapses to the most-recently-active conversation; every other
  // thread is closed (not deleted) and stays reachable in History.
  'parallelChats': {
    id: 'parallelChats',
    label: 'Parallel Agent Chats',
    description: 'Run several agent conversations at once, each with its own session, streaming output, and approvals. Code-level kill-switch only — there is no Settings UI for this flag.',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 94 (#81): editor-only comments (anchored highlights + `///` notes,
  // assignable to an AI agent). Experimental so it is a real runtime kill-switch
  // (a `stable` flag is hardcoded true and needs a rebuild to disable); the
  // package.json setting defaults it ON. Disabling stops the comment round-trip.
  'comment-callouts': {
    id: 'comment-callouts',
    label: 'Comment Callouts',
    description: 'Editor-only comments: anchored highlights and /// notes, assignable to an AI agent (#81).',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 89 (GH #109): when disabled, the model-catalog resolver skips live
  // provider probes + the remote fetch and serves the bundled/cached floor only.
  'remote-model-catalog': {
    id: 'remote-model-catalog',
    label: 'Remote Model Catalog',
    description: 'Fetch the model catalog from ritemark-public so new models appear without an app update.',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text using Whisper (macOS only)',
    status: 'stable',
    platforms: ['darwin'],
  },
  // Sprint 108: the Transcribe app + Transcript Workbench. Ships on Windows
  // too, unlike voice-dictation — the on-device engine is macOS-only (#133) but
  // ElevenLabs works everywhere, and the engine registry reports the difference
  // rather than hiding the feature (D4/R13).
  'transcription-workbench': {
    id: 'transcription-workbench',
    label: 'Transcription Workbench',
    description: 'Transcribe audio recordings into speaker-attributed markdown, on-device with Whisper or with ElevenLabs Scribe.',
    status: 'stable',
    platforms: ['darwin', 'win32'],
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
