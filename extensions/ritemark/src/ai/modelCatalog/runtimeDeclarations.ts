/**
 * Runtime declarations — telling the Claude Code CLI about models it was not
 * built with (Sprint 127 R1, R7).
 *
 * The bundled CLI lists only its compiled model table. The SDK's
 * `settings.modelPicker` ("independent of the built-in lineup and of Claude
 * Code releases") adds rows to that list, so a declared model appears in
 * `supportedModels()` and runs with the CLI's current-generation defaults. The
 * runtime stays the runnability authority: a row it does not echo back is not
 * shown.
 *
 * Pure: no vscode / network / fs imports, so it is unit-testable with tsx.
 */

import type { ModelEntry } from './schema';
import { CLAUDE_MODEL_ID_PATTERN } from './schema';

export interface ClaudeModelPickerOption {
  model: string;
  label: string;
  description?: string;
  /** Curated rows only; automated rows never carry a behavior profile (R7). */
  behavesAs?: string;
}

export interface ClaudeModelPickerSettings {
  modelPicker: { options: ClaudeModelPickerOption[] };
}

export interface ClaudeRuntimeDeclarations {
  /** Rows for `settings.modelPicker.options`, in catalog order. */
  pickerOptions: ClaudeModelPickerOption[];
  /** Extra CLI environment for a session that runs the model, by request id. */
  envByModel: Record<string, Record<string, string>>;
  /** Changes whenever the declared set or its environment changes. */
  signature: string;
}

/** What one Claude session needs to run a declared model. */
export interface ClaudeSessionDeclaration {
  settings: ClaudeModelPickerSettings;
  env?: Record<string, string>;
}

export const NO_CLAUDE_DECLARATIONS: ClaudeRuntimeDeclarations = Object.freeze({
  pickerOptions: [],
  envByModel: {},
  signature: '[]',
}) as ClaudeRuntimeDeclarations;

/** Build the declarations from the merged static anthropic rows (R1). */
export function buildClaudeRuntimeDeclarations(rows: readonly ModelEntry[]): ClaudeRuntimeDeclarations {
  const declared = rows
    .filter((row) => row.claudeCode?.inject === true && !row.retired && CLAUDE_MODEL_ID_PATTERN.test(row.id))
    .sort((a, b) => a.order - b.order);
  if (declared.length === 0) return NO_CLAUDE_DECLARATIONS;

  const pickerOptions = declared.map((row): ClaudeModelPickerOption => {
    const behavesAs = row.provenance === 'auto' ? undefined : row.claudeCode?.behavesAs;
    return {
      model: row.id,
      label: row.label,
      ...(row.description ? { description: row.description } : {}),
      ...(behavesAs && CLAUDE_MODEL_ID_PATTERN.test(behavesAs) ? { behavesAs } : {}),
    };
  });
  const envByModel: Record<string, Record<string, string>> = {};
  for (const row of declared) {
    const maxOutputTokens = row.claudeCode?.maxOutputTokens;
    // The CLI's default for a model it does not know is 32K output tokens.
    if (maxOutputTokens) envByModel[row.id] = { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxOutputTokens) };
  }
  return { pickerOptions, envByModel, signature: JSON.stringify({ pickerOptions, envByModel }) };
}

/** SDK `settings` for a discovery probe that must list every declared model. */
export function discoveryPickerSettings(declarations: ClaudeRuntimeDeclarations): ClaudeModelPickerSettings | undefined {
  return declarations.pickerOptions.length > 0
    ? { modelPicker: { options: declarations.pickerOptions } }
    : undefined;
}

/**
 * What a session needs to run `modelId`. Only a declared model gets anything:
 * `modelPicker` from the SDK layer replaces a user's own `modelPicker` for the
 * whole session, so a session that does not need it must not carry it.
 */
export function sessionDeclarationFor(
  declarations: ClaudeRuntimeDeclarations,
  modelId: string | undefined,
): ClaudeSessionDeclaration | undefined {
  if (!modelId) return undefined;
  const option = declarations.pickerOptions.find((candidate) => candidate.model === modelId);
  if (!option) return undefined;
  const env = declarations.envByModel[modelId];
  return { settings: { modelPicker: { options: [option] } }, ...(env ? { env: { ...env } } : {}) };
}

/**
 * Drop a declared row that the runtime also lists natively under another
 * request id, e.g. a declared `claude-<new>` next to a newer CLI's `opus[1m]`
 * resolving to `claude-<new>[1m]` (S3). Identities compare without a trailing
 * `[1m]`; request ids themselves are never rewritten.
 */
export function dropShadowedDeclarations<T extends { id: string; resolvedModel?: string }>(
  rows: readonly T[],
  declaredIds: readonly string[],
): T[] {
  if (declaredIds.length === 0) return [...rows];
  const declared = new Set(declaredIds);
  const nativeIdentities = new Set(
    rows.filter((row) => !declared.has(row.id)).map((row) => withoutOneMillion(row.resolvedModel ?? row.id)),
  );
  return rows.filter((row) => !declared.has(row.id) || !nativeIdentities.has(withoutOneMillion(row.id)));
}

function withoutOneMillion(id: string): string {
  return id.replace(/\[1m\]$/i, '');
}

export type FeedPollAction = 'probe' | 'resolve' | 'none';

/**
 * Sprint 127 R5: what a feed check does next. The runtime probe spawns the CLI,
 * so it runs only when the declared set changed; any other change re-resolves
 * from the last probe, and an unchanged feed (a 304) does nothing.
 */
export function feedPollAction(input: {
  declarationsChanged: boolean;
  feedChanged: boolean;
  probeAllowed: boolean;
}): FeedPollAction {
  if (input.declarationsChanged && input.probeAllowed) return 'probe';
  if (input.declarationsChanged || input.feedChanged) return 'resolve';
  return 'none';
}
