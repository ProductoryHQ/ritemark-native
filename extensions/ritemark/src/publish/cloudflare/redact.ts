/**
 * Every text that leaves the Cloudflare client (an error's message, a log line) goes through `redact` first
 * (spec R7, S21): the token, the account ID and any JWT Cloudflare echoes back become placeholders.
 */

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /(Bearer\s+)[^\s"',;]+/gi;

export function redact(text: unknown, secrets: ReadonlyArray<string | null | undefined>): string {
  let out = String(text);
  // The longest first, so a secret that contains another is replaced whole
  const known = secrets.filter((s): s is string => typeof s === 'string' && s.length >= 4).sort((a, b) => b.length - a.length);
  for (const secret of known) out = out.split(secret).join('<redacted>');
  return out.replace(JWT, '<jwt>').replace(BEARER, '$1<redacted>');
}
