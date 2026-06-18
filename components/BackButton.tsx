"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Consistent "Back" control shown on every page except the home page.
 * Mounted once in the root layout so placement & styling stay identical
 * site-wide. Goes to the previous page when there's history, else home.
 */
export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Home is the root — nowhere to go back to.
  if (pathname === "/") return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/");
          }
        }}
        aria-label="Go back"
        className="press group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors duration-150 ease-snappy hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600"
      >
        <span
          className="material-symbols-outlined text-base transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5"
          aria-hidden
        >
          arrow_back
        </span>
        Back
      </button>
    </div>
  );
}
