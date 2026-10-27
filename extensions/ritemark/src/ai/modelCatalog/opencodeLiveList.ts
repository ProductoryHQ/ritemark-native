/**
 * OpenCode's model lists from OpenCode's own list (Sprint 141, R10/#529).
 *
 * OpenCode answers every ACP `session/new` with a `model` config option whose
 * options are every model it can run with the providers in its environment, as
 * `{ value: '<vendor>/<model id>', name: '<Vendor>/<Model name>' }`; an id it
 * doesn't list is refused (`model not found`). So that list is the runnability
 * authority, as Claude Code's `supportedModels()` is for Claude (audit A3).
 *
 * The list carries no capabilities, and OpenCode filters neither tool calling nor
 * model type, so this module shapes it for a menu:
 * - only Google, OpenAI, Anthropic and OpenRouter routes, as Ritemark's keys go;
 * - no embedding, speech, image, live, batch or tool-variant models;
 * - a model the catalog curates is offered; one it doesn't is offered only when it
 *   is at least as new as the newest curated model of its family, so a model the
 *   provider adds shows up and old variants don't crowd the menu. The rest stay
 *   resolvable for a saved pick, `hidden` as Claude below 5 is;
 * - an unknown model the provider's own list for the person's key doesn't name is
 *   dropped, where Ritemark already asks that provider for Flows (Google, OpenAI).
 *
 * Pure: no vscode / network / fs.
 */

import type { ModelEntry } from './schema';

export interface OpenCodeModelOption {
  value: string;
  name?: string;
}

export const OPENCODE_VENDORS = ['google', 'openai', 'anthropic', 'openrouter'] as const;
export type OpenCodeVendor = typeof OPENCODE_VENDORS[number];

/** Models that are not chat models with tools, by their route. */
const NOT_A_CHAT_MODEL = /(?:embed|tts|speech|audio|realtime|transcribe|whisper|image|imagen|veo|lyria|live|moderation|search|computer-use|:batch|customtools|-robotics|aqa)/i;

/** The model families a vendor's routes belong to, and their generation. */
const FAMILY: Record<'google' | 'openai' | 'anthropic', { pattern: RegExp; generation: (id: string) => number | undefined }> = {
  google: { pattern: /^gemini-\d/, generation: (id) => numberAt(/^gemini-(\d+(?:\.\d+)?)/, id) },
  openai: { pattern: /^gpt-\d/, generation: (id) => numberAt(/^gpt-(\d+(?:\.\d+)?)/, id) },
  anthropic: {
    pattern: /^claude-[a-z]+-\d/,
    generation: (id) => {
      const match = /^claude-[a-z]+-(\d+)(?:[-.](\d+))?(?:-|$)/.exec(id);
      if (!match) return undefined;
      return Number(match[2] && match[2].length < 4 ? `${match[1]}.${match[2]}` : match[1]);
    },
  },
};

function numberAt(pattern: RegExp, id: string): number | undefined {
  const match = pattern.exec(id);
  return match ? Number(match[1]) : undefined;
}

/** The vendor and the model id in that vendor's family, for a route. */
function familyOf(route: string): { vendor: OpenCodeVendor; family?: 'google' | 'openai' | 'anthropic'; modelId: string } | undefined {
  const slash = route.indexOf('/');
  if (slash <= 0) return undefined;
  const vendor = route.slice(0, slash) as OpenCodeVendor;
  if (!OPENCODE_VENDORS.includes(vendor)) return undefined;
  const rest = route.slice(slash + 1);
  if (vendor !== 'openrouter') return { vendor, family: vendor, modelId: rest };
  const inner = rest.indexOf('/');
  const innerVendor = inner > 0 ? rest.slice(0, inner) : '';
  // OpenRouter writes Claude's point versions with a dot (claude-<family>-<major>.<minor>).
  const innerId = inner > 0 ? rest.slice(inner + 1).replace(/^(claude-[a-z]+-\d+)\.(\d+)/, '$1-$2') : rest;
  return innerVendor === 'google' || innerVendor === 'openai' || innerVendor === 'anthropic'
    ? { vendor, family: innerVendor, modelId: innerId }
    : { vendor, modelId: rest };
}

function labelOf(option: OpenCodeModelOption): string {
  // OpenCode names a model "<Provider>/<Model>".
  const name = option.name ?? option.value;
  const slash = name.indexOf('/');
  return slash > 0 ? name.slice(slash + 1) : name;
}

/**
 * Turn OpenCode's model options into catalog rows for the `opencode` provider.
 * `curated` is the static `opencode` list (bundled and feed); `providerIds` holds,
 * per vendor, the ids that vendor's own list names for the person's key, or is
 * absent where Ritemark didn't ask.
 */
export function openCodeLiveRows(
  options: readonly OpenCodeModelOption[],
  curated: readonly ModelEntry[],
  providerIds: Partial<Record<'google' | 'openai', ReadonlySet<string>>> = {},
): ModelEntry[] {
  const curatedIds = new Set(curated.map((row) => row.id));
  const newest = new Map<string, number>();
  for (const row of curated) {
    const route = familyOf(row.id);
    if (!route?.family) continue;
    const generation = FAMILY[route.family].generation(route.modelId);
    if (generation !== undefined) newest.set(route.family, Math.max(newest.get(route.family) ?? 0, generation));
  }

  const rows: ModelEntry[] = [];
  const seen = new Set<string>();
  options.forEach((option, index) => {
    const id = option.value;
    if (typeof id !== 'string' || seen.has(id)) return;
    const route = familyOf(id);
    if (!route) return; // a provider Ritemark has no key card for
    seen.add(id);
    if (curatedIds.has(id)) {
      rows.push({ id, label: labelOf(option), description: '', tier: 'medium', deprecated: false, order: index });
      return;
    }
    if (NOT_A_CHAT_MODEL.test(id) || !route.family || !FAMILY[route.family].pattern.test(route.modelId)) return;
    if (route.vendor !== 'openrouter' && (route.vendor === 'google' || route.vendor === 'openai')) {
      const known = providerIds[route.vendor];
      if (known && !known.has(route.modelId)) return;
    }
    const generation = FAMILY[route.family].generation(route.modelId);
    const floor = newest.get(route.family);
    const current = generation !== undefined && floor !== undefined && generation >= floor;
    rows.push({
      id,
      label: labelOf(option),
      description: '',
      tier: 'medium',
      deprecated: false,
      // New models after the curated ones, in OpenCode's order.
      order: 1000 + index,
      ...(current ? {} : { hidden: true }),
    });
  });
  return rows;
}

/** The vendors a live list covers: their static rows give way to it. */
export function openCodeVendorsOf(rows: readonly ModelEntry[]): Set<string> {
  return new Set(rows.map((row) => row.id.split('/')[0]));
}
