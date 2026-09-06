/** Sprint 113 R5 — preserve real names while normalising accidental spacing. */
export function normalizeSpeakerLabel(value: unknown): string | null {
  const normalized = String(value ?? '').trim().replace(/\s+/gu, ' ');
  return normalized || null;
}
