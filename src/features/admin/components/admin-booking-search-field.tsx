"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type SearchSuggestion = {
  value: string;
  label: string;
  detail: string;
  kind: "client" | "contact" | "service";
};

type AdminBookingSearchFieldProps = {
  defaultValue: string;
  placeholder?: string;
};

const minQueryLength = 2;

export function AdminBookingSearchField({
  defaultValue,
  placeholder = "Klientka nebo služba",
}: AdminBookingSearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasMountedRef = useRef(false);
  const lastSubmittedQueryRef = useRef(defaultValue);
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const deferredQuery = useDeferredValue(query);
  const listboxId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);
  const appliedQuery = defaultValue.trim();
  const hasActiveSearch = appliedQuery.length > 0;

  const showSuggestions =
    isFocused && deferredQuery.trim().length >= minQueryLength && (status !== "idle" || suggestions.length > 0);

  useEffect(() => {
    const normalizedQuery = deferredQuery.trim();

    if (normalizedQuery.length < minQueryLength) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/bookings/search", {
          method: "POST",
          signal: controller.signal,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ query: normalizedQuery }),
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              status?: string;
              suggestions?: SearchSuggestion[];
            }
          | null;

        if (!response.ok || payload?.status !== "success" || !Array.isArray(payload.suggestions)) {
          setSuggestions([]);
          setStatus("error");
          setActiveIndex(-1);
          return;
        }

        setSuggestions(payload.suggestions);
        setStatus("ready");
        setActiveIndex(-1);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSuggestions([]);
        setStatus("error");
        setActiveIndex(-1);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deferredQuery]);

  const activeDescendant = useMemo(() => {
    if (activeIndex < 0 || activeIndex >= suggestions.length) {
      return undefined;
    }

    return `${listboxId}-option-${activeIndex}`;
  }, [activeIndex, listboxId, suggestions.length]);

  const navigateWithCurrentForm = useCallback((nextQuery: string) => {
    const form = inputRef.current?.form;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") {
        continue;
      }

      const normalizedValue = key === "query" ? nextQuery : value;
      if (!normalizedValue) {
        continue;
      }

      params.set(key, normalizedValue);
    }

    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    router.replace(href, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      if (query === lastSubmittedQueryRef.current) {
        return;
      }

      lastSubmittedQueryRef.current = query;
      navigateWithCurrentForm(query);
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [navigateWithCurrentForm, query]);

  function applySuggestion(nextValue: string, submit = false) {
    setQuery(nextValue);
    setSuggestions([]);
    setStatus("idle");
    setActiveIndex(-1);
    setIsFocused(false);

    if (submit) {
      lastSubmittedQueryRef.current = nextValue;
      requestAnimationFrame(() => navigateWithCurrentForm(nextValue));
    }
  }

  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        <span>Hledat</span>
        {hasActiveSearch ? (
          <span className="rounded-full border border-[var(--color-accent)]/28 bg-[var(--color-accent)]/12 px-2 py-0.5 text-[9px] text-[var(--color-accent-soft)]">
            Aktivní filtr
          </span>
        ) : null}
      </span>
      <div className="relative isolate mt-1.5">
        <input
          ref={inputRef}
          type="search"
          name="query"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false);
              setActiveIndex(-1);
            }, 120);
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setQuery(nextValue);
            if (nextValue.trim().length < minQueryLength) {
              setSuggestions([]);
              setStatus("idle");
            } else {
              setStatus("loading");
            }
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (!showSuggestions || suggestions.length === 0) {
              if (event.key === "Escape") {
                setSuggestions([]);
                setStatus("idle");
              }
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((currentIndex) => Math.min(suggestions.length - 1, currentIndex + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((currentIndex) => Math.max(0, currentIndex - 1));
            } else if (event.key === "Enter" && activeIndex >= 0 && activeIndex < suggestions.length) {
              event.preventDefault();
              applySuggestion(suggestions[activeIndex]?.value ?? query, true);
            } else if (event.key === "Escape") {
              setSuggestions([]);
              setStatus("idle");
              setActiveIndex(-1);
            }
          }}
          className={cn(
            "h-10 min-w-0 w-full rounded-[0.9rem] border bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]/60",
            hasActiveSearch ? "border-[var(--color-accent)]/42" : "border-white/10",
          )}
        />

        {showSuggestions ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.45rem)] z-50 overflow-hidden rounded-[1rem] border border-[rgba(190,160,120,0.16)] bg-[#171219] shadow-[0_22px_50px_rgba(0,0,0,0.42)] ring-1 ring-black/35">
            {status === "loading" ? (
              <div className="px-3 py-2.5 text-sm text-white/56">Hledám v rezervacích...</div>
            ) : status === "error" ? (
              <div className="px-3 py-2.5 text-sm text-red-100/80">Našeptávání teď není dostupné.</div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-white/56">Nic jsem nenašel.</div>
            ) : (
              <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1">
                {suggestions.map((suggestion, index) => (
                  <li key={`${suggestion.kind}-${suggestion.value}-${index}`} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        applySuggestion(suggestion.value, true);
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition",
                        activeIndex === index
                          ? "bg-[rgba(190,160,120,0.14)]"
                          : "hover:bg-white/[0.06]",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{suggestion.label}</span>
                        <span className="mt-0.5 block truncate text-xs text-white/48">{suggestion.detail}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/56">
                        {getSuggestionKindLabel(suggestion.kind)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function getSuggestionKindLabel(kind: SearchSuggestion["kind"]) {
  switch (kind) {
    case "client":
      return "Klientka";
    case "contact":
      return "Kontakt";
    case "service":
      return "Služba";
  }
}
