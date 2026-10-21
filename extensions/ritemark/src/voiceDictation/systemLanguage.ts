/**
 * The person's own language, for dictation's first default (#486).
 *
 * Ritemark ships no language packs, so `vscode.env.language` is English for
 * everyone. VS Code's main process puts the operating system's first preferred
 * language into `VSCODE_NLS_CONFIG.osLocale` (vscode/src/mainImpl.ts), and the
 * extension host inherits that environment.
 */
export function systemLanguage(env: Record<string, string | undefined>, fallback: string): string {
  try {
    const osLocale = JSON.parse(env.VSCODE_NLS_CONFIG ?? '{}')?.osLocale;
    if (typeof osLocale === 'string' && osLocale.trim()) {
      return osLocale.trim();
    }
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}
