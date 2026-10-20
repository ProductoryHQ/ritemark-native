/**
 * Dictation's first language (#486): the person's own language when Whisper has
 * it, then English. After the first pick, the person's own choice wins (it is
 * kept in the editor's localStorage by VoiceDictationButton).
 */

let systemLocale: string | undefined

/** Set from the editor's load message: the operating system's language, such as "et-ee". */
export function setDictationSystemLanguage(locale: string | undefined): void {
  systemLocale = locale
}

/** The Whisper code for a locale ("et-ee" → "et", "nb-no" → "no"), or English when Whisper lacks it. */
export function dictationLanguageFor(locale: string | undefined, known: readonly string[]): string {
  const primary = (locale ?? '').trim().toLowerCase().split(/[-_]/)[0]
  // Whisper names Norwegian "no"; operating systems say Bokmål or Nynorsk.
  const code = primary === 'nb' || primary === 'nn' ? 'no' : primary
  return code && known.includes(code) ? code : 'en'
}

/** The language a fresh profile starts with. */
export function defaultDictationLanguage(known: readonly string[]): string {
  return dictationLanguageFor(systemLocale, known)
}

/** The recent list a fresh profile starts with: the person's language, then English. */
export function defaultRecentLanguages(known: readonly string[]): string[] {
  return [...new Set([defaultDictationLanguage(known), 'en'])]
}
