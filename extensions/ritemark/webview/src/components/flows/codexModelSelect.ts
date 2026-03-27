export const CODEX_DEFAULT_MODEL_SENTINEL = '__default_codex_model__';

export function getCodexModelSelectValue(model?: string): string {
  return model && model.trim() ? model : CODEX_DEFAULT_MODEL_SENTINEL;
}

export function getCodexModelFromSelectValue(value: string): string {
  return value === CODEX_DEFAULT_MODEL_SENTINEL ? '' : value;
}
