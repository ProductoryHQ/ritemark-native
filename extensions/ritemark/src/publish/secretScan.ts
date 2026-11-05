/**
 * The guard: things in a file that would go public that look like keys or passwords (Sprint 149, R4, decision 2).
 *
 * A hit holds Publish: the sheet names the file and line, Cancel becomes its main button and Publish reads "Publish
 * anyway". The scan returns only where (the line, and the key's columns on it) and which rule, **never the matched
 * text**: nothing here keeps, logs or returns a value, so no caller can show or send one.
 *
 * One rule per line in `RULES`, each with its own failing-first fixture in `secretScan.test.ts`; the test removes
 * each rule in turn and checks that its fixture then goes unseen, so no rule is dead weight. The fixtures are built at
 * run time, so no key-shaped string sits in the repository.
 */

export interface SecretRule {
  id: string;
  /**
   * The rule. A named group `value` (or `value2`, in a second alternative) marks the key itself within the match, so
   * Open selects only the key, not its name; without one the whole match is the key.
   */
  re: RegExp;
  /** For the assignment rules: a value that is plainly a placeholder isn't a key. */
  skip?: (match: RegExpExecArray) => boolean;
}

export interface SecretHit {
  /** 1-based line of the match's start. */
  line: number;
  /** Where the key starts and ends on that line: 0-based, in UTF-16 units, as the text editor counts. */
  column: number;
  endColumn: number;
  rule: string;
}

const PLACEHOLDER_SHAPE = /^(?:x+|\*+|\.+|-+|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\})$/i;
/**
 * A value made only of placeholder words, with any separators, after a key's known prefix: `your_api_key_here`,
 * `<your-password>`, `changeme`, `sample-secret`, `sk-ant-your-key-here`, `sk-proj-xxxxx`, `mock-access-token`. A real
 * password that merely contains "sample" or "your" (`MySampleP4ssw0rd`) is not one: the words must make up the whole
 * value, and a digit anywhere makes it a value (review of #669, minor 3).
 */
const KEY_PREFIX = /^(?:sk-(?:ant-(?:api\d+-)?|proj-|svcacct-|admin-)?|(?:sk|pk|rk)_(?:live|test)_|gh[pousr]_|github_pat_|glpat-|hf_|xox[abposr]-|whsec_|gocspx-)/i;
const PLACEHOLDER_WORD_LIST = /^(?:your|yours|my|our|the|an?|this|that|real|actual|own|new|with|example|sample|dummy|fake|mock|demo|placeholder|change|changeme|me|insert|replace|redacted|here|goes|put|enter|paste|api|app|key|keys|secret|client|access|auth|oauth|bearer|refresh|session|account|user|service|private|public|project|org|id|token|password|passwd|pass|word|value|string|test|todo|tbd|foo|bar|baz|x{3,}|\*{3,})+$/;
/** `YOUR_API_KEY`, `API_KEY_HERE`: capitals and underscores only, case-sensitive. */
const CONSTANT_NAME = /^[A-Z][A-Z_]*_[A-Z_]*$/;

/** Whether a value is plainly a placeholder rather than a key. */
export function isPlaceholder(value: string): boolean {
  if (PLACEHOLDER_SHAPE.test(value) || CONSTANT_NAME.test(value)) return true;
  const rest = value.replace(KEY_PREFIX, '');
  if (/\d/.test(rest)) return false;
  const words = rest.toLowerCase().replace(/[^a-z*]+/g, '');
  return words.length > 0 && PLACEHOLDER_WORD_LIST.test(words);
}

/** The assignment rules' value (group `value`) is a key only when it isn't plainly a placeholder. */
function placeholderValue(match: RegExpExecArray): boolean {
  return isPlaceholder(match.groups?.value ?? '');
}

/** `?password=…`: a placeholder isn't a key, and a value under 16 characters is one only when it mixes letters and digits. */
function shortQueryValue(match: RegExpExecArray): boolean {
  const value = match.groups?.value ?? '';
  if (isPlaceholder(value)) return true;
  return value.length < 16 && (!/[A-Za-z]/.test(value) || !/\d/.test(value));
}

/** For a rule whose whole match is the key (`sk-ant-…`): a key only when the match isn't plainly a placeholder. */
function wholeMatchPlaceholder(match: RegExpExecArray): boolean {
  return isPlaceholder(match[0]);
}

/**
 * The broad rules (a bare `token`, a `?token=`): a value is a key only when it mixes letters and digits and isn't a
 * placeholder, so prose, words and page numbers stay quiet.
 */
function notKeyLike(match: RegExpExecArray): boolean {
  const value = match.groups?.value ?? '';
  return !/[A-Za-z]/.test(value) || !/\d/.test(value) || isPlaceholder(value);
}

/** The words of a name: `DB_PASSWORD` → db, password; `dbPassword` → db, password; `APIKey` → apikey. */
function nameParts(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
const SECRET_WORDS = new Set(['password', 'passwd', 'secret', 'token', 'apikey', 'accesskey', 'privatekey', 'secretkey']);
const SECRET_PAIRS = new Set(['api key', 'access key', 'private key']);
/** A name whose last word says what the value is about, not that it is the key: `password_hint`, `token_url`. */
const DESCRIBING_WORDS = new Set([
  'url', 'uri', 'urls', 'path', 'file', 'filename', 'dir', 'endpoint', 'host', 'name', 'id', 'type', 'kind', 'length',
  'len', 'min', 'max', 'count', 'hint', 'label', 'field', 'prompt', 'policy', 'header', 'param', 'expiry', 'expires',
  'expiration', 'ttl', 'enabled', 'required', 'regex', 'pattern', 'format', 'placeholder', 'title', 'text', 'message',
  'msg', 'error', 'help', 'description', 'desc', 'mode', 'version', 'algorithm', 'alg', 'provider', 'env', 'var', 'ref',
  'location', 'color', 'colour', 'bg', 'style', 'class', 'input', 'form', 'button', 'icon', 'source', 'store', 'manager',
]);
/** Tokens a page or an API hands out openly: a form's CSRF token, a list's next-page token. */
const OPEN_TOKEN_WORDS = new Set(['csrf', 'xsrf', 'page', 'next', 'continuation', 'sync', 'cancel', 'cancellation', 'cursor', 'pagination']);

/** Whether a name names a key or password: `DB_PASSWORD`, `api_key`, `client_secret`, `GITHUB_TOKEN`, `db.passwd`. */
export function namesSecret(name: string): boolean {
  const parts = nameParts(name);
  if (parts.length === 0) return false;
  const named = parts.some((part, i) => SECRET_WORDS.has(part) || (i > 0 && SECRET_PAIRS.has(`${parts[i - 1]} ${part}`)));
  if (!named) return false;
  if (DESCRIBING_WORDS.has(parts[parts.length - 1])) return false;
  return !parts.some((part) => OPEN_TOKEN_WORDS.has(part));
}

/**
 * The unquoted assignment rule's strength test (round 4 of #669): the name names a key, and the value is one. At least
 * 12 characters (the rule) mixing letters and digits, not a placeholder, and not something that only points to a key:
 * a variable (`$X`, `%X%`), a URL, a path or a date. `process.env.DB_PASSWORD` has no digit. Prose
 * ("password = the one you chose") fails on length or digits; a word list like `changeme_changeme` on the placeholder
 * test.
 */
function weakUnquoted(match: RegExpExecArray): boolean {
  const name = match.groups?.name ?? '';
  const value = match.groups?.value ?? '';
  if (!namesSecret(name)) return true;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return true;
  if (isPlaceholder(value)) return true;
  if (/^[$%]/.test(value)) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(?:\.{0,2}|~)\//.test(value)) return true;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * Every name part is bounded (`{0,40}`, `{1,24}`, `{0,4}`): an unbounded `[\w.-]*` before a word made one long run of
 * letters and dashes cost seconds (quadratic), and a minified script is exactly such a run.
 */
export const RULES: readonly SecretRule[] = [
  { id: 'private-key', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g },
  // `sk-ant-your-key-here-xxxx…` is a placeholder: the same whole-phrase skip as the assignment rules (round 3 of #669)
  { id: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, skip: wholeMatchPlaceholder },
  { id: 'openai', re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}/g },
  { id: 'google-api', re: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g },
  { id: 'google-oauth-secret', re: /\bGOCSPX-[A-Za-z0-9_-]{28}(?![A-Za-z0-9_-])/g },
  { id: 'aws-access-key', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { id: 'aws-secret', re: /\baws_?secret_?access_?key\b\s*["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/gi },
  { id: 'github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g },
  { id: 'slack-token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { id: 'slack-webhook', re: /hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]{20,}/g },
  { id: 'stripe', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  // `CF_API_TOKEN=…`, `const CF_API_TOKEN = "…"`, `{"CLOUDFLARE_API_TOKEN": "…"}`, `cloudflareApiToken: '…'`
  { id: 'cloudflare', re: /\b(?:CF|CLOUDFLARE)_?[A-Z_]{0,30}?(?:TOKEN|KEY)\b["']?\s*[:=]\s*["'`]?(?<value>[A-Za-z0-9_-]{37,})|X-Auth-Key["']?\s*[:=,]\s*["']?(?<value2>[a-f0-9]{37})\b/gi },
  { id: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'assignment', re: /\b[\w.-]{0,40}?(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key)[\w-]{0,40}["']?\s*[:=]\s*["'`](?<value>[^"'`\s]{12,})["'`]/gi, skip: placeholderValue },
  // `?api_key=…`, `&client_secret=…`; from 12 characters when the value mixes letters and digits (round 4 of #669)
  { id: 'query-key', re: /[?&](?:[a-z]{1,24}[_-])?(?:api[_-]?key|apikey|access[_-]?(?:token|key)|auth[_-]?token|private[_-]?key|password|passwd|secret)=(?<value>[^&#\s"'<>]{12,})/gi, skip: shortQueryValue },
  { id: 'huggingface', re: /\bhf_(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]{30,}(?![A-Za-z0-9_])/g },
  { id: 'gitlab', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { id: 'stripe-webhook', re: /\bwhsec_[A-Za-z0-9+/=]{24,}/g },
  { id: 'query-token', re: /[?&](?:[a-z]+[_-])?token=(?<value>[A-Za-z0-9._~+/=-]{16,})(?=[&#\s"'<>]|$)/gi, skip: notKeyLike },
  // `token = "…"`, `"token": "…"`, `BOT_TOKEN = '…'`, `apiToken: "…"`; never `csrfToken` or `nextPageToken` (camel case
  // only with the prefixes that name a key), and only a long value that mixes letters and digits
  // A Telegram bot token, `123456789:AAF…`: the bot's number, a colon and 35 base64url characters. Its colon is outside
  // `token-assignment`'s value class, so it has its own rule and is found wherever it stands (round 3 of #669)
  { id: 'telegram-bot', re: /(?<![\d:])\d{8,12}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g },
  { id: 'token-assignment', re: /\b(?:(?:[A-Za-z0-9]{1,24}[_-]){0,4}token|(?:api|bot|bearer|refresh|session|personal|secret|private|github|gitlab|slack|discord|telegram|npm)token)["']?\s*[:=]\s*["'`](?<value>[A-Za-z0-9._~+/=-]{20,})["'`]/gi, skip: notKeyLike },
  // Unquoted, as in .env, .ini, YAML, Java properties and connection strings (round 4 of #669): `DB_PASSWORD=…`,
  // `password = … ; note`, `  api_key: …`, `Server=db;Password=…;`. The name starts a word (never inside another name
  // or after `?`/`&`, which the query rules own); the value runs to whitespace, `;`, `&`, a quote, `<`, `#` or the end
  // of the line. Which names and values count is `weakUnquoted`'s strength test. Both parts are bounded (linear time).
  { id: 'assignment-unquoted', re: /(?<![\w.?&$@-])(?<name>[A-Za-z_][\w.-]{0,59})[ \t]*[:=][ \t]*(?<value>[^\s"'`;&,<>(){}[\]=#:][^\s"'`;&,<>(){}[\]=#]{11,255}=*)(?=[\s;&"'`<>#]|$)/gm, skip: weakUnquoted },
];

/** A match made with the `d` flag (ES2022's indices; the extension's lib is ES2020). */
type IndexedMatch = RegExpExecArray & {
  indices?: Array<[number, number]> & { groups?: Record<string, [number, number] | undefined> };
};

/** Whether bytes are text: no NUL in the first 8 KB, as Git decides. */
export function isText(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, 8192);
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return false;
  return true;
}

/** The most places one file reports; the sheet shows three. */
const MAX_HITS_PER_FILE = 100;

/**
 * Where `text` holds something that looks like a key or password: one hit per line (the first rule that matches it),
 * in line order. The matched text is never returned.
 */
export function scanText(text: string, rules: readonly SecretRule[] = RULES): SecretHit[] {
  // The text editor drops a leading byte-order mark, so line 1's columns count from after it
  const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const lineOf = (index: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const byLine = new Map<number, SecretHit>();
  for (const rule of rules) {
    let flags = rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g';
    if (!flags.includes('d')) flags += 'd';
    const re = new RegExp(rule.re.source, flags);
    let match: RegExpExecArray | null;
    let found = 0;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) re.lastIndex++;
      if (rule.skip?.(match)) continue;
      const line = lineOf(match.index);
      if (!byLine.has(line)) {
        const indices = (match as IndexedMatch).indices;
        const span = indices?.groups?.value ?? indices?.groups?.value2 ?? indices?.[0] ?? [match.index, match.index + match[0].length];
        const lineStart = lineStarts[line - 1];
        const lineEnd = line < lineStarts.length ? lineStarts[line] - 1 : text.length;
        const shift = line === 1 ? bom : 0;
        const column = Math.max(0, span[0] - lineStart - shift);
        const endColumn = Math.max(column, Math.min(span[1], lineEnd) - lineStart - shift);
        byLine.set(line, { line, column, endColumn, rule: rule.id });
      }
      if (++found >= MAX_HITS_PER_FILE) break;
    }
  }
  return [...byLine.values()]
    .sort((a, b) => a.line - b.line)
    .slice(0, MAX_HITS_PER_FILE);
}
