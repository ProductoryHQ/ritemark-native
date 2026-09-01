import type { ModelOption } from './types';

export function parseModelDescription(description: string | undefined): {
  versionLine: string | null;
  tagline: string;
} {
  if (!description) return { versionLine: null, tagline: '' };
  const separator = description.indexOf(' · ');
  if (separator < 0) return { versionLine: null, tagline: description.trim() };
  return {
    versionLine: description.slice(0, separator).trim(),
    tagline: description.slice(separator + 3).trim(),
  };
}

/**
 * Return the same primary name used by a picker row. Live Claude aliases may
 * have a generic request label ("Sonnet") while their description carries the
 * resolved version ("Sonnet 5 · …"). The closed selector and AI disclosure
 * must never regress to the ambiguous alias after a live catalog refresh.
 */
export function modelDisplayName(
  model: Pick<ModelOption, 'id' | 'label' | 'description'> | undefined,
  preferDescriptionVersion = false,
): string {
  if (!model) return '';
  const versionLine = preferDescriptionVersion
    ? parseModelDescription(model.description).versionLine
    : null;
  return versionLine || model.label || model.id;
}
