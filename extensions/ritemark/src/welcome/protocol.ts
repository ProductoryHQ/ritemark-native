/**
 * The welcome's protocol (Sprint 133, E2): the typed boundary between the
 * welcome page (`webview/src/components/welcome/`) and the extension host.
 *
 * `decodeWelcomeRequest` is the only place webview JSON becomes a welcome
 * request: every field is checked and unknown fields are refused, as the task
 * board's protocol does. No `vscode` import: the webview imports the types.
 */

export type WelcomeProviderId = 'claude' | 'chatgpt' | 'opencode';
export type AccountProviderId = 'claude' | 'chatgpt';

/**
 * One provider as the page shows it (R2–R4).
 * - `checking`: its check has not answered yet ("Checking…").
 * - `ready`: signed in (OpenCode: set up).
 * - `sign-in`: Sign in (OpenCode: Set up), with a reason when there is one.
 * - `signing-in`: the person is finishing in the browser.
 * - `not-checked`: offline.
 * - `unavailable`: the runtime cannot start here; Settings repairs it.
 */
export type ProviderPhase = 'checking' | 'ready' | 'sign-in' | 'signing-in' | 'not-checked' | 'unavailable';

export interface ProviderView {
  id: WelcomeProviderId;
  phase: ProviderPhase;
  /** One sentence, shown in place of the card's line or under the row's name. */
  reason: string | null;
  /** The check did not answer in time: offer Try again. */
  retry: boolean;
  /** How a ready provider is set up. */
  method: 'account' | 'api_key' | null;
}

export interface ProjectView {
  /** Opaque, used to ask for this project. */
  id: string;
  name: string;
  /** Two letters for the project's mark. */
  mark: string;
  /** The folder, as the person reads it (`~/Documents/…`, `Documents\…`). */
  place: string;
  /** "Open when you left", "Yesterday", "Last week", or nothing. */
  when: string | null;
  /** The project this window restored: opening it closes the sheet without a reload. */
  current: boolean;
}

export type MissingTool = 'git' | 'node' | 'restart';

export type WelcomeKind = 'fresh' | 'update' | 'start';

export interface WelcomeState {
  kind: WelcomeKind;
  /** The fresh welcome's step. */
  step: 1 | 2;
  platform: 'darwin' | 'win32' | 'linux';
  /** Step 1's cards, or the update sheet's rows. */
  providers: ProviderView[];
  /** The AI that became ready from the welcome, for "Signed in to Claude" and step 2's line. */
  readyProvider: WelcomeProviderId | null;
  offline: boolean;
  projects: ProjectView[];
  usageData: { on: boolean; fromRitemark1: boolean };
  missingTool: MissingTool | null;
  newProject: {
    /** "In ~/Documents/Ritemark/": the page adds the name as it is typed. */
    placePrefix: string;
    /** The name was refused: why, in words. */
    error: string | null;
  };
  /** Which OpenCode keys are already set (never the keys themselves). */
  keysSet: Record<WelcomeKeyName, boolean>;
  /** A line at the top of the sheet: the folder that is gone, a copy that failed. */
  notice: string | null;
  /** A folder is opening: the page waits. */
  opening: boolean;
}

export type WelcomeKeyName = 'anthropic-api-key' | 'openai-api-key' | 'google-ai-key' | 'openrouter-api-key';
export const WELCOME_KEY_NAMES: readonly WelcomeKeyName[] = ['anthropic-api-key', 'openai-api-key', 'google-ai-key', 'openrouter-api-key'];

/** Host → page. */
export type WelcomeMessage =
  | { type: 'welcome/state'; state: WelcomeState }
  | { type: 'welcome/keys-saved'; target: 'claude' | 'opencode'; ok: boolean; message: string | null };

/** Page → host. */
export type WelcomeRequest =
  | { type: 'welcome/ready' }
  | { type: 'welcome/sign-in'; provider: AccountProviderId }
  | { type: 'welcome/cancel-sign-in'; provider: AccountProviderId }
  | { type: 'welcome/reopen-sign-in'; provider: AccountProviderId }
  | { type: 'welcome/retry-check'; provider: WelcomeProviderId }
  | { type: 'welcome/continue'; provider: WelcomeProviderId }
  | { type: 'welcome/save-keys'; target: 'claude' | 'opencode'; keys: Partial<Record<WelcomeKeyName, string>> }
  | { type: 'welcome/skip' }
  | { type: 'welcome/open-folder' }
  | { type: 'welcome/change-place' }
  | { type: 'welcome/create-project'; name: string }
  | { type: 'welcome/try-sample' }
  | { type: 'welcome/open-recent'; id: string }
  | { type: 'welcome/usage-data'; on: boolean }
  | { type: 'welcome/open-link'; link: 'privacy' | 'terms' }
  | { type: 'welcome/use-bundled-claude' }
  | { type: 'welcome/restart' }
  | { type: 'welcome/open-settings' };

export type Decoded = { ok: true; request: WelcomeRequest } | { ok: false; reason: string };

const MAX_TEXT = 4096;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(message: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(message)) {
    if (!allowed.includes(key)) return `unexpected field "${key}"`;
  }
  for (const key of allowed) {
    if (!(key in message)) return `missing field "${key}"`;
  }
  return null;
}

const isAccountProvider = (value: unknown): value is AccountProviderId => value === 'claude' || value === 'chatgpt';
const isProvider = (value: unknown): value is WelcomeProviderId => isAccountProvider(value) || value === 'opencode';
const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_TEXT;

export function decodeWelcomeRequest(raw: unknown): Decoded {
  if (!isObject(raw) || typeof raw.type !== 'string') return { ok: false, reason: 'not a welcome request' };
  const fail = (reason: string): Decoded => ({ ok: false, reason: `${String(raw.type)}: ${reason}` });
  const check = (keys: readonly string[]): string | null => exactKeys(raw, ['type', ...keys]);
  let problem: string | null;
  switch (raw.type) {
    case 'welcome/ready':
    case 'welcome/skip':
    case 'welcome/open-folder':
    case 'welcome/change-place':
    case 'welcome/try-sample':
    case 'welcome/use-bundled-claude':
    case 'welcome/restart':
    case 'welcome/open-settings':
      problem = check([]);
      return problem ? fail(problem) : { ok: true, request: { type: raw.type } };
    case 'welcome/sign-in':
    case 'welcome/cancel-sign-in':
    case 'welcome/reopen-sign-in':
      problem = check(['provider']);
      if (problem) return fail(problem);
      if (!isAccountProvider(raw.provider)) return fail('provider must be claude or chatgpt');
      return { ok: true, request: { type: raw.type, provider: raw.provider } };
    case 'welcome/retry-check':
    case 'welcome/continue':
      problem = check(['provider']);
      if (problem) return fail(problem);
      if (!isProvider(raw.provider)) return fail('unknown provider');
      return { ok: true, request: { type: raw.type, provider: raw.provider } };
    case 'welcome/save-keys': {
      problem = check(['target', 'keys']);
      if (problem) return fail(problem);
      if (raw.target !== 'claude' && raw.target !== 'opencode') return fail('target must be claude or opencode');
      if (!isObject(raw.keys)) return fail('keys must be an object');
      const keys: Partial<Record<WelcomeKeyName, string>> = {};
      for (const [name, value] of Object.entries(raw.keys)) {
        if (!(WELCOME_KEY_NAMES as readonly string[]).includes(name)) return fail(`unknown key "${name}"`);
        if (!isText(value)) return fail(`${name} must be text`);
        keys[name as WelcomeKeyName] = value;
      }
      if (raw.target === 'claude' && Object.keys(keys).some((name) => name !== 'anthropic-api-key')) {
        return fail('the API keys sheet holds only the Anthropic key');
      }
      return { ok: true, request: { type: 'welcome/save-keys', target: raw.target, keys } };
    }
    case 'welcome/create-project':
      problem = check(['name']);
      if (problem) return fail(problem);
      if (!isText(raw.name)) return fail('name must be text');
      return { ok: true, request: { type: 'welcome/create-project', name: raw.name } };
    case 'welcome/open-recent':
      problem = check(['id']);
      if (problem) return fail(problem);
      if (!isText(raw.id)) return fail('id must be text');
      return { ok: true, request: { type: 'welcome/open-recent', id: raw.id } };
    case 'welcome/usage-data':
      problem = check(['on']);
      if (problem) return fail(problem);
      if (typeof raw.on !== 'boolean') return fail('on must be true or false');
      return { ok: true, request: { type: 'welcome/usage-data', on: raw.on } };
    case 'welcome/open-link':
      problem = check(['link']);
      if (problem) return fail(problem);
      if (raw.link !== 'privacy' && raw.link !== 'terms') return fail('link must be privacy or terms');
      return { ok: true, request: { type: 'welcome/open-link', link: raw.link } };
    default:
      return fail('unknown type');
  }
}
