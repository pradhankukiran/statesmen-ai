"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorSummary, PageHeading } from "@/components/ui/govuk";

// ─── SSE event shape (mirrors lib/speeches.ts SpeechBuildEvent + route additions)

type SseEvent =
  | { type: "fetch_start" }
  | { type: "fetch_done"; count: number }
  | { type: "embed_progress"; done: number; total: number }
  | { type: "save_start" }
  | { type: "save_done"; count: number }
  | { type: "ready"; cached?: boolean; slug?: string }
  | { type: "error"; message: string }
  | { type: "ping" };

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
  const [embedProgress, setEmbedProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // Elapsed wall-clock since the build started, ticked every second so the
  // user always has a moving counter during slow steps.
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  // Timestamp of the last received SSE event (any type, including pings).
  // Used by the stale-stream watchdog to detect silent stream death (function
  // killed, network drop, infrastructure timeout) since SSE has no built-in
  // way for the client to know "the server stopped sending us anything".
  const [lastEventAt, setLastEventAt] = useState<number>(0);

  // Guard so a re-mount (e.g. fast refresh, browser-back-then-forward) doesn't
  // automatically re-fire the build. The user must click "Try again" to retry.
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Run-token: incremented on every retry so an old in-flight stream can't
  // mutate state for the next run.
  const runIdRef = useRef(0);
  // Mirror of the `phase` state for use inside the SSE loop. The loop closes
  // over the initial render's `phase`, so reading `phase` directly inside
  // post-loop code would always see the stale value at the time `startBuild`
  // was created. The ref dodges that.
  const phaseRef = useRef<Phase>("idle");
  // Build-start as state (not a ref) because the active step's duration is
  // derived from it during render: `elapsedMs - (step.startedAt - buildStartedAt)`.
  // Using a ref would violate react-hooks/refs (no ref reads during render).
  const [buildStartedAt, setBuildStartedAt] = useState<number>(0);

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
      const existing = settled.findIndex((s) => s.id === id);
      if (existing !== -1) {
        settled[existing] = {
          ...settled[existing],
          id,
          text,
          pending: true,
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
      // Stamp every event (including pings) so the stale-stream watchdog can
      // distinguish "server still alive" from "stream went silent".
      setLastEventAt(Date.now());
      switch (event.type) {
        case "fetch_start":
          advance("fetch", "Fetch speeches from Hansard");
          break;
        case "fetch_done":
          advance("fetch", `Fetch speeches from Hansard (${event.count} found)`);
          break;
        case "embed_progress":
          advance("embed", "Index speeches");
          setEmbedProgress({ done: event.done, total: event.total });
          break;
        case "save_start":
          advance("save", "Save");
          break;
        case "save_done":
          advance("save", "Save");
          break;
        case "ready":
          advance("ready", "Open chat");
          finalizeAll();
          setPhase("done");
          // A cache hit may be stored under a different slug (same member ID).
          router.push(`/chat/${event.slug ?? slug}`);
          break;
        case "error":
          finalizeAll();
          setErrorMessage(event.message || "Build failed.");
          setPhase("error");
          break;
        case "ping":
          // Heartbeat from the server — no UI state change required. The
          // timestamp bump above is the entire purpose: it tells the stale-
          // stream watchdog that the server is still alive even when no
          // pipeline progress events are being emitted.
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
    setEmbedProgress(null);
    setElapsedMs(0);
    setBuildStartedAt(Date.now());
    // Seed the watchdog with "now" so the 45s stale-stream timer counts from
    // the moment we kicked off the request, not from epoch 0.
    setLastEventAt(Date.now());

    try {
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
      // Track whether the server sent us a terminal event (`ready` or
      // `error`) before the stream closed. If `done: true` arrives without
      // one, the function likely crashed or hit a Vercel infrastructure
      // timeout — surface that to the user rather than freeze forever.
      let receivedTerminal = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (runId !== runIdRef.current) return;

        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

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
            continue;
          }
          if (parsed.type === "ready" || parsed.type === "error") {
            receivedTerminal = true;
          }
          handleEvent(parsed);
        }
      }

      // Stream ended (`done: true`) without a terminal event. Check our run
      // is still current and the UI thinks we're still running before
      // surfacing this as an error — otherwise we'd clobber a phase=done
      // transition the `ready` handler already made.
      if (
        runId === runIdRef.current &&
        !receivedTerminal &&
        phaseRef.current === "running"
      ) {
        finalizeAll();
        setErrorMessage(
          "Build stream ended unexpectedly. The server may have crashed or timed out. Please try again.",
        );
        setPhase("error");
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Build request failed.";
      setErrorMessage(message);
      setPhase("error");
    }
  }, [handleEvent, finalizeAll, memberId, attribution, name, slug]);

  // Keep phaseRef in sync so the SSE loop (which closes over the initial
  // render's value) can read the current phase after the stream ends.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Auto-start once on first mount only. No cleanup abort: React 19
  // StrictMode runs effects mount → cleanup → mount, which would abort the
  // just-dispatched POST before it leaves the browser. The runIdRef + startedRef
  // guards already prevent stale state updates and double-fires.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startBuild();
  }, [startBuild]);

  useEffect(() => {
    if (phase !== "running" || buildStartedAt === 0) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - buildStartedAt);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, buildStartedAt]);

  // Stale-stream watchdog. SSE has no client-side way to detect the server
  // dying mid-stream (function killed, network drop, infrastructure timeout)
  // — the reader just sits in `await reader.read()` forever. The server now
  // pings every 15s, so 45s without *any* event (including pings) means the
  // stream is genuinely dead. Trip the UI into the error state so the user
  // can retry instead of staring at a frozen spinner.
  useEffect(() => {
    if (phase !== "running" || lastEventAt === 0) return;
    const id = setInterval(() => {
      if (Date.now() - lastEventAt > 45_000) {
        finalizeAll();
        setErrorMessage(
          "Lost connection to the build stream. The server may have timed out. Please try again.",
        );
        setPhase("error");
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [phase, lastEventAt, finalizeAll]);

  const handleRetry = useCallback(() => {
    void startBuild();
  }, [startBuild]);

  // ─── Render ────────────────────────────────────────────────────────────────
  //
  // GOV.UK task list: one row per step with a status tag on the right.

  return (
    <div>
      <PageHeading caption="Preparing a persona">{name}</PageHeading>
      <p className="mt-5 max-w-[40rem] text-body">
        This only happens the first time someone chats with {name}. We fetch
        their speeches from Hansard and index them. It usually takes under a
        minute.
      </p>

      {phase === "running" || phase === "done" ? (
        <p className="mt-4 text-body text-muted-foreground" aria-live="polite">
          Time taken: <span className="font-mono tabular-nums">{formatDuration(elapsedMs)}</span>
          {elapsedMs > 240_000 ? " (this is taking longer than usual)" : null}
        </p>
      ) : null}

      <ul className="mt-8 max-w-[40rem] border-t border-border">
        {steps.length === 0 && phase === "running" ? (
          <li className="flex items-center justify-between gap-4 border-b border-border py-[10px] text-body">
            <span>Starting</span>
            <Badge variant="blue">In progress</Badge>
          </li>
        ) : null}
        {steps.map((step) => {
          const seconds =
            step.durationMs !== undefined
              ? formatStepDuration(step.durationMs)
              : step.pending
                ? formatStepDuration(
                    Math.max(0, elapsedMs - (step.startedAt - buildStartedAt)),
                  )
                : null;
          return (
            <li
              key={step.id}
              className="flex items-center justify-between gap-4 border-b border-border py-[10px] text-body"
              aria-current={step.pending ? "step" : undefined}
            >
              <span>
                {step.text}
                {seconds ? (
                  <span className="ml-2 text-small text-muted-foreground">{seconds}</span>
                ) : null}
              </span>
              {step.pending && phase === "running" ? (
                <Badge variant="blue" className="shrink-0">In progress</Badge>
              ) : phase === "error" && step.pending ? (
                <Badge variant="red" className="shrink-0">Failed</Badge>
              ) : (
                <Badge variant="green" className="shrink-0">Completed</Badge>
              )}
            </li>
          );
        })}
      </ul>

      {embedProgress && embedProgress.total > 0 && phase === "running" ? (
        <p className="mt-4 text-body" aria-live="polite">
          Indexed {Math.min(embedProgress.done, embedProgress.total)} of{" "}
          {embedProgress.total} speeches
        </p>
      ) : null}

      {phase === "error" ? (
        <ErrorSummary title="The persona could not be prepared" className="mt-8 max-w-[40rem]">
          <p className="mb-5">{errorMessage ?? "Unknown error."}</p>
          <Button variant="secondary" onClick={handleRetry}>
            Try again
          </Button>
        </ErrorSummary>
      ) : null}
    </div>
  );
}
