/**
 * The guard: things in a file that would go public that look like keys or passwords (Sprint 149, R4, decision 2).
 *
 * A hit holds Publish: the sheet names the file and line, Cancel becomes its main button and Publish reads "Publish
 * anyway". The scan returns only where and which rule, **never the matched text**: nothing here keeps, logs or returns
 * a value, so no caller can show or send one.
 *
 * One rule per line in `RULES`, each with its own failing-first fixture in `secretScan.test.ts`; the test removes
 * each rule in turn and checks that its fixture then goes unseen, so no rule is dead weight. The fixtures are built at
 * run time, so no key-shaped string sits in the repository.
 */

export interface SecretRule {
  id: string;
  re: RegExp;
  /** For the assignment rule: a value that is plainly a placeholder isn't a key. */
  skip?: (match: RegExpExecArray) => boolean;
}

export interface SecretHit {
  /** 1-based line of the match's start. */
  line: number;
  rule: string;
}

const PLACEHOLDER_SHAPE = /^(?:x+|\*+|\.+|-+|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\})$/i;
const PLACEHOLDER_WORDS = /your|example|placeholder|changeme|change_me|dummy|sample|insert|replace|redacted|xxxx|\*\*\*\*/i;
/** `YOUR_API_KEY`, `API_KEY_HERE`: capitals and underscores only, case-sensitive. */
const CONSTANT_NAME = /^[A-Z][A-Z_]*_[A-Z_]*$/;

/** The assignment rules' value (group `value`) is a key only when it isn't plainly a placeholder. */
function placeholderValue(match: RegExpExecArray): boolean {
  const value = match.groups?.value ?? '';
  return PLACEHOLDER_SHAPE.test(value) || PLACEHOLDER_WORDS.test(value) || CONSTANT_NAME.test(value);
}

export const RULES: readonly SecretRule[] = [
  { id: 'private-key', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai', re: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}/g },
  { id: 'google-api', re: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g },
  { id: 'google-oauth-secret', re: /\bGOCSPX-[A-Za-z0-9_-]{28}(?![A-Za-z0-9_-])/g },
  { id: 'aws-access-key', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { id: 'aws-secret', re: /\baws_?secret_?access_?key\b\s*["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/gi },
  { id: 'github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g },
  { id: 'slack-token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { id: 'slack-webhook', re: /hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]{20,}/g },
  { id: 'stripe', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'cloudflare', re: /\b(?:CF|CLOUDFLARE)_?[A-Z_]*(?:TOKEN|KEY)\b\s*[:=]\s*[A-Za-z0-9_-]{37,}|X-Auth-Key["']?\s*[:=,]\s*["']?[a-f0-9]{37}\b/gi },
  { id: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { id: 'assignment', re: /\b[\w.-]*(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key)[\w-]*["']?\s*[:=]\s*["'`](?<value>[^"'`\s]{12,})["'`]/gi, skip: placeholderValue },
  { id: 'query-key', re: /[?&](?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|password|secret)=(?<value>[^&#\s"'<>]{16,})/gi, skip: placeholderValue },
];

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
  const byLine = new Map<number, string>();
  for (const rule of rules) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
    let match: RegExpExecArray | null;
    let found = 0;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) re.lastIndex++;
      if (rule.skip?.(match)) continue;
      const line = lineOf(match.index);
      if (!byLine.has(line)) byLine.set(line, rule.id);
      if (++found >= MAX_HITS_PER_FILE) break;
    }
  }
  return [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_HITS_PER_FILE)
    .map(([line, rule]) => ({ line, rule }));
}
