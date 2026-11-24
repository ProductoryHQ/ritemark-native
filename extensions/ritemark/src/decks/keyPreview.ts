// Shared by the host's scan and the deck editor's Show it action.
const PREFIXES = ['github_pat_', 'sk-proj-', 'sk-ant-', 'xoxb-', 'ghp_', 'AKIA', 'AIza', 'sk-'];

/**
 * The kind and the last four (the Experience lead, Experience 52): `sk-ant-…7f3a`. A known prefix isn't secret, so
 * what follows it must be at least 16 characters; a key of no known kind shows its first three as well, so it must be
 * at least 20. Either way at least 12 of the secret's characters stay hidden, and a short password gets no preview.
 */
export function previewKey(match: string): string | undefined {
  const known = PREFIXES.find(value => match.startsWith(value));
  if (known ? match.length - known.length < 16 : match.length < 20) return undefined;
  return `${known ?? match.slice(0, 3)}…${match.slice(-4)}`;
}

export function isKeyPreview(preview: string): boolean {
  const [prefix, suffix, extra] = preview.split('…');
  return extra === undefined && suffix !== undefined && (
    (prefix.length === 1 && suffix.length === 1) || // Previously stored previews.
    (suffix.length === 4 && (prefix.length === 3 || PREFIXES.includes(prefix)))
  );
}

export function matchesKeyPreview(match: string, preview: string): boolean {
  if (/^.….$/u.test(preview)) return `${match[0]}…${match.slice(-1)}` === preview;
  return previewKey(match) === preview;
}
