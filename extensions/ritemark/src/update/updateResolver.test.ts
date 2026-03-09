import assert from 'node:assert/strict';
import { resolveUpdate } from './updateResolver';
import type { UpdateFeed } from './updateFeed';

function createFeed(): UpdateFeed {
  return {
    schemaVersion: 1,
    generatedAt: '2026-03-08T10:00:00Z',
    channel: 'stable',
    fullReleases: [
      {
        version: '1.5.0',
        releaseDate: '2026-03-08T10:00:00Z',
        notesSummary: 'Full release',
        platforms: [
          {
            platform: 'darwin',
            arch: 'arm64',
            assetName: 'Ritemark.dmg',
            downloadUrl: 'https://example.invalid/Ritemark.dmg',
            size: 400_000_000,
            sha256: 'full-sha'
          }
        ]
      }
    ],
    extensionReleases: [
      {
        version: '1.5.0-ext.1',
        appVersion: '1.5.0',
        minimumAppVersion: '1.5.0',
        releaseDate: '2026-03-08T10:15:00Z',
        notesSummary: 'Extension release on 1.5.0 track',
        extensionDirName: 'ritemark-1.5.0-ext.1',
        files: [
          {
            path: 'out/extension.js',
            downloadUrl: 'https://example.invalid/extension.js',
            size: 1000,
            sha256: 'ext-sha'
          }
        ]
      },
      {
        version: '1.4.1-ext.3',
        appVersion: '1.4.1',
        minimumAppVersion: '1.4.1',
        releaseDate: '2026-03-07T10:15:00Z',
        notesSummary: 'Extension release on 1.4.1 track',
        extensionDirName: 'ritemark-1.4.1-ext.3',
        files: [
          {
            path: 'out/extension.js',
            downloadUrl: 'https://example.invalid/1.4.1-ext.3/extension.js',
            size: 1000,
            sha256: 'ext-sha-2'
          }
        ]
      }
    ]
  };
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('prefers full update when app version is behind latest full release', () => {
  const result = resolveUpdate({
    feed: createFeed(),
    currentAppVersion: '1.4.1',
    currentExtensionVersion: '1.4.1-ext.2',
    platform: 'darwin',
    arch: 'arm64'
  });

  assert.equal(result.action, 'full');
  assert.equal(result.targetVersion, '1.5.0');
});

test('offers extension update when app base is current', () => {
  const result = resolveUpdate({
    feed: createFeed(),
    currentAppVersion: '1.5.0',
    currentExtensionVersion: '1.5.0',
    platform: 'darwin',
    arch: 'arm64'
  });

  assert.equal(result.action, 'extension');
  assert.equal(result.targetVersion, '1.5.0-ext.1');
});

test('prefers full update over older-track extension patch', () => {
  const result = resolveUpdate({
    feed: createFeed(),
    currentAppVersion: '1.4.1',
    currentExtensionVersion: '1.4.1',
    platform: 'darwin',
    arch: 'arm64'
  });

  assert.equal(result.action, 'full');
  assert.equal(result.targetVersion, '1.5.0');
});

test('returns blocked when only incompatible extension exists and no full installer matches platform', () => {
  const feed = createFeed();
  feed.fullReleases[0].platforms = [];
  feed.extensionReleases = [feed.extensionReleases[0]];

  const result = resolveUpdate({
    feed,
    currentAppVersion: '1.4.1',
    currentExtensionVersion: '1.4.1-ext.2',
    platform: 'darwin',
    arch: 'arm64'
  });

  assert.equal(result.action, 'blocked');
});

test('returns none when already at latest app and extension versions', () => {
  const result = resolveUpdate({
    feed: createFeed(),
    currentAppVersion: '1.5.0',
    currentExtensionVersion: '1.5.0-ext.1',
    platform: 'darwin',
    arch: 'arm64'
  });

  assert.equal(result.action, 'none');
});

console.log('\nAll update resolver tests passed.');
