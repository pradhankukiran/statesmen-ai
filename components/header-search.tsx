"use client";

import {
  startTransition,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getMemberPhotoUrl, type Member } from "@/lib/members";
import { displayName } from "@/lib/names";

type SearchResponseOk = { total: number; members: Member[] };
type SearchResponseErr = { error: string };

type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "ok"; total: number; items: Member[]; query: string }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 300;
const TAKE = 8;

export function HeaderSearch({
  placeholder = "Search politicians…",
}: {
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [optimisticState, setPendingQuery] = useOptimistic<
    SearchState,
    string | null
  >(state, (current, pendingQuery) => {
    if (pendingQuery === null) return current;
    if (current.kind !== "ok") return current;
    if (pendingQuery === current.query) return current;
    return { ...current, pendingQuery } as SearchState & {
      pendingQuery?: string;
    };
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestQueryRef = useRef<string>("");
  const listboxId = useId();

  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;
  const showDropdown = open && hasQuery;

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close on outside click / Escape while the panel is open.
  useEffect(() => {
    if (!showDropdown) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showDropdown]);

  const handleClear = () => {
    setValue("");
    latestQueryRef.current = "";
    setState({ kind: "idle" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    inputRef.current?.focus();
  };

  const debounceAsync = (ms: number) =>
    new Promise<void>((resolve) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(resolve, ms);
    });

  const runSearch = async (query: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const url = new URL("/api/persons/search", window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("includeFormer", "true");
    url.searchParams.set("take", String(TAKE));

    try {
      const res = await fetch(url.toString(), { signal: ac.signal });
      if (!res.ok) {
        let message = `Search failed (${res.status}).`;
        try {
          const body = (await res.json()) as SearchResponseErr;
          if (body?.error) message = body.error;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new Error(message);
      }
      const body = (await res.json()) as SearchResponseOk;
      if (ac.signal.aborted) return;
      if (latestQueryRef.current !== query) return;
      setState({
        kind: "ok",
        total: body.total,
        items: body.members,
        query,
      });
    } catch (err: unknown) {
      if (ac.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (latestQueryRef.current !== query) return;
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setState({ kind: "error", message });
    }
  };

  const pendingQuery =
    optimisticState.kind === "ok"
      ? (optimisticState as SearchState & { pendingQuery?: string }).pendingQuery
      : undefined;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          value={value}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            const nextTrimmed = next.trim();
            latestQueryRef.current = nextTrimmed;
            if (nextTrimmed.length === 0) {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              if (abortRef.current) abortRef.current.abort();
              setState({ kind: "idle" });
              return;
            }
            setOpen(true);
            if (state.kind === "ok") {
              startTransition(async () => {
                setPendingQuery(nextTrimmed);
                await debounceAsync(DEBOUNCE_MS);
                if (latestQueryRef.current !== nextTrimmed) return;
                await runSearch(nextTrimmed);
              });
            } else {
              setState({ kind: "loading", query: nextTrimmed });
              startTransition(async () => {
                await debounceAsync(DEBOUNCE_MS);
                if (latestQueryRef.current !== nextTrimmed) return;
                await runSearch(nextTrimmed);
              });
            }
          }}
          placeholder={placeholder}
          aria-label="Search politicians"
          className="h-10 border-foreground pl-9 pr-9"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="focus-box absolute right-2 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,28rem)] overflow-y-auto border-2 border-foreground bg-background text-foreground"
        >
          {optimisticState.kind === "loading" ? (
            <ResultsSkeleton />
          ) : optimisticState.kind === "error" ? (
            <ResultsError message={optimisticState.message} />
          ) : optimisticState.kind === "ok" ? (
            <Results
              total={optimisticState.total}
              items={optimisticState.items}
              query={optimisticState.query}
              pendingQuery={pendingQuery}
              onSelect={() => setOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Dropdown contents ────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <ul aria-busy="true" className="p-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 px-2.5 py-2"
        >
          <Skeleton className="size-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-l-[5px] border-destructive px-3 py-2.5 text-small"
    >
      <p className="font-bold text-destructive">Search failed</p>
      <p className="mt-0.5">{message}</p>
    </div>
  );
}

function Results({
  total,
  items,
  query,
  pendingQuery,
  onSelect,
}: {
  total: number;
  items: Member[];
  query: string;
  pendingQuery?: string;
  onSelect: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-3 text-small">
        <p className="font-bold">
          No matches for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-muted-foreground">
          Try a different name, or include both first and last names.
        </p>
      </div>
    );
  }

  return (
    <div>
      {pendingQuery ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-small"
        >
          <Badge variant="grey">Searching “{pendingQuery}”…</Badge>
          <span className="text-muted-foreground">previous results</span>
        </div>
      ) : null}
      <ul>
        {items.map((m) => (
          <ResultRow key={m.id} member={m} onSelect={onSelect} />
        ))}
      </ul>
      {total > items.length ? (
        <div className="border-t border-border px-3 py-2 text-small text-muted-foreground">
          Showing {items.length} of {total}
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({
  member,
  onSelect,
}: {
  member: Member;
  onSelect: () => void;
}) {
  const term = formatTerm(member);
  const subtitle = [member.party, member.house, term]
    .filter((x): x is string => Boolean(x))
    .join(" · ");
  const photo = member.photoUrl ?? getMemberPhotoUrl(member.id);
  const name = displayName(member.name);

  return (
    <li role="option" aria-selected="false">
      <Link
        href={`/p/${member.id}`}
        onClick={onSelect}
        className="flex items-center gap-3 border-b border-border px-3 py-2 outline-none hover:bg-muted focus-visible:bg-focus"
      >
        <div className="relative size-10 shrink-0 overflow-hidden bg-muted">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center bg-muted text-small font-medium text-muted-foreground"
            >
              {initials(name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-small font-bold text-link underline underline-offset-[0.1578em]">{name}</div>
          {subtitle ? (
            <div className="truncate text-small text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function yearOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : null;
}

function formatTerm(member: Member): string | null {
  const start = yearOf(member.startedAt);
  if (!start) return null;
  const end = yearOf(member.endedAt) ?? "present";
  if (start === end) return start;
  return `${start}–${end}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}
