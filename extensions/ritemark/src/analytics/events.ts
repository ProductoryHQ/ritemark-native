/**
 * Analytics event definitions for Ritemark.
 *
 * All PostHog events are typed here so callers get compile-time safety
 * and we have a single inventory of what the product tracks.
 */

export type EventName =
  | 'app_session_start'
  | 'feature_used'
  | 'agent_used'
  | 'feedback_sent'
  | 'welcome_shown'
  | 'ai_signed_in'
  | 'project_opened'
  | 'first_message_sent'
  | 'ready_request_used'
  | 'starting_point_used'
  | 'made_something'
  | 'feedback_opened'
  | 'first_reply'
  | 'voice_captured'
  | 'voice_note_edited';

/**
 * Sprint 139 (R8): how a turn ended, from the one classifier's kinds. No text,
 * no error message, no model. `plan` is listed for the refusal card, which is
 * built only after the Claude Free audit (#496); nothing sends it yet.
 */
export type TurnOutcome =
  | 'arrived'
  | 'sign_in'
  | 'plan'
  | 'limit'
  | 'model'
  | 'network'
  | 'provider_error'
  | 'stopped'
  | 'other';

/** Sprint 139 (R10): where a voice capture came from. */
export type VoiceSource = 'dictation' | 'transcribe';

/** The welcome's providers, by the names people know (ChatGPT, never Codex). */
export type WelcomeProvider = 'claude' | 'chatgpt' | 'opencode';

/**
 * Sprint 133 (R8): the welcome's four events. They carry no path, folder or
 * project name, file name, message, account or e-mail: only these properties,
 * plus the shared ones (`product_area`, `app_version`, `build_channel`).
 */
export interface EventPayloads {
  welcome_shown: {
    kind: 'fresh' | 'update';
  };
  ai_signed_in: {
    provider: WelcomeProvider;
    method: 'account' | 'api_key';
  };
  project_opened: {
    source: 'existing_folder' | 'new_project' | 'recent' | 'sample';
    has_ai: boolean;
  };
  first_message_sent: {
    provider: WelcomeProvider;
  };
  /**
   * Sprint 140 (R15): the first day's counts. None carries words, a name, a
   * path, a count of files, an account or an address: only these properties,
   * plus the shared ones.
   */
  ready_request_used: {
    kind: 'what_is_here' | 'what_for' | 'module_4';
    provider: WelcomeProvider;
  };
  starting_point_used: {
    place: 'project' | 'empty_project' | 'word_or_pdf' | 'short_text' | 'long_text' | 'table' | 'sample';
    edited: boolean;
    provider: WelcomeProvider;
  };
  made_something: {
    how: 'new_document' | 'export' | 'publish';
    after_ready_request: boolean;
  };
  feedback_opened: {
    from: 'status_bar' | 'help' | 'ai_info' | 'command';
  };
  app_session_start: {
    version: string;
    platform: string;
  };
  feature_used: {
    feature: string;
    source?: string;
  };
  /**
   * Sprint 139 (R7, #479): one per turn a person runs with an AI, from a chat
   * (comment tasks, task cards and Home's ready request run as chat turns) or a
   * Flow's Claude or ChatGPT step, sent when the turn ends with its outcome
   * (Jarmo's decision 3, 26 October: every turn's outcome). Nothing else:
   * no model, no text, no file, no project.
   */
  agent_used: {
    agent: WelcomeProvider;
    source: 'chat' | 'flow';
    outcome: TurnOutcome;
  };
  /** Sprint 139 (R8): once per profile, when the turn `first_message_sent` counted ends. */
  first_reply: {
    provider: WelcomeProvider;
    outcome: TurnOutcome;
  };
  /** Sprint 139 (R10): a dictation that put text in a document, or a Transcribe recording or file that became text. */
  voice_captured: {
    source: VoiceSource;
    /** Transcribe only: recorded in Ritemark, or an audio file brought in. */
    input?: 'recorded' | 'file';
  };
  /** Sprint 139 (R10): a document that began with a voice capture, changed and saved on a later day (1–30). */
  voice_note_edited: {
    source: VoiceSource;
    days_since_capture: number;
  };
  feedback_sent: {
    message: string;
    /** Sprint 140 (D11): which question the message answers; only the first-week card's send carries it. */
    asked?: 'made_this_week';
  };
}

/**
 * Type-safe event helper — ensures payload matches event name.
 */
export type AnalyticsEvent<T extends EventName> = {
  name: T;
  properties: EventPayloads[T];
};
