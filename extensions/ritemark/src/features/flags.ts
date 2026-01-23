/**
 * Feature Flag Definitions
 *
 * This module contains all feature flags for RiteMark.
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
export type FlagId = 'voice-dictation' | 'markdown-export';

/**
 * Feature flag registry
 */
export const FLAGS: Record<FlagId, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Speech-to-text using Whisper (experimental, macOS only)',
    status: 'experimental',
    platforms: ['darwin'],
  },
  'markdown-export': {
    id: 'markdown-export',
    label: 'Markdown Export',
    description: 'Export documents as PDF and Word files',
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
