"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PersonGrid, type PersonGridItem } from "@/components/person-grid";
import type { Member } from "@/lib/members";

type SearchResponseOk = { total: number; members: Member[] };
type SearchResponseErr = { error: string };

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; total: number; items: PersonGridItem[] }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 300;
const TAKE = 12;

function memberToItem(m: Member): PersonGridItem {
  return {
    id: m.id,
    name: m.name,
    party: m.party,
    partyColor: m.partyColor,
    house: m.house,
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    photoUrl: m.photoUrl,
  };
}

export type SearchBarProps = {
  /**
   * Rendered when the input is empty (e.g. the popular-PMs grid).
   * Hidden once the user has typed something.
   */
  children?: React.ReactNode;
  placeholder?: string;
};

export function SearchBar({
  children,
  placeholder = "Search by name — e.g. Thatcher, Blair, Sunak",
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;

  useEffect(() => {
    if (!hasQuery) {
      // Cancel any pending request and reset.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      setState({ kind: "idle" });
      return;
    }

    // Show loading immediately so the UI doesn't flicker between idle/popular and results.
    setState({ kind: "loading" });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const url = new URL("/api/persons/search", window.location.origin);
      url.searchParams.set("q", trimmed);
      url.searchParams.set("includeFormer", "true");
      url.searchParams.set("take", String(TAKE));

      fetch(url.toString(), { signal: ac.signal })
        .then(async (res) => {
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
          return (await res.json()) as SearchResponseOk;
        })
        .then((body) => {
          if (ac.signal.aborted) return;
          setState({
            kind: "ok",
            total: body.total,
            items: body.members.map(memberToItem),
          });
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          const message =
            err instanceof Error ? err.message : "Something went wrong.";
          setState({ kind: "error", message });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, hasQuery]);

  // Cancel inflight requests on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = () => {
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label="Search politicians"
          className="h-12 pl-10 pr-10 text-base"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-8">
        {!hasQuery ? (
          children
        ) : state.kind === "loading" ? (
          <SearchSkeleton />
        ) : state.kind === "error" ? (
          <SearchError message={state.message} />
        ) : state.kind === "ok" ? (
          <SearchResults total={state.total} items={state.items} query={trimmed} />
        ) : null}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <section className="w-full" aria-busy="true" aria-live="polite">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-20" />
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SearchError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <p className="font-medium">Search failed</p>
      <p className="mt-1 text-destructive/80">{message}</p>
    </div>
  );
}

function SearchResults({
  total,
  items,
  query,
}: {
  total: number;
  items: PersonGridItem[];
  query: string;
}) {
  if (items.length === 0) {
    return (
      <PersonGrid
        items={[]}
        heading="No matches"
        meta={
          <span>
            No politicians found for{" "}
            <span className="text-foreground">&ldquo;{query}&rdquo;</span>.
          </span>
        }
        emptyMessage="Try a different name, or include both first and last names."
      />
    );
  }

  return (
    <PersonGrid
      items={items}
      heading="Search results"
      meta={
        <Badge variant="secondary" className="font-normal">
          {total === items.length
            ? `${total} result${total === 1 ? "" : "s"}`
            : `Showing ${items.length} of ${total}`}
        </Badge>
      }
    />
  );
}
