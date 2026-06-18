import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Pwa from "@/components/Pwa";
import DropGuard from "@/components/DropGuard";
import FeedbackPopup from "@/components/FeedbackPopup";
import Analytics from "@/components/Analytics";
import CookieConsent from "@/components/CookieConsent";
import ReferralCapture from "@/components/ReferralCapture";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import BackButton from "@/components/BackButton";
import { SITE_URL } from "@/lib/seo";
import { BRAND, brandParts } from "@/lib/brand";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, isRtl, t } from "@/lib/i18n";
import "./globals.css";

// Stitch DocuScan Design System specifies Inter across all type levels.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    "The fastest way to scan, clean, edit, compress, sign and share documents from your phone or browser. No signup needed for basic tools.",
  applicationName: BRAND.name,
  appleWebApp: { capable: true, statusBarStyle: "default", title: BRAND.name },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f97316",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const { head, tail } = brandParts();

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={inter.variable}>
      <head>
        {/* Material Symbols — used by the Stitch-derived UI. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md backdrop-saturate-150">
          <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="press flex items-center gap-2 font-bold text-lg">
              {BRAND.isDefault ? (
                <img
                  src="/icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 rounded-lg shadow-sm"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
                  {BRAND.logoLetter}
                </span>
              )}
              <span>
                {head}
                <span className="text-brand-500">{tail}</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/image-to-pdf"
                className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
              >
                {t(locale, "nav.scan")}
              </Link>
              <Link
                href="/tools"
                className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
              >
                Tools
              </Link>
              <Link
                href="/privacy"
                className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
              >
                {t(locale, "nav.privacy")}
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <BackButton />
          {children}
        </main>

        <DropGuard />
        <Pwa />
        <FeedbackPopup />
        <CookieConsent />
        <ReferralCapture />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {BRAND.name}. {t(locale, "footer.tagline")}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="transition-colors duration-150 hover:text-brand-600">
                {t(locale, "footer.privacy")}
              </Link>
              <Link href="/security" className="transition-colors duration-150 hover:text-brand-600">
                {t(locale, "footer.security")}
              </Link>
              <Link href="/guides" className="transition-colors duration-150 hover:text-brand-600">
                {t(locale, "footer.guides")}
              </Link>
              <Link href="/terms" className="transition-colors duration-150 hover:text-brand-600">
                {t(locale, "footer.terms")}
              </Link>
              <LocaleSwitcher current={locale} />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
