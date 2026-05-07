"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── SSE event shape (mirrors lib/persona.ts BuildEvent + route additions) ────

type SseEvent =
  | { type: "fetch_start" }
  | { type: "fetch_done"; count: number }
  | { type: "chunk_done"; chunkCount: number; totalTokens: number }
  | { type: "extract_start"; chunkIndex: number; totalChunks: number }
  | { type: "extract_done"; chunkIndex: number; totalChunks: number }
  | { type: "merge_start" }
  | { type: "merge_done" }
  | { type: "render_done" }
  | { type: "ready"; cached?: boolean }
  | { type: "error"; message: string };

// ─── UI state ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "running" | "done" | "error";

type Step = {
  id: string;
  text: string;
  /** When `pending` is true, this step is the currently-active one. */
  pending: boolean;
  /** Timestamp when this step transitioned to pending. */
  startedAt: number;
  /** Wall-clock duration once the step settled. */
  durationMs?: number;
};

// Rotating hints shown under the active extract step so the page doesn't
// look frozen during the slow free-tier LLM call (60-90s per chunk).
const EXTRACT_HINTS = [
  "Extracting vocabulary and pet phrases…",
  "Identifying rhetorical devices…",
  "Pulling verbatim quotes from the chunk…",
  "Analysing tone and sentence patterns…",
  "Free-tier models take ~60–90s per chunk — this is normal.",
  "Tagging recurring topics and themes…",
  "Hold tight — the model is still thinking.",
];

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStepDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

/**
 * Attribution config shape passed in for historical figures. Mirrors the
 * `attribution` body the `/api/persona/build` route accepts. Kept here as a
 * named export so the build page can import it without depending on the
 * server-only persona module.
 */
export type BuildAttribution = {
  label: string;
  startDate: string;
  endDate: string;
  searchTerms?: string[];
};

type Props = {
  slug: string;
  name: string;
  /** Modern path: numeric Members API id. Mutually exclusive with `attribution`. */
  memberId?: number;
  /** Historical path: attribution config. Mutually exclusive with `memberId`. */
  attribution?: BuildAttribution;
};

export function BuildProgress({ slug, name, memberId, attribution }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // Elapsed wall-clock since the build started, ticked every second so the
  // user always has a moving counter even during long LLM waits.
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [hintIndex, setHintIndex] = useState<number>(0);

  // Guard so a re-mount (e.g. fast refresh, browser-back-then-forward) doesn't
  // automatically re-fire the build. The user must click "Try again" to retry.
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Run-token: incremented on every retry so an old in-flight stream can't
  // mutate state for the next run.
  const runIdRef = useRef(0);
  const startTimeRef = useRef<number>(0);

  // Replace the trailing pending step (if any) and add a new one. Settles the
  // previously-active step with its wall-clock duration so the user sees how
  // long each phase actually took.
  const advance = useCallback((id: string, text: string) => {
    const now = Date.now();
    setSteps((prev) => {
      const settled = prev.map((s) =>
        s.pending
          ? { ...s, pending: false, durationMs: now - s.startedAt }
          : s,
      );
      // If a step with the same id already exists, update its text in place.
      const existing = settled.findIndex((s) => s.id === id);
      if (existing !== -1) {
        settled[existing] = {
          ...settled[existing],
          id,
          text,
          pending: true,
          // Preserve original startedAt — same step, just relabelled.
          startedAt: settled[existing].startedAt,
          durationMs: undefined,
        };
        return settled;
      }
      return [...settled, { id, text, pending: true, startedAt: now }];
    });
  }, []);

  const finalizeAll = useCallback(() => {
    const now = Date.now();
    setSteps((prev) =>
      prev.map((s) =>
        s.pending
          ? { ...s, pending: false, durationMs: now - s.startedAt }
          : s,
      ),
    );
  }, []);

  const handleEvent = useCallback(
    (event: SseEvent) => {
      switch (event.type) {
        case "fetch_start":
          advance("fetch", "Fetching speeches…");
          break;
        case "fetch_done":
          advance("fetch", `Found ${event.count} speeches.`);
          break;
        case "chunk_done":
          advance(
            "chunk",
            `Chunked into ${event.chunkCount} pieces (${event.totalTokens.toLocaleString()} tokens).`,
          );
          setExtractProgress({ done: 0, total: event.chunkCount });
          break;
        case "extract_start":
          advance(
            "extract",
            `Analysing chunk ${event.chunkIndex + 1}/${event.totalChunks}…`,
          );
          setExtractProgress((prev) => ({
            done: prev?.done ?? 0,
            total: event.totalChunks,
          }));
          break;
        case "extract_done":
          setExtractProgress((prev) => {
            const done = (prev?.done ?? 0) + 1;
            const total = event.totalChunks;
            return { done, total };
          });
          break;
        case "merge_start":
          advance("merge", "Merging style across chunks…");
          break;
        case "merge_done":
          advance("merge", "Merged.");
          break;
        case "render_done":
          // No user-visible message; the imminent "ready" event handles it.
          break;
        case "ready":
          advance("ready", "Done. Opening chat…");
          finalizeAll();
          setPhase("done");
          router.push(`/chat/${slug}`);
          break;
        case "error":
          finalizeAll();
          setErrorMessage(event.message || "Build failed.");
          setPhase("error");
          break;
      }
    },
    [advance, finalizeAll, router, slug],
  );

  const startBuild = useCallback(async () => {
    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("running");
    setErrorMessage(null);
    setSteps([]);
    setExtractProgress(null);

    try {
      // Build the request body. The `/api/persona/build` route accepts either
      // a `memberId` (modern PM) or an `attribution` config (historical PM)
      // — exactly one — and validates that contract server-side.
      const body =
        attribution !== undefined
          ? { slug, name, attribution }
          : { slug, name, memberId };

      const res = await fetch("/api/persona/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (runId !== runIdRef.current) return;

      if (!res.ok) {
        let detail = `Build endpoint returned ${res.status}.`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) detail = body.error;
        } catch {
          // Non-JSON error body; keep the status-based fallback.
        }
        setErrorMessage(detail);
        setPhase("error");
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.body || !contentType.includes("text/event-stream")) {
        setErrorMessage("Build endpoint did not return an event stream.");
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (runId !== runIdRef.current) return;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          // A frame may have multiple `data:` lines (or other fields). We only
          // care about `data:`; concatenate them per the SSE spec.
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart());
            }
          }
          if (dataLines.length === 0) continue;
          const payload = dataLines.join("\n");
          if (!payload) continue;

          let parsed: SseEvent;
          try {
            parsed = JSON.parse(payload) as SseEvent;
          } catch {
            // Skip malformed frames rather than killing the whole stream.
            continue;
          }
          handleEvent(parsed);
        }
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Build request failed.";
      setErrorMessage(message);
      setPhase("error");
    }
  }, [handleEvent, memberId, attribution, name, slug]);

  // Auto-start once on first mount only. Browser back/forward should NOT
  // re-fire the pipeline.
  //
  // No cleanup abort here on purpose: React 19 StrictMode in dev runs effects
  // mount → cleanup → mount, which would abort the just-dispatched POST before
  // it leaves the browser. The runIdRef + startedRef guards already prevent
  // stale state updates and double-fires; an in-flight fetch on real unmount
  // is allowed to complete (the server-side stream closes naturally when the
  // client drops the connection).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTimeRef.current = Date.now();
    void startBuild();
  }, [startBuild]);

  // Elapsed-time ticker. Ticks every second while the build is running so the
  // counter visibly moves even during the slow extraction phase.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Rotate the extract sub-hint while an extract step is pending so the page
  // doesn't feel frozen during the long LLM call.
  const isExtracting = steps.some(
    (s) => s.pending && s.id === "extract",
  );
  useEffect(() => {
    if (!isExtracting) return;
    const id = setInterval(() => {
      setHintIndex((i) => (i + 1) % EXTRACT_HINTS.length);
    }, 4500);
    return () => clearInterval(id);
  }, [isExtracting]);

  const handleRetry = useCallback(() => {
    void startBuild();
  }, [startBuild]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        <header className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center bg-brand px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-brand-foreground">
            Building persona
          </span>
          <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Building {name}…
          </h1>
          <p className="text-sm text-muted-foreground">
            This only happens once. Future visitors get instant chat. Cold
            builds typically run 30–120 seconds; free-tier LLMs sometimes
            stretch that to 2–3 minutes.
          </p>
          {phase === "running" || phase === "done" ? (
            <div className="mt-1 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={
                    phase === "running"
                      ? "size-1.5 animate-pulse rounded-full bg-brand"
                      : "size-1.5 rounded-full bg-brand"
                  }
                  aria-hidden
                />
                Elapsed
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {formatDuration(elapsedMs)}
              </span>
            </div>
          ) : null}
        </header>

        <ol className="flex flex-col gap-2 border-l border-border pl-5">
          {steps.length === 0 && phase === "running" ? (
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
              <span>Starting…</span>
            </li>
          ) : null}
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex flex-col gap-1 text-sm"
              aria-current={step.pending ? "step" : undefined}
            >
              <div className="flex items-start gap-2">
                {step.pending ? (
                  <Loader2
                    className="mt-0.5 size-4 shrink-0 animate-spin text-brand"
                    aria-hidden
                  />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-brand"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    step.pending
                      ? "min-w-0 flex-1 font-medium"
                      : "min-w-0 flex-1 text-muted-foreground"
                  }
                >
                  {step.text}
                </span>
                {step.durationMs !== undefined ? (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatStepDuration(step.durationMs)}
                  </span>
                ) : step.pending ? (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatStepDuration(elapsedMs - (step.startedAt - startTimeRef.current))}
                  </span>
                ) : null}
              </div>
              {step.pending && step.id === "extract" ? (
                <p
                  className="ml-6 text-xs text-muted-foreground"
                  aria-live="polite"
                >
                  {EXTRACT_HINTS[hintIndex % EXTRACT_HINTS.length]}
                </p>
              ) : null}
            </li>
          ))}
        </ol>

        {extractProgress && extractProgress.total > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Chunks analysed</span>
              <span className="tabular-nums">
                {Math.min(extractProgress.done, extractProgress.total)} /{" "}
                {extractProgress.total}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={extractProgress.total}
              aria-valuenow={Math.min(
                extractProgress.done,
                extractProgress.total,
              )}
            >
              <div
                className="h-full bg-brand transition-[width] duration-300"
                style={{
                  width: `${
                    (Math.min(extractProgress.done, extractProgress.total) /
                      extractProgress.total) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-destructive">
                  Build failed.
                </p>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ?? "Unknown error."}
                </p>
              </div>
            </div>
            <div>
              <Button onClick={handleRetry}>Try again</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
