"use client";

import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
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
  | { kind: "loading"; query: string }
  | { kind: "ok"; total: number; items: PersonGridItem[]; query: string }
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
  // Optimistic layer: while the user is typing and the debounced fetch hasn't
  // landed yet, we project a "pending" query on top of the last committed
  // `ok` state so the grid doesn't flash empty between keystrokes.
  //
  // useOptimistic clears the overlay automatically once the surrounding
  // transition resolves (see the startTransition wrapper in the input
  // handler). The reducer leaves non-`ok` states untouched — the loading
  // skeleton already communicates progress when there are no prior results.
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
  // Tracks the latest query the user has expressed intent to search for —
  // read inside the debounce timer to know whether we still want to fire
  // the fetch and what string to display in the optimistic overlay.
  const latestQueryRef = useRef<string>("");

  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;

  // Cancel inflight requests on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = () => {
    setValue("");
    latestQueryRef.current = "";
    setState({ kind: "idle" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    inputRef.current?.focus();
  };

  // Debounce + fetch, awaited inside startTransition so useOptimistic knows
  // when to auto-revert the pending overlay. The transition stays "pending"
  // from the keystroke through the debounce delay and the network round-trip;
  // once setState lands (or the query is superseded), the optimistic value
  // is cleared automatically on the next render.
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
      // Drop late responses if the user has since typed a different query.
      if (latestQueryRef.current !== query) return;
      setState({
        kind: "ok",
        total: body.total,
        items: body.members.map(memberToItem),
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

  // Pull the optimistic-only field off the current view.
  const pendingQuery =
    optimisticState.kind === "ok"
      ? (optimisticState as SearchState & { pendingQuery?: string }).pendingQuery
      : undefined;

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
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            const nextTrimmed = next.trim();
            latestQueryRef.current = nextTrimmed;
            // State transitions live in the event handler, not in an effect:
            //   - empty input → idle (cancels any inflight + debounce)
            //   - non-empty + no prior `ok` results → loading (skeleton)
            //   - non-empty + prior `ok` results    → wrap the debounce +
            //     fetch in startTransition + setPendingQuery. useOptimistic
            //     overlays "Searching X" on the previous results until the
            //     real fetch lands and setState commits — at which point
            //     React clears the optimistic value automatically.
            if (nextTrimmed.length === 0) {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              if (abortRef.current) abortRef.current.abort();
              setState({ kind: "idle" });
              return;
            }
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
          className="h-12 pl-11 pr-11 text-base"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-8">
        {!hasQuery ? (
          children
        ) : optimisticState.kind === "loading" ? (
          <SearchSkeleton />
        ) : optimisticState.kind === "error" ? (
          <SearchError message={optimisticState.message} />
        ) : optimisticState.kind === "ok" ? (
          <SearchResults
            total={optimisticState.total}
            items={optimisticState.items}
            query={optimisticState.query}
            pendingQuery={pendingQuery}
          />
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
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-xl ring-1 ring-border">
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
      className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive ring-1 ring-inset ring-destructive/20"
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
  pendingQuery,
}: {
  total: number;
  items: PersonGridItem[];
  query: string;
  pendingQuery?: string;
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
    <div className="space-y-3">
      {pendingQuery ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Badge variant="outline">Searching “{pendingQuery}”…</Badge>
          <span>showing previous results</span>
        </div>
      ) : null}
      <PersonGrid
        items={items}
        heading="Search results"
        meta={
          <Badge variant="secondary">
            {total === items.length
              ? `${total} result${total === 1 ? "" : "s"}`
              : `Showing ${items.length} of ${total}`}
          </Badge>
        }
      />
    </div>
  );
}
