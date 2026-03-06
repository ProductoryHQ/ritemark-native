/**
 * Dynamic Codex model discovery
 *
 * Reads ~/.codex/models_cache.json (maintained by the Codex CLI)
 * and returns available models sorted by priority.
 * Falls back to a hardcoded list if the cache file is missing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ModelOption } from '../agent/types';

interface CachedModel {
  slug: string;
  display_name: string;
  description: string;
  visibility: 'list' | 'hide';
  priority: number;
}

interface ModelsCache {
  fetched_at: string;
  models: CachedModel[];
}

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'Latest frontier agentic coding model' },
  { id: 'codex-spark', label: 'Codex Spark', description: 'Fast & light' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', description: 'Balanced' },
];

/**
 * Read available Codex models from the CLI's cache file.
 * Only returns models with visibility === 'list', sorted by priority.
 */
export function getCodexModels(): ModelOption[] {
  try {
    const cachePath = path.join(os.homedir(), '.codex', 'models_cache.json');
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache: ModelsCache = JSON.parse(raw);

    if (!cache.models || !Array.isArray(cache.models)) {
      return FALLBACK_MODELS;
    }

    const visible = cache.models
      .filter(m => m.visibility === 'list')
      .sort((a, b) => a.priority - b.priority)
      .map(m => ({
        id: m.slug,
        label: m.display_name,
        description: m.description,
      }));

    return visible.length > 0 ? visible : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}
