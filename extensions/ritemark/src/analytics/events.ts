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
  | 'reaction_submitted'
  | 'feedback_sent'
  | 'welcome_shown'
  | 'ai_signed_in'
  | 'project_opened'
  | 'first_message_sent';

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
  app_session_start: {
    version: string;
    platform: string;
  };
  feature_used: {
    feature: string;
    source?: string;
  };
  agent_used: {
    agent: string;
  };
  reaction_submitted: {
    reaction: string;
    message?: string;
  };
  feedback_sent: {
    message: string;
    reaction?: string;
  };
}

/**
 * Type-safe event helper — ensures payload matches event name.
 */
export type AnalyticsEvent<T extends EventName> = {
  name: T;
  properties: EventPayloads[T];
};
