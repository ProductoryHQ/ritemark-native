/**
 * Model Catalog — public API (Sprint 89, GH #109; Sprint 127).
 *
 * The single entry point every runtime/view uses for model lists + defaults.
 * Per provider: a live probe when it succeeds, enriched from the static layer —
 * the bundled baseline merged row by row with the remote feed or its cache.
 * `getModels()` / `getDefault()` are always sync and never throw (they serve the
 * bundled floor before the first async resolve completes).
 *
 * Sprint 127 authorities: Anthropic decides which models exist, the runtime
 * which it can run, Ritemark how they are presented. The feed is checked every
 * 10 minutes with a conditional request; models the feed declares to Claude Code
 * are handed to the CLI through `settings.modelPicker` (runtimeDeclarations.ts),
 * and the runtime is re-probed only when that declared set changes.
 *
 * Live discovery is supplied by an injected provider (`setDiscoveryProvider`) so
 * this module stays decoupled from SecretStorage and the runtime registry — the
 * caller that owns credentials wires it in `extension.ts`.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../../features/featureGate';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { fetchRemoteCatalog, getCachedCatalog } from './remoteSource';
import {
  findModelEntry,
  resolveAll,
  resolveRequestedModelIn,
  resolveStaticModels,
  substitutionForTurn as substitutionForTurnIn,
  type DiscoveryResults,
  type RequestedModelResolution,
  type ResolvedProvider,
} from './resolver';
import {
  buildClaudeRuntimeDeclarations,
  feedPollAction,
  NO_CLAUDE_DECLARATIONS,
  sessionDeclarationFor,
  type ClaudeRuntimeDeclarations,
  type ClaudeSessionDeclaration,
} from './runtimeDeclarations';
import type { ModelCatalog, ModelEntry, Provider, Surface } from './schema';

export type { ModelEntry, Provider, Surface } from './schema';
export type { ResolvedProvider, ProvenanceSource, DiscoveryResults, RequestedModelResolution } from './resolver';
export type { ClaudeRuntimeDeclarations, ClaudeSessionDeclaration } from './runtimeDeclarations';

/** Sprint 127 R5: a conditional feed check (a 304 when nothing changed). */
const FEED_POLL_INTERVAL_MS = 10 * 60 * 1000;
/** Live probes also refresh on activation and after a sign-in change. */
const DISCOVERY_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type Resolved = Record<Provider, ResolvedProvider>;
export type DiscoveryProvider = () => Promise<DiscoveryResults>;

let _context: vscode.ExtensionContext | null = null;
let _appVersion = '0.0.0';
let _resolved: Resolved | null = null;
let _remote: ModelCatalog | null = null;
let _discovery: DiscoveryResults = {};
let _declarations: ClaudeRuntimeDeclarations = NO_CLAUDE_DECLARATIONS;
let _lastFeedCheck = 0;
let _discoveryProvider: DiscoveryProvider | null = null;
let _probe: Promise<void> | null = null;
let _probeAgain = false;
const _timers: Array<ReturnType<typeof setInterval>> = [];
const _emitter = new vscode.EventEmitter<Resolved>();

/** Inject the live-discovery source (wired in extension.ts once creds are available). */
export function setDiscoveryProvider(provider: DiscoveryProvider): void {
  _discoveryProvider = provider;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  _context = context;
  _appVersion = context.extension?.packageJSON?.version ?? '0.0.0';

  // Immediate synchronous-quality resolve (cache + bundled) so getModels() is
  // populated before the first network round-trip.
  _resolved = resolveAll({}, null, getCachedCatalog(context.globalState), BUNDLED_CATALOG, _appVersion);
  _declarations = computeDeclarations();

  await refresh();

  _timers.push(
    setInterval(() => void pollFeed().catch((err) => console.warn('[modelCatalog] feed check failed', err)), FEED_POLL_INTERVAL_MS),
    setInterval(() => void refreshDiscovery().catch((err) => console.warn('[modelCatalog] probe failed', err)), DISCOVERY_REFRESH_INTERVAL_MS),
  );
  context.subscriptions.push(
    new vscode.Disposable(() => {
      for (const timer of _timers.splice(0)) clearInterval(timer);
    }),
    _emitter,
  );
}

/** Re-run everything: a conditional feed check, then a live probe; resolve + emit. */
export async function refresh(): Promise<void> {
  await pollFeed({ probe: false });
  await refreshDiscovery();
}

/**
 * Sprint 127 R5: check the feed conditionally. The runtime is re-probed only
 * when the set of models declared to it changes; any other change re-resolves
 * from the last probe.
 */
export async function pollFeed(options: { probe?: boolean } = {}): Promise<void> {
  if (!_context) return;
  _lastFeedCheck = Date.now();
  if (!isEnabled('remote-model-catalog')) {
    _remote = null; // flag off → bundled/cache floor only, nothing declared
    _declarations = NO_CLAUDE_DECLARATIONS;
    return;
  }
  const result = await fetchRemoteCatalog(_context.globalState);
  if (result) _remote = result.catalog;
  const previous = _declarations.signature;
  _declarations = computeDeclarations();
  const action = feedPollAction({
    declarationsChanged: _declarations.signature !== previous,
    feedChanged: result?.changed === true,
    probeAllowed: options.probe !== false,
  });
  if (action === 'probe') await refreshDiscovery();
  else if (action === 'resolve') resolveAndEmit();
}

/** Sprint 127 R5 (S27): the Agent sidebar became visible — check if due. */
export function pollFeedIfStale(): void {
  if (Date.now() - _lastFeedCheck < FEED_POLL_INTERVAL_MS) return;
  void pollFeed().catch((err) => console.warn('[modelCatalog] feed check failed', err));
}

/**
 * Probe the live sources (each probe fails soft), then resolve + emit. One probe
 * runs at a time — it spawns the CLI — and a request made meanwhile runs once
 * more afterwards. The previous result serves reads until the new one lands.
 */
export function refreshDiscovery(): Promise<void> {
  if (_probe) {
    _probeAgain = true;
    return _probe;
  }
  _probe = (async () => {
    do {
      _probeAgain = false;
      await probeOnce();
    } while (_probeAgain);
  })().finally(() => {
    _probe = null;
  });
  return _probe;
}

async function probeOnce(): Promise<void> {
  if (!_context) return;
  let next: DiscoveryResults = {};
  if (isEnabled('remote-model-catalog') && _discoveryProvider) {
    try {
      next = await _discoveryProvider();
    } catch {
      next = {};
    }
  }
  _discovery = next;
  resolveAndEmit();
}

function resolveAndEmit(): void {
  if (!_context) return;
  const remoteEnabled = isEnabled('remote-model-catalog');
  _resolved = resolveAll(
    remoteEnabled ? _discovery : {},
    remoteEnabled ? _remote : null,
    getCachedCatalog(_context.globalState),
    BUNDLED_CATALOG,
    _appVersion,
  );
  _emitter.fire(_resolved);
}

/** Models the merged static layer declares to the Claude Code runtime (R1). */
function computeDeclarations(): ClaudeRuntimeDeclarations {
  if (!_context || !isEnabled('remote-model-catalog')) return NO_CLAUDE_DECLARATIONS;
  const rows = resolveStaticModels('anthropic', _remote, getCachedCatalog(_context.globalState), BUNDLED_CATALOG, _appVersion);
  return buildClaudeRuntimeDeclarations(rows);
}

/** Every model the catalog declares to Claude Code, for the discovery probe. */
export function getClaudeRuntimeDeclarations(): ClaudeRuntimeDeclarations {
  return _declarations;
}

/** What a Claude session needs to run `modelId`; undefined for a model the CLI knows natively. */
export function getClaudeSessionDeclaration(modelId: string | undefined): ClaudeSessionDeclaration | undefined {
  return sessionDeclarationFor(_declarations, modelId);
}

function current(): Resolved {
  return _resolved ?? resolveAll({}, null, null, BUNDLED_CATALOG, _appVersion);
}

export function getModels(provider: Provider): ModelEntry[] {
  return current()[provider].models;
}

/** Resolve either a representative request id or one of its live aliases. */
export function getModel(provider: Provider, id: string | undefined): ModelEntry | undefined {
  return findModelEntry(getModels(provider), id);
}

/** The default model id for a surface; falls back to the first model, then ''. */
export function getDefault(provider: Provider, surface: Surface): string {
  const rp = current()[provider];
  const configured = rp.defaults[surface];
  return findModelEntry(rp.models, configured)?.id ?? rp.models[0]?.id ?? '';
}

/**
 * Sprint 127 R6: resolve a saved or requested model, reporting — never hiding —
 * a replacement when the catalog no longer offers it.
 */
export function resolveRequestedModel(provider: Provider, requested: string | undefined, surface: Surface): RequestedModelResolution {
  return resolveRequestedModelIn(current()[provider], requested, surface);
}

/** Sprint 127 R6 (S28): the substitution a turn on `turnModel` must name, if any. */
export function substitutionForTurn(
  provider: Provider,
  saved: RequestedModelResolution | undefined,
  turnModel: string | undefined,
): { from: string; to: string } | undefined {
  const identity = (id: string): string => getModel(provider, id)?.id ?? id;
  return substitutionForTurnIn(saved, turnModel, (a, b) => identity(a) === identity(b));
}

export function getResolved(): Resolved {
  return current();
}

export function onUpdate(cb: (resolved: Resolved) => void): vscode.Disposable {
  return _emitter.event(cb);
}

/**
 * Reshape the flat `opencode` list (composite `<vendor>/<model>` ids) into the
 * `Record<vendor, {id,label,description}[]>` shape the BYOK model picker expects.
 * The vendor is the first path segment; the remainder is the bare model id
 * (so the first segment is the vendor and the remainder is its provider model id).
 */
export function getByokProviderModels(): Record<string, { id: string; label: string; description: string }[]> {
  const grouped: Record<string, { id: string; label: string; description: string }[]> = {};
  for (const m of getModels('opencode')) {
    const slash = m.id.indexOf('/');
    if (slash <= 0) continue;
    const vendor = m.id.slice(0, slash);
    const bareId = m.id.slice(slash + 1);
    (grouped[vendor] ??= []).push({ id: bareId, label: m.label, description: m.description });
  }
  return grouped;
}
