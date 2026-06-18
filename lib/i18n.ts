/**
 * Lightweight localization foundation.
 *
 * Intentionally dependency-free and incremental: a cookie (`ds-locale`) selects
 * the active locale, the root layout reads it server-side to translate shared
 * chrome (nav/footer/hero), and <LocaleSwitcher/> sets the cookie + reloads.
 * Add a locale = add a column to DICT; adopt it in a component = swap a literal
 * for t(locale, "key"). This avoids a full [locale] routing restructure now
 * while giving every surface a clear path to translation later.
 */

export const LOCALES = ["en", "es", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "ds-locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  ar: "العربية",
};

/** Right-to-left locales (drives <html dir>). */
export const RTL_LOCALES: Locale[] = ["ar"];

type Key =
  | "nav.scan"
  | "nav.privacy"
  | "footer.tagline"
  | "footer.privacy"
  | "footer.security"
  | "footer.guides"
  | "footer.terms"
  | "home.heroTitle"
  | "home.heroSubtitle"
  | "home.cta"
  | "home.badges";

const DICT: Record<Key, Record<Locale, string>> = {
  "nav.scan": {
    en: "Scan to PDF",
    es: "Escanear a PDF",
    fr: "Numériser en PDF",
    ar: "مسح إلى PDF",
  },
  "nav.privacy": { en: "Privacy", es: "Privacidad", fr: "Confidentialité", ar: "الخصوصية" },
  "footer.tagline": {
    en: "Scan. Edit. Sign. Share. No stress.",
    es: "Escanea. Edita. Firma. Comparte. Sin estrés.",
    fr: "Numérisez. Modifiez. Signez. Partagez. Sans stress.",
    ar: "امسح. حرّر. وقّع. شارك. بلا عناء.",
  },
  "footer.privacy": { en: "Privacy", es: "Privacidad", fr: "Confidentialité", ar: "الخصوصية" },
  "footer.security": { en: "Security", es: "Seguridad", fr: "Sécurité", ar: "الأمان" },
  "footer.guides": { en: "Guides", es: "Guías", fr: "Guides", ar: "أدلة" },
  "footer.terms": { en: "Terms", es: "Términos", fr: "Conditions", ar: "الشروط" },
  "home.heroTitle": {
    en: "Scan, edit, compress, sign and share PDFs in seconds.",
    es: "Escanea, edita, comprime, firma y comparte PDF en segundos.",
    fr: "Numérisez, modifiez, compressez, signez et partagez des PDF en quelques secondes.",
    ar: "امسح وحرّر واضغط ووقّع وشارك ملفات PDF في ثوانٍ.",
  },
  "home.heroSubtitle": {
    en: "Turn photos and files into clean, shareable PDFs — right in your browser. No signup needed for basic tools.",
    es: "Convierte fotos y archivos en PDF limpios y compartibles, directamente en tu navegador. Sin registro para las herramientas básicas.",
    fr: "Transformez photos et fichiers en PDF nets et partageables, directement dans votre navigateur. Sans inscription pour les outils de base.",
    ar: "حوّل الصور والملفات إلى ملفات PDF نظيفة وقابلة للمشاركة — مباشرة في متصفحك. لا حاجة للتسجيل للأدوات الأساسية.",
  },
  "home.cta": {
    en: "Scan / Upload a document",
    es: "Escanear / Subir un documento",
    fr: "Numériser / Importer un document",
    ar: "مسح / رفع مستند",
  },
  "home.badges": {
    en: "✓ No signup · ✓ Files auto-delete · ✓ Works on mobile & desktop",
    es: "✓ Sin registro · ✓ Archivos se autoeliminan · ✓ Móvil y escritorio",
    fr: "✓ Sans inscription · ✓ Fichiers auto-supprimés · ✓ Mobile et ordinateur",
    ar: "✓ بدون تسجيل · ✓ حذف تلقائي للملفات · ✓ يعمل على الجوال والحاسوب",
  },
};

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** Translate a key for a locale, falling back to English then the key. */
export function t(locale: Locale, key: Key): string {
  return DICT[key]?.[locale] ?? DICT[key]?.[DEFAULT_LOCALE] ?? key;
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
