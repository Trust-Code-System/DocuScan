"use client";

/**
 * Branded dropdown — a custom listbox replacing the native <select> so the open
 * popup matches DocuScan's colour scheme (a native <select>'s option list is
 * OS-rendered and can't be styled). Keyboard + ARIA accessible: arrow keys,
 * Home/End, Enter/Space, Escape, type-ahead, click-outside, roving highlight.
 *
 * Drop-in for the old `.ds-select` markup — pass `options` (flat) or `groups`.
 */

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Inline style for the option label (e.g. a `fontFamily` preview). */
  style?: React.CSSProperties;
};
export type SelectGroup = { label: string; options: SelectOption[] };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options?: readonly SelectOption[];
  groups?: readonly SelectGroup[];
  className?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Called when an option becomes highlighted — used to lazy-load font previews. */
  onActivate?: (value: string) => void;
};

export default function Select({
  value,
  onChange,
  options,
  groups,
  className = "",
  ariaLabel,
  id,
  disabled,
  onActivate,
}: Props) {
  const flat: readonly SelectOption[] = groups ? groups.flatMap((g) => g.options) : options ?? [];
  const selected = flat.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // highlighted index into `flat`
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ q: "", t: 0 });
  const baseId = useId();
  const listId = `${id ?? baseId}-list`;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // When opening, highlight the current value and scroll it into view.
  useEffect(() => {
    if (!open) return;
    const i = flat.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : firstEnabled());
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function firstEnabled() {
    return flat.findIndex((o) => !o.disabled);
  }
  function step(from: number, dir: 1 | -1) {
    let i = from;
    for (let n = 0; n < flat.length; n++) {
      i = (i + dir + flat.length) % flat.length;
      if (!flat[i]?.disabled) return i;
    }
    return from;
  }
  function pick(i: number) {
    const o = flat[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => step(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => step(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(firstEnabled());
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(0, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      // type-ahead
      const now = Date.now();
      typeahead.current.q = now - typeahead.current.t > 700 ? e.key : typeahead.current.q + e.key;
      typeahead.current.t = now;
      const q = typeahead.current.q.toLowerCase();
      const i = flat.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
      if (i >= 0) setActive(i);
    }
  }

  // Keep the active row scrolled into view as the user navigates, and let the
  // host lazy-load anything tied to the highlighted option (e.g. a font).
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    const o = flat[active];
    if (o && !o.disabled) onActivate?.(o.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  let idx = -1; // running index across groups to align with `flat`
  const renderOption = (o: SelectOption) => {
    idx++;
    const i = idx;
    const isActive = i === active;
    const isSelected = o.value === value;
    return (
      <li
        key={o.value}
        role="option"
        aria-selected={isSelected}
        aria-disabled={o.disabled || undefined}
        data-active={isActive || undefined}
        onMouseEnter={() => !o.disabled && setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(i)}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm ${
          o.disabled
            ? "cursor-not-allowed text-slate-400"
            : isActive
              ? "bg-brand-50 text-brand-700"
              : "text-ink"
        } ${isSelected ? "font-semibold" : ""}`}
      >
        <span className="truncate" style={o.style}>{o.label}</span>
        {isSelected && (
          <span className="material-symbols-outlined shrink-0 text-[18px] text-brand-600" aria-hidden>
            check
          </span>
        )}
      </li>
    );
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-ink transition-colors duration-150 ease-snappy hover:border-brand-300 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-brand-500" : ""
        }`}
      >
        <span className="truncate" style={selected?.style}>{selected?.label ?? "Select…"}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-brand-600 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 max-h-72 w-full min-w-max overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card animate-rise"
        >
          {groups
            ? groups.flatMap((g) => [
                <li
                  key={`h-${g.label}`}
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted"
                >
                  {g.label}
                </li>,
                ...g.options.map(renderOption),
              ])
            : (options ?? []).map(renderOption)}
        </ul>
      )}
    </div>
  );
}
