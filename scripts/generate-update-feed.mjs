#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const REPO_OWNER = 'jarmo-productory';
const REPO_NAME = 'ritemark-public';
const DEFAULT_FEED_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/update-feed.json`;

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    i += 1;
  }

  return args;
}

function ensureArray(value) {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function compareVersions(a, b) {
  const parse = (version) => {
    const clean = version.startsWith('v') ? version.slice(1) : version;
    const extMatch = clean.match(/-ext\.(\d+)$/);
    const extBuild = extMatch ? Number(extMatch[1]) : 0;
    const base = clean.replace(/-ext\.\d+$/, '');
    const [major, minor, patch] = base.split('.').map(part => Number(part || '0'));
    return { major, minor, patch, extBuild };
  };

  const left = parse(a);
  const right = parse(b);

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  return left.extBuild - right.extBuild;
}

function sortByVersionDesc(items) {
  return [...items].sort((a, b) => compareVersions(b.version, a.version));
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function fetchExistingFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Ritemark-Release'
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function getNotesSummary(args, existingRelease) {
  if (typeof args['notes-summary'] === 'string' && args['notes-summary'].trim()) {
    return args['notes-summary'].trim();
  }

  if (typeof args['notes-file'] === 'string' && fs.existsSync(args['notes-file'])) {
    const firstContentLine = fs.readFileSync(args['notes-file'], 'utf-8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#'));
    if (firstContentLine) {
      return firstContentLine;
    }
  }

  if (existingRelease?.notesSummary) {
    return existingRelease.notesSummary;
  }

  return `Ritemark ${args.version}`;
}

function getReleaseDate(args, existingRelease, manifestReleaseDate) {
  if (typeof args['release-date'] === 'string' && args['release-date']) {
    return args['release-date'];
  }

  if (manifestReleaseDate) {
    return manifestReleaseDate;
  }

  if (existingRelease?.releaseDate) {
    return existingRelease.releaseDate;
  }

  return new Date().toISOString();
}

function mergePlatformAssets(existingAssets, newAssets) {
  const byKey = new Map();
  for (const asset of [...existingAssets, ...newAssets]) {
    byKey.set(`${asset.platform}:${asset.arch}`, asset);
  }
  return [...byKey.values()];
}

function buildAsset(assetSpec, version) {
  const [filePath, platform, arch, assetName] = String(assetSpec).split('|');
  if (!filePath || !platform || !arch || !assetName) {
    throw new Error(`Invalid --asset value: ${assetSpec}`);
  }

  const size = fs.statSync(filePath).size;
  const sha256 = hashFile(filePath);

  return {
    platform,
    arch,
    assetName,
    downloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${assetName}`,
    size,
    sha256
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode;
  const version = args.version;
  const outputPath = args.output;
  const feedUrl = typeof args['existing-feed-url'] === 'string' ? args['existing-feed-url'] : DEFAULT_FEED_URL;

  if (!mode || !version || !outputPath) {
    throw new Error('Usage: generate-update-feed.mjs --mode <full|extension> --version <version> --output <file>');
  }

  const existingFeed = (await fetchExistingFeed(feedUrl)) ?? {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    channel: 'stable',
    fullReleases: [],
    extensionReleases: []
  };

  if (mode === 'full') {
    const assetSpecs = ensureArray(args.asset);
    if (assetSpecs.length === 0) {
      throw new Error('Full mode requires at least one --asset <file|platform|arch|assetName>.');
    }

    const newAssets = assetSpecs.map(spec => buildAsset(spec, version));
    const existingRelease = existingFeed.fullReleases.find(release => release.version === version);
    const release = {
      version,
      tagName: `v${version}`,
      releaseDate: getReleaseDate(args, existingRelease),
      notesSummary: getNotesSummary(args, existingRelease),
      platforms: mergePlatformAssets(existingRelease?.platforms ?? [], newAssets)
    };

    const feed = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      channel: 'stable',
      fullReleases: sortByVersionDesc([
        release,
        ...existingFeed.fullReleases.filter(item => item.version !== version)
      ]),
      extensionReleases: sortByVersionDesc(existingFeed.extensionReleases)
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    writeJson(outputPath, feed);
    return;
  }

  if (mode === 'extension') {
    const manifestPath = args.manifest;
    if (typeof manifestPath !== 'string' || !fs.existsSync(manifestPath)) {
      throw new Error('Extension mode requires --manifest <update-manifest.json>.');
    }

    const manifest = readJson(manifestPath);
    const existingRelease = existingFeed.extensionReleases.find(release => release.version === version);
    const release = {
      version,
      appVersion: manifest.appVersion,
      minimumAppVersion: manifest.minimumAppVersion,
      releaseDate: getReleaseDate(args, existingRelease, manifest.releaseDate),
      notesSummary: manifest.releaseNotes || getNotesSummary(args, existingRelease),
      installType: manifest.installType || 'user-extension',
      extensionId: manifest.extensionId || 'ritemark',
      extensionDirName: manifest.extensionDirName,
      files: (manifest.files || []).map(file => ({
        path: file.path,
        downloadUrl: file.url || file.downloadUrl,
        size: file.size,
        sha256: file.sha256
      }))
    };

    const feed = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      channel: 'stable',
      fullReleases: sortByVersionDesc(existingFeed.fullReleases),
      extensionReleases: sortByVersionDesc([
        release,
        ...existingFeed.extensionReleases.filter(item => item.appVersion !== release.appVersion && item.version !== version)
      ])
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    writeJson(outputPath, feed);
    return;
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

main().catch((error) => {
  console.error(`Failed to generate update feed: ${error.message}`);
  process.exit(1);
});
