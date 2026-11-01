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
  // Sprint 130 (#119): task board in each project folder, with Give to agent
  | 'task-board'
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
  | 'transcription-workbench'
  // Sprint 109: host-owned durable conversation archive + Conversations UI
  | 'durableAgentConversations'
  // Sprint 112: per-turn Composer thinking effort across agent runtimes
  | 'composer-thinking-effort'
  // Sprint 119: publish a Markdown document to Google Docs and Sync it later
  | 'google-docs-publishing'
  // Sprint 118: record from the microphone directly in Transcribe (#328)
  | 'transcribe-direct-recording'
  // Sprint 125: read-only PowerPoint (.pptx) preview (#285)
  | 'powerpoint-preview'
  // Sprint 145 (#588): a writer's copy merged with the person's text by paragraph
  | 'editor-sync-merge'
  // Sprint 148 (#591): Ritemark's own search, the words layer (its index reads the project in a worker)
  | 'project-search';

/**
 * Feature flag registry
 */
export const FLAGS: Record<FlagId, FeatureFlag> = {
  // Sprint 148 (#591): kill switch for Ritemark's own search, as `powerpoint-preview` is. Default ON (HARD RULE #2):
  // the setting defaults to true. Search reads every document of the project in the background, so a way to stop it
  // without a release is worth one setting. Off, the index never starts (and a running one stops); with PR 2, the
  // Search row opens VS Code's search as in 2.1. VS Code's own search stays in More either way.
  'project-search': {
    id: 'project-search',
    label: 'Project Search',
    description: 'Search the words in this project\'s documents, chats and tasks, on this computer.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 145 (#588): both changes stay. A writer's (an AI's or another app's) copy is merged with the person's
  // text by paragraph, with Review changes for a paragraph both changed; patch 014's reload participant asks
  // `_ritemark.editorSync.answerReload` first. ON ('stable'); a code-level kill switch an extension release can
  // flip without a shell release: 'disabled' makes the command answer nothing (VS Code reloads as before) and the
  // sync behave as 2.1 did (a clean document takes the copy, a dirty one gets #454's question). Not in Settings.
  'editor-sync-merge': {
    id: 'editor-sync-merge',
    label: 'Merge a Writer\'s Copy',
    description: 'When an AI or another app saves a copy of the document you are writing in, keep both changes, merged by paragraph.',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 125: kill switch for the PowerPoint preview. Default ON (HARD RULE #2).
  // The .pptx editor stays registered when it is off, so a deck says the preview
  // is turned off and offers PowerPoint rather than showing VS Code's binary-file page.
  'powerpoint-preview': {
    id: 'powerpoint-preview',
    label: 'PowerPoint Preview',
    description: 'Open PowerPoint (.pptx) files as a read-only preview of their slides, drawn locally.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 118: kill switch for Record in the Transcribe panel. Flag-off hides
  // Record and interrupted-recording recovery; a recording already in progress
  // still finishes, and every saved recording stays an ordinary file.
  'transcribe-direct-recording': {
    id: 'transcribe-direct-recording',
    label: 'Transcribe Direct Recording',
    description: 'Record from the microphone in the Transcribe panel. The recording is saved as a WAV file and transcribed like any added recording.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 119: gates the whole Google Docs publishing surface — Settings
  // card, editor menu items and every host handler. Stable since 2026-09-22:
  // it ships fully in v1.12.0 (Jarmo), so there is no user setting; the
  // code-level kill switch is `status: 'disabled'`, which keeps stored tokens
  // and document links and only stops offering the feature.
  'google-docs-publishing': {
    id: 'google-docs-publishing',
    label: 'Google Docs Publishing',
    description: 'Publish a Markdown document to Google Docs and keep that same Doc updated with Sync.',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'composer-thinking-effort': {
    id: 'composer-thinking-effort',
    label: 'Composer Thinking Effort',
    description: 'Choose a capability-supported thinking effort for the next Agent Chat message.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'durableAgentConversations': {
    id: 'durableAgentConversations',
    label: 'Durable Agent Conversations',
    description: 'Store complete Agent conversations safely in the extension host and show the project Conversations archive.',
    status: 'experimental',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 106 (#74): the 1.x Home launcher. Replaced in Sprint 134 by 2.0's
  // Home (src/views/HomePanel.ts, ProjectsViewProvider.ts) once every row of
  // spec R14's table was checked (Jarmo, 19 October: "Yes, delete after the
  // check"). The flag gates nothing; it stays as a tombstone (ARCH-3).
  'home-launcher': {
    id: 'home-launcher',
    label: 'Home Launcher',
    description: 'Removed in Sprint 134: replaced by Home. Flag retained as a tombstone.',
    status: 'disabled',
    platforms: ['darwin', 'win32', 'linux'],
  },
  // Sprint 130 (#119): a task board per project folder (cards in
  // `.ritemark/tasks/`), Give to agent, and the board tools for all three
  // runtimes. Experimental = real runtime kill-switch; ON by default per HARD
  // RULE #2 through `ritemark.features.task-board`.
  'task-board': {
    id: 'task-board',
    label: 'Task Board',
    description: 'A task board for each project folder: cards as Markdown files in .ritemark/tasks, Your calls, and Give to agent with Claude Code, ChatGPT or OpenCode.',
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
  // Sprint 129 (#133): Windows ships the whisper engine too. Linux is not a
  // build target. Kill switches: drop 'win32' here for Windows only, or set
  // status 'disabled' everywhere; no code is removed either way.
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text on this computer with Whisper',
    status: 'stable',
    platforms: ['darwin', 'win32'],
  },
  // Sprint 108: the Transcribe app + Transcript Workbench. ElevenLabs works
  // everywhere; the on-device engine runs on macOS and Windows (Sprint 129), and
  // the engine registry reports a computer it cannot run on rather than hiding
  // the feature (D4/R13).
  'transcription-workbench': {
    id: 'transcription-workbench',
    label: 'Transcription Workbench',
    description: 'Transcribe audio recordings into speaker-attributed documents, on-device with Whisper or with ElevenLabs Scribe.',
    status: 'stable',
    // All three: the `customEditors` contribution claims audio extensions
    // unconditionally, so gating the provider off on Linux would leave the
    // manifest promising an editor that does not exist. ElevenLabs is plain
    // HTTP and works there anyway; the on-device engine has no Linux build.
    platforms: ['darwin', 'win32', 'linux'],
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
    label: 'Make an editable copy',
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
    label: 'ChatGPT',
    description: "OpenAI's agent, signed in with a ChatGPT account",
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
