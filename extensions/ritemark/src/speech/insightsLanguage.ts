/** Sprint 113 R6 — open-ended, data-only Insights output-language contract. */

export type InsightsLanguageSelection =
  | { kind: 'auto' }
  | { kind: 'known'; code: string }
  | { kind: 'custom'; name: string };

export type InsightsOutputLanguage = Exclude<InsightsLanguageSelection, { kind: 'auto' }>;

export interface InsightsLanguageMetadata {
  selected: InsightsLanguageSelection;
  resolved: InsightsOutputLanguage;
}

export interface InsightsLanguageOption {
  id: string;
  code: string;
  label: string;
  nativeLabel?: string;
  aliases?: readonly string[];
}

type LegacyInsightsLanguage = 'auto' | 'et' | 'en';

const LANGUAGE_TAGS = [
  'et', 'en', 'de', 'fi', 'sv', 'lv', 'lt', 'fr', 'es', 'it', 'pt', 'nl', 'da', 'no',
  'is', 'pl', 'cs', 'sk', 'sl', 'hu', 'ro', 'bg', 'hr', 'sr', 'bs', 'mk', 'sq', 'el',
  'tr', 'uk', 'ru', 'be', 'ka', 'hy', 'az', 'kk', 'uz', 'ky', 'tg', 'tk', 'ar', 'he',
  'fa', 'ur', 'ps', 'ku', 'hi', 'bn', 'pa', 'gu', 'mr', 'ne', 'si', 'ta', 'te', 'kn',
  'ml', 'or', 'as', 'sa', 'zh', 'ja', 'ko', 'vi', 'th', 'id', 'ms', 'tl', 'jv', 'su',
  'my', 'km', 'lo', 'mn', 'bo', 'ug', 'sw', 'am', 'so', 'ha', 'yo', 'ig', 'zu', 'xh',
  'af', 'st', 'sn', 'rw', 'mg', 'ny', 'co', 'ca', 'gl', 'eu', 'cy', 'ga', 'gd', 'br',
  'mt', 'lb', 'fy', 'la', 'eo', 'ht', 'mi', 'sm', 'haw', 'oc', 'rm', 'fo', 'yi',
] as const;

const LANGUAGE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  et: ['eesti'],
  en: ['inglise'],
  de: ['deutsch', 'saksa'],
  fi: ['suomi', 'soome'],
  sv: ['svenska', 'rootsi'],
  fr: ['français', 'prantsuse'],
  es: ['español', 'hispaania'],
  pt: ['português'],
  nl: ['nederlands'],
  no: ['norsk'],
  cs: ['čeština'],
  el: ['greek'],
  he: ['hebrew'],
  fa: ['persian', 'farsi'],
  zh: ['mandarin', 'putonghua', '中文'],
  ja: ['nihongo', '日本語'],
  ko: ['hangul', '한국어'],
  tl: ['filipino'],
};

/** Bundled CLDR-derived endonyms keep native-name search reliable in small-ICU Electron builds. */
const NATIVE_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  et: 'eesti', en: 'English', de: 'Deutsch', fi: 'suomi', sv: 'svenska', lv: 'latviešu',
  lt: 'lietuvių', fr: 'français', es: 'español', it: 'italiano', pt: 'português',
  nl: 'Nederlands', da: 'dansk', no: 'norsk', is: 'íslenska', pl: 'polski', cs: 'čeština',
  sk: 'slovenčina', sl: 'slovenščina', hu: 'magyar', ro: 'română', bg: 'български',
  hr: 'hrvatski', sr: 'српски', bs: 'bosanski', mk: 'македонски', sq: 'shqip',
  el: 'Ελληνικά', tr: 'Türkçe', uk: 'українська', ru: 'русский', be: 'беларуская',
  ka: 'ქართული', hy: 'հայերեն', az: 'azərbaycan', kk: 'қазақ тілі', uz: 'o‘zbek',
  ky: 'кыргызча', tg: 'тоҷикӣ', tk: 'türkmen dili', ar: 'العربية', he: 'עברית',
  fa: 'فارسی', ur: 'اردو', ps: 'پښتو', ku: 'kurdî (kurmancî)', hi: 'हिन्दी', bn: 'বাংলা',
  pa: 'ਪੰਜਾਬੀ', gu: 'ગુજરાતી', mr: 'मराठी', ne: 'नेपाली', si: 'සිංහල', ta: 'தமிழ்',
  te: 'తెలుగు', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', or: 'ଓଡ଼ିଆ', as: 'অসমীয়া', sa: 'संस्कृत भाषा',
  zh: '中文', ja: '日本語', ko: '한국어', vi: 'Tiếng Việt', th: 'ไทย', id: 'Indonesia',
  ms: 'Melayu', tl: 'Filipino', jv: 'Jawa', su: 'Basa Sunda', my: 'မြန်မာ', km: 'ខ្មែរ',
  lo: 'ລາວ', mn: 'монгол', bo: 'བོད་སྐད་', ug: 'ئۇيغۇرچە', sw: 'Kiswahili', am: 'አማርኛ',
  so: 'Soomaali', ha: 'Hausa', yo: 'Èdè Yorùbá', ig: 'Igbo', zu: 'isiZulu',
  xh: 'IsiXhosa', af: 'Afrikaans', st: 'Sesotho', sn: 'chiShona', rw: 'Ikinyarwanda',
  mg: 'Malagasy', ny: 'Nyanja', co: 'Corsican', ca: 'català', gl: 'galego', eu: 'euskara',
  cy: 'Cymraeg', ga: 'Gaeilge', gd: 'Gàidhlig', br: 'brezhoneg', mt: 'Malti',
  lb: 'Lëtzebuergesch', fy: 'Frysk', la: 'Latin', eo: 'Esperanto', ht: 'Haitian Creole',
  mi: 'Māori', sm: 'Samoan', haw: 'ʻŌlelo Hawaiʻi', oc: 'occitan', rm: 'rumantsch',
  fo: 'føroyskt', yi: 'ייִדיש',
};

type DisplayNamesConstructor = new (
  locales: string | readonly string[],
  options: { type: 'language'; fallback?: 'code' | 'none' },
) => { of(code: string): string | undefined };

function displayName(code: string, locale: string): string | undefined {
  try {
    const Constructor = (Intl as unknown as { DisplayNames?: DisplayNamesConstructor }).DisplayNames;
    return Constructor ? new Constructor(locale, { type: 'language', fallback: 'none' }).of(code) : undefined;
  } catch {
    return undefined;
  }
}

function makeOption(code: string): InsightsLanguageOption {
  const label = displayName(code, 'en') ?? code.toUpperCase();
  const native = NATIVE_LANGUAGE_NAMES[code] ?? displayName(code, code);
  return {
    id: code,
    code,
    label,
    ...(native && fold(native) !== fold(label) ? { nativeLabel: native } : {}),
    ...(LANGUAGE_ALIASES[code] ? { aliases: LANGUAGE_ALIASES[code] } : {}),
  };
}

/** A broad standard-language catalog; Auto and custom values are separate choices. */
export const INSIGHTS_LANGUAGE_OPTIONS: readonly InsightsLanguageOption[] = Array.from(
  new Set<string>(LANGUAGE_TAGS),
  makeOption,
);

const OPTION_BY_CODE = new Map(INSIGHTS_LANGUAGE_OPTIONS.map((option) => [option.code, option]));

export function getInsightsLanguageSuggestions(query: string, limit = 8): InsightsLanguageOption[] {
  const requested = Math.max(0, Math.min(50, Math.floor(limit)));
  if (requested === 0) return [];

  const needle = fold(query);
  if (!needle) return INSIGHTS_LANGUAGE_OPTIONS.slice(0, requested);

  return INSIGHTS_LANGUAGE_OPTIONS
    .map((option, index) => ({ option, index, score: suggestionScore(option, needle) }))
    .filter((candidate) => candidate.score < Number.POSITIVE_INFINITY)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, requested)
    .map((candidate) => candidate.option);
}

/** Commit free-form combobox text, canonicalising exact catalog names/aliases. */
export function normalizeCustomInsightsLanguage(query: string): InsightsLanguageSelection | null {
  const name = normalizeLanguageName(query);
  if (!name) return null;

  const normalized = fold(name);
  if (normalized === 'auto') return { kind: 'auto' };

  const known = INSIGHTS_LANGUAGE_OPTIONS.find((option) =>
    [option.code, option.label, option.nativeLabel, ...(option.aliases ?? [])]
      .some((candidate) => candidate !== undefined && fold(candidate) === normalized));
  return known ? { kind: 'known', code: known.code } : { kind: 'custom', name };
}

/** Whether an entered query has neither a committable value nor a catalog result. */
export function isInsightsLanguageQueryInvalid(query: string): boolean {
  const normalizedQuery = query.trim();
  return Boolean(
    normalizedQuery
    && !normalizeCustomInsightsLanguage(normalizedQuery)
    && getInsightsLanguageSuggestions(normalizedQuery, 1).length === 0,
  );
}

export function isInsightsLanguageSelection(value: unknown): value is InsightsLanguageSelection {
  if (!isRecord(value)) return false;
  if (value.kind === 'auto') return exactKeys(value, ['kind']);
  if (value.kind === 'known') {
    return exactKeys(value, ['kind', 'code'])
      && typeof value.code === 'string'
      && OPTION_BY_CODE.has(value.code);
  }
  if (value.kind === 'custom') {
    return exactKeys(value, ['kind', 'name'])
      && typeof value.name === 'string'
      && normalizeLanguageName(value.name) === value.name
      && normalizeCustomInsightsLanguage(value.name)?.kind === 'custom';
  }
  return false;
}

export function resolveInsightsLanguage(
  selected: InsightsLanguageSelection,
  transcriptLanguage: string | null | undefined,
): InsightsOutputLanguage {
  if (selected.kind !== 'auto') return selected;
  return canonicalDetectedLanguage(transcriptLanguage) ?? { kind: 'known', code: 'en' };
}

export function insightsLanguageSelectionLabel(selection: InsightsLanguageSelection): string {
  if (selection.kind === 'auto') return 'Auto';
  if (selection.kind === 'custom') return selection.name;
  return OPTION_BY_CODE.get(selection.code)?.label ?? selection.code;
}

/** Compatibility name retained for Markdown and older UI call sites. */
export function insightsLanguageLabel(language: InsightsOutputLanguage): string {
  return insightsLanguageSelectionLabel(language);
}

/** Convert both the new shape and Sprint 113's earlier auto/et/en shape. */
export function coerceInsightsLanguageMetadata(value: unknown): InsightsLanguageMetadata | undefined {
  if (!isRecord(value) || !exactKeys(value, ['selected', 'resolved'])) return undefined;

  if (isInsightsLanguageSelection(value.selected) && isInsightsOutputLanguage(value.resolved)) {
    if (value.selected.kind !== 'auto' && !sameOutput(value.selected, value.resolved)) return undefined;
    return { selected: value.selected, resolved: value.resolved };
  }

  if (isLegacyLanguage(value.selected) && isLegacyOutput(value.resolved)) {
    const selected: InsightsLanguageSelection = value.selected === 'auto'
      ? { kind: 'auto' }
      : { kind: 'known', code: value.selected };
    const resolved: InsightsOutputLanguage = value.selected === 'auto'
      ? { kind: 'known', code: value.resolved }
      : { kind: 'known', code: value.selected };
    return { selected, resolved };
  }

  return undefined;
}

/** Missing pre-Sprint-113 Insights were generated by an implicitly English prompt. */
export function insightsLanguageProvenance(language: unknown): InsightsLanguageMetadata & { legacy: boolean } {
  const coerced = coerceInsightsLanguageMetadata(language);
  return coerced
    ? { ...coerced, legacy: false }
    : {
        selected: { kind: 'known', code: 'en' },
        resolved: { kind: 'known', code: 'en' },
        legacy: true,
      };
}

function normalizeLanguageName(value: string): string | null {
  const normalized = value.normalize('NFKC');
  if (/[\p{Cc}\p{Cf}]/u.test(normalized)) return null;
  const collapsed = normalized.replace(/\s+/gu, ' ').trim();
  return collapsed && /\p{L}/u.test(collapsed) && [...collapsed].length <= 60 ? collapsed : null;
}

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function suggestionScore(option: InsightsLanguageOption, needle: string): number {
  const candidates = [option.label, option.nativeLabel, option.code, ...(option.aliases ?? [])]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map(fold);
  if (candidates.some((candidate) => candidate === needle)) return 0;
  if (candidates.some((candidate) => candidate.startsWith(needle))) return 1;
  if (candidates.some((candidate) => candidate.includes(needle))) return 2;
  return Number.POSITIVE_INFINITY;
}

function canonicalDetectedLanguage(value: string | null | undefined): InsightsOutputLanguage | null {
  const raw = String(value ?? '').trim().replace(/_/g, '-');
  if (!raw) return null;
  try {
    const canonical = Intl.getCanonicalLocales(raw)[0];
    const base = canonical?.split('-')[0]?.toLowerCase();
    if (!base || base === 'und') return null;
    if (OPTION_BY_CODE.has(base)) return { kind: 'known', code: base };

    // The catalog is an autocomplete aid, not an eligibility gate. Preserve a
    // valid detected BCP-47 language even when it is absent from our shortlist.
    const name = normalizeLanguageName(displayName(base, 'en') ?? base);
    return name ? { kind: 'custom', name } : null;
  } catch {
    return null;
  }
}

function isInsightsOutputLanguage(value: unknown): value is InsightsOutputLanguage {
  return isInsightsLanguageSelection(value) && value.kind !== 'auto';
}

function isLegacyLanguage(value: unknown): value is LegacyInsightsLanguage {
  return value === 'auto' || value === 'et' || value === 'en';
}

function isLegacyOutput(value: unknown): value is Exclude<LegacyInsightsLanguage, 'auto'> {
  return value === 'et' || value === 'en';
}

function sameOutput(left: InsightsOutputLanguage, right: InsightsOutputLanguage): boolean {
  if (left.kind === 'known') return right.kind === 'known' && left.code === right.code;
  return right.kind === 'custom' && left.name === right.name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === expected.size
    && Object.keys(value).every((key) => expected.has(key));
}
