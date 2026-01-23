/**
 * Feature Flag System - Public API
 *
 * Use this module to check if features are enabled:
 *
 * ```typescript
 * import { isEnabled } from './features';
 *
 * if (isEnabled('voice-dictation')) {
 *   // Initialize voice dictation
 * }
 * ```
 */

export { isEnabled } from './featureGate';
export { FLAGS, getAllFlagIds } from './flags';
export type { FeatureFlag, FlagId } from './flags';
