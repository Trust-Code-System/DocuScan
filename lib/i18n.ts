/**
 * Localization foundation.
 *
 * Two cookies drive translation:
 *   - `ds-locale`        the active language code ("en" = default/off).
 *   - `ds-locale-scope`  how much to translate: "site" (whole page) | "tools"
 *                        (only the tool tiles). Ignored when locale is "en".
 *
 * The root layout reads `ds-locale` server-side to set <html lang/dir> and to
 * translate the small hand-written DICT below for an instant first paint. For
 * any non-default language, <AutoTranslate/> then translates the rest of the
 * visible text at runtime via the AI endpoint, caching results per language so
 * each unique string is only ever translated once.
 *
 * Adding a language = add a row to LANGUAGES (no hand translation needed; the
 * AI handles it). The DICT is just an optional fast-path for the busiest
 * strings in the few languages we ship by hand.
 */

export type Language = {
  /** BCP-47-ish code stored in the cookie and used for <html lang>. */
  code: string;
  /** Native/English display name shown in the picker and sent to the AI. */
  label: string;
  /** English name handed to the AI as the translation target. */
  name: string;
  rtl?: boolean;
};

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "ds-locale";
export const SCOPE_COOKIE = "ds-locale-scope";

export type TranslateScope = "site" | "tools";

/**
 * Languages offered in the switcher. English first (default / "off"), then
 * alphabetical by label. Every one of these works at runtime via the AI
 * translator; `rtl` flips <html dir>.
 */
export const LANGUAGES: Language[] = [
  { code: "en", label: "English", name: "English" },
  { code: "af", label: "Afrikaans", name: "Afrikaans" },
  { code: "sq", label: "Albanian", name: "Albanian" },
  { code: "am", label: "Amharic", name: "Amharic" },
  { code: "ar", label: "العربية (Arabic)", name: "Arabic", rtl: true },
  { code: "hy", label: "Armenian", name: "Armenian" },
  { code: "az", label: "Azerbaijani", name: "Azerbaijani" },
  { code: "eu", label: "Basque", name: "Basque" },
  { code: "be", label: "Belarusian", name: "Belarusian" },
  { code: "bn", label: "Bengali", name: "Bengali" },
  { code: "bs", label: "Bosnian", name: "Bosnian" },
  { code: "bg", label: "Bulgarian", name: "Bulgarian" },
  { code: "my", label: "Burmese", name: "Burmese" },
  { code: "ca", label: "Catalan", name: "Catalan" },
  { code: "zh", label: "中文 (Chinese, Simplified)", name: "Chinese (Simplified)" },
  { code: "zh-Hant", label: "中文 (Chinese, Traditional)", name: "Chinese (Traditional)" },
  { code: "hr", label: "Croatian", name: "Croatian" },
  { code: "cs", label: "Czech", name: "Czech" },
  { code: "da", label: "Danish", name: "Danish" },
  { code: "nl", label: "Nederlands (Dutch)", name: "Dutch" },
  { code: "et", label: "Estonian", name: "Estonian" },
  { code: "fil", label: "Filipino", name: "Filipino" },
  { code: "fi", label: "Finnish", name: "Finnish" },
  { code: "fr", label: "Français (French)", name: "French" },
  { code: "gl", label: "Galician", name: "Galician" },
  { code: "ka", label: "Georgian", name: "Georgian" },
  { code: "de", label: "Deutsch (German)", name: "German" },
  { code: "el", label: "Ελληνικά (Greek)", name: "Greek" },
  { code: "gu", label: "Gujarati", name: "Gujarati" },
  { code: "ht", label: "Haitian Creole", name: "Haitian Creole" },
  { code: "ha", label: "Hausa", name: "Hausa" },
  { code: "he", label: "עברית (Hebrew)", name: "Hebrew", rtl: true },
  { code: "hi", label: "हिन्दी (Hindi)", name: "Hindi" },
  { code: "hu", label: "Hungarian", name: "Hungarian" },
  { code: "is", label: "Icelandic", name: "Icelandic" },
  { code: "ig", label: "Igbo", name: "Igbo" },
  { code: "id", label: "Indonesian", name: "Indonesian" },
  { code: "ga", label: "Irish", name: "Irish" },
  { code: "it", label: "Italiano (Italian)", name: "Italian" },
  { code: "ja", label: "日本語 (Japanese)", name: "Japanese" },
  { code: "jv", label: "Javanese", name: "Javanese" },
  { code: "kn", label: "Kannada", name: "Kannada" },
  { code: "kk", label: "Kazakh", name: "Kazakh" },
  { code: "km", label: "Khmer", name: "Khmer" },
  { code: "ko", label: "한국어 (Korean)", name: "Korean" },
  { code: "ku", label: "Kurdish", name: "Kurdish" },
  { code: "ky", label: "Kyrgyz", name: "Kyrgyz" },
  { code: "lo", label: "Lao", name: "Lao" },
  { code: "la", label: "Latin", name: "Latin" },
  { code: "lv", label: "Latvian", name: "Latvian" },
  { code: "lt", label: "Lithuanian", name: "Lithuanian" },
  { code: "lb", label: "Luxembourgish", name: "Luxembourgish" },
  { code: "mk", label: "Macedonian", name: "Macedonian" },
  { code: "ms", label: "Malay", name: "Malay" },
  { code: "ml", label: "Malayalam", name: "Malayalam" },
  { code: "mt", label: "Maltese", name: "Maltese" },
  { code: "mi", label: "Maori", name: "Maori" },
  { code: "mr", label: "Marathi", name: "Marathi" },
  { code: "mn", label: "Mongolian", name: "Mongolian" },
  { code: "ne", label: "Nepali", name: "Nepali" },
  { code: "no", label: "Norwegian", name: "Norwegian" },
  { code: "ps", label: "پښتو (Pashto)", name: "Pashto", rtl: true },
  { code: "fa", label: "فارسی (Persian)", name: "Persian", rtl: true },
  { code: "pl", label: "Polski (Polish)", name: "Polish" },
  { code: "pt", label: "Português (Portuguese)", name: "Portuguese" },
  { code: "pa", label: "Punjabi", name: "Punjabi" },
  { code: "ro", label: "Romanian", name: "Romanian" },
  { code: "ru", label: "Русский (Russian)", name: "Russian" },
  { code: "sa", label: "Sanskrit", name: "Sanskrit" },
  { code: "gd", label: "Scottish Gaelic", name: "Scottish Gaelic" },
  { code: "sr", label: "Serbian", name: "Serbian" },
  { code: "sd", label: "Sindhi", name: "Sindhi", rtl: true },
  { code: "si", label: "Sinhala", name: "Sinhala" },
  { code: "sk", label: "Slovak", name: "Slovak" },
  { code: "sl", label: "Slovenian", name: "Slovenian" },
  { code: "so", label: "Somali", name: "Somali" },
  { code: "es", label: "Español (Spanish)", name: "Spanish" },
  { code: "su", label: "Sundanese", name: "Sundanese" },
  { code: "sw", label: "Kiswahili (Swahili)", name: "Swahili" },
  { code: "sv", label: "Swedish", name: "Swedish" },
  { code: "tg", label: "Tajik", name: "Tajik" },
  { code: "ta", label: "Tamil", name: "Tamil" },
  { code: "te", label: "Telugu", name: "Telugu" },
  { code: "th", label: "ไทย (Thai)", name: "Thai" },
  { code: "tr", label: "Türkçe (Turkish)", name: "Turkish" },
  { code: "uk", label: "Українська (Ukrainian)", name: "Ukrainian" },
  { code: "ur", label: "اردو (Urdu)", name: "Urdu", rtl: true },
  { code: "uz", label: "Uzbek", name: "Uzbek" },
  { code: "vi", label: "Tiếng Việt (Vietnamese)", name: "Vietnamese" },
  { code: "cy", label: "Welsh", name: "Welsh" },
  { code: "fy", label: "Western Frisian", name: "Western Frisian" },
  { code: "yi", label: "Yiddish", name: "Yiddish", rtl: true },
  { code: "yo", label: "Yorùbá (Yoruba)", name: "Yoruba" },
  { code: "zu", label: "Zulu", name: "Zulu" },
];

const BY_CODE: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

export function isLocale(v: string | undefined): v is string {
  return !!v && v in BY_CODE;
}

export function getLanguage(code: string): Language | undefined {
  return BY_CODE[code];
}

/** English name for a code, fed to the AI as the translation target. */
export function languageName(code: string): string {
  return BY_CODE[code]?.name ?? "English";
}

export function isRtl(code: string): boolean {
  return !!BY_CODE[code]?.rtl;
}

export function isScope(v: string | undefined): v is TranslateScope {
  return v === "site" || v === "tools";
}

// ---- Optional hand-written fast-path dictionary ---------------------------
// Only the busiest chrome, only for the languages we ship by hand. Everything
// else (and every other language) is handled at runtime by <AutoTranslate/>.

type Key =
  | "nav.scan"
  | "nav.privacy"
  | "footer.tagline"
  | "footer.privacy"
  | "footer.security"
  | "footer.guides"
  | "footer.terms";

type DictLocale = "es" | "fr" | "ar";

const DICT: Record<Key, Record<DictLocale, string>> = {
  "nav.scan": { es: "Escanear a PDF", fr: "Numériser en PDF", ar: "مسح إلى PDF" },
  "nav.privacy": { es: "Privacidad", fr: "Confidentialité", ar: "الخصوصية" },
  "footer.tagline": {
    es: "Escanea. Edita. Firma. Comparte. Sin estrés.",
    fr: "Numérisez. Modifiez. Signez. Partagez. Sans stress.",
    ar: "امسح. حرّر. وقّع. شارك. بلا عناء.",
  },
  "footer.privacy": { es: "Privacidad", fr: "Confidentialité", ar: "الخصوصية" },
  "footer.security": { es: "Seguridad", fr: "Sécurité", ar: "الأمان" },
  "footer.guides": { es: "Guías", fr: "Guides", ar: "أدلة" },
  "footer.terms": { es: "Términos", fr: "Conditions", ar: "الشروط" },
};

const ENGLISH: Record<Key, string> = {
  "nav.scan": "Scan to PDF",
  "nav.privacy": "Privacy",
  "footer.tagline": "Scan. Edit. Sign. Share. No stress.",
  "footer.privacy": "Privacy",
  "footer.security": "Security",
  "footer.guides": "Guides",
  "footer.terms": "Terms",
};

/** Translate a chrome key for the active locale, falling back to English. */
export function t(locale: string, key: Key): string {
  if (locale === "es" || locale === "fr" || locale === "ar") {
    return DICT[key]?.[locale] ?? ENGLISH[key];
  }
  return ENGLISH[key];
}
