// Shared fixtures for the model-catalog tests (not a test file itself).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');

/** The automated-row fixture shared with the Ritemark client's tests. */
export const FIXTURE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'auto-row.fixture.json'), 'utf8'));

/** The live files, which the publisher keeps changing: only check that they are valid. */
export function liveFeed() {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'feeds', 'model-catalog.json'), 'utf8'));
}

export function liveConfig() {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'feeds', 'model-catalog.config.json'), 'utf8'));
}

/** Frozen copies of the bootstrap feed and config: the lineup before the first automated row. */
export function publishedFeed() {
  return JSON.parse(readFileSync(join(HERE, 'fixtures', 'feed.fixture.json'), 'utf8'));
}

export function publisherConfig() {
  return JSON.parse(readFileSync(join(HERE, 'fixtures', 'config.fixture.json'), 'utf8'));
}

/** A /v1/models entry. */
export function apiModel(id, createdAt, extra = {}) {
  return { type: 'model', id, display_name: id, created_at: createdAt, max_tokens: 64000, ...extra };
}
