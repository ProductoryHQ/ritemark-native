export const MAX_CONVERSATION_TITLE_LENGTH = 80;
export const MIN_GENERATED_TITLE_WORDS = 3;
export const MAX_GENERATED_TITLE_WORDS = 6;

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
function trimOuterDecoration(value: string): string {
  return value
    .replace(/^(?:title\s*:\s*)/i, '')
    .replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, '')
    .replace(/[.!?,;:–—-]+$/g, '')
    .trim();
}

function shortenAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength - 1).trimEnd();
  const boundary = candidate.lastIndexOf(' ');
  const shortened = boundary >= Math.floor(maxLength * 0.55)
    ? candidate.slice(0, boundary)
    : candidate;
  return `${shortened.trimEnd()}…`;
}

/** Immediate, deterministic title shown before the first assistant response. */
export function fallbackTitleFromPrompt(prompt: string): string {
  const value = compact(prompt);
  if (!value) return 'New conversation';
  const sentenceEnd = value.search(/[.!?](?:\s|$)/);
  const firstThought = sentenceEnd >= 0 ? value.slice(0, sentenceEnd + 1) : value;
  return shortenAtWordBoundary(firstThought, MAX_CONVERSATION_TITLE_LENGTH);
}

/** Strictly accepts a plain 3–6-word model result; invalid output keeps the fallback. */
export function normalizeGeneratedTitle(value: string): string | null {
  const normalized = compact(trimOuterDecoration(value));
  if (!normalized || /[\r\n]/.test(value.trim())) return null;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < MIN_GENERATED_TITLE_WORDS) return null;
  return shortenAtWordBoundary(
    words.slice(0, MAX_GENERATED_TITLE_WORDS).join(' '),
    MAX_CONVERSATION_TITLE_LENGTH,
  );
}

/** Manual titles share the host's whitespace and length rules but not the AI word limit. */
export function normalizeManualTitle(value: string): string | null {
  const normalized = compact(value);
  if (!normalized) return null;
  return shortenAtWordBoundary(normalized, MAX_CONVERSATION_TITLE_LENGTH);
}
