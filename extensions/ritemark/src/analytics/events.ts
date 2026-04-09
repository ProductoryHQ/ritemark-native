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
  | 'feedback_sent';

export interface EventPayloads {
  app_session_start: {
    version: string;
    platform: string;
  };
  feature_used: {
    feature: string;
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
