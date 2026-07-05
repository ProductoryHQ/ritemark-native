/**
 * Model Catalog — public API (Sprint 89, GH #109).
 *
 * The single entry point every runtime/view uses for model lists + defaults.
 * Resolution waterfall (per provider): live discovery → remote catalog → cache →
 * bundled baseline. `getModels()` / `getDefault()` are always sync and never throw
 * (they serve the bundled floor before the first async resolve completes).
 *
 * Live discovery is supplied by an injected provider (`setDiscoveryProvider`) so
 * this module stays decoupled from SecretStorage and the runtime registry — the
 * caller that owns credentials wires it in `extension.ts`.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../../features/featureGate';
import { BUNDLED_CATALOG } from './bundledCatalog';
import { fetchRemoteCatalog, getCachedCatalog, shouldRefetch } from './remoteSource';
import { resolveAll, type DiscoveryResults, type ResolvedProvider } from './resolver';
import type { ModelCatalog, ModelEntry, Provider, Surface } from './schema';

export type { ModelEntry, Provider, Surface } from './schema';
export type { ResolvedProvider, ProvenanceSource, DiscoveryResults } from './resolver';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

export type Resolved = Record<Provider, ResolvedProvider>;
export type DiscoveryProvider = () => Promise<DiscoveryResults>;

let _context: vscode.ExtensionContext | null = null;
let _appVersion = '0.0.0';
let _resolved: Resolved | null = null;
let _remote: ModelCatalog | null = null;
let _discoveryProvider: DiscoveryProvider | null = null;
let _timer: ReturnType<typeof setInterval> | null = null;
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

  await refresh();

  _timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
  context.subscriptions.push(
    new vscode.Disposable(() => {
      if (_timer) clearInterval(_timer);
      _timer = null;
    }),
    _emitter,
  );
}

/** Re-run the waterfall: refresh remote (if stale) + live probes, then resolve + emit. */
export async function refresh(): Promise<void> {
  if (!_context) return;
  const storage = _context.globalState;
  const remoteEnabled = isEnabled('remote-model-catalog');

  let discovery: DiscoveryResults = {};
  if (remoteEnabled) {
    if (!_remote || shouldRefetch(storage, REFRESH_INTERVAL_MS)) {
      _remote = await fetchRemoteCatalog(storage);
    }
    if (_discoveryProvider) {
      try {
        discovery = await _discoveryProvider();
      } catch {
        discovery = {};
      }
    }
  } else {
    _remote = null; // flag off → bundled/cache floor only
  }

  const cached = getCachedCatalog(storage);
  _resolved = resolveAll(discovery, remoteEnabled ? _remote : null, cached, BUNDLED_CATALOG, _appVersion);
  _emitter.fire(_resolved);
}

function current(): Resolved {
  return _resolved ?? resolveAll({}, null, null, BUNDLED_CATALOG, _appVersion);
}

export function getModels(provider: Provider): ModelEntry[] {
  return current()[provider].models;
}

/** The default model id for a surface; falls back to the first model, then ''. */
export function getDefault(provider: Provider, surface: Surface): string {
  const rp = current()[provider];
  return rp.defaults[surface] ?? rp.models[0]?.id ?? '';
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
 * (so `openrouter/anthropic/claude-sonnet-5` → vendor `openrouter`, id `anthropic/claude-sonnet-5`).
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
