"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// ─── Contract with /api/warmup/status ─────────────────────────────────────────
//
// The status endpoint reports the GPU build engine's warm-state. Cold means
// no recent successful warmup ping; warming means a POST /api/warmup is in
// flight (or recently kicked off); warm means the model is alive and ready.

type WarmState = "cold" | "warming" | "warm";

type StatusResponse = {
  state: WarmState;
  lastWarmAt: number | null;
  ageSeconds: number | null;
  ttlSeconds: number;
};

// Poll cadences. Warm we check less often (the dot is mostly idle); warming
// and cold need quick feedback so the UI doesn't lag behind the API.
const POLL_WARM_MS = 60_000;
const POLL_FAST_MS = 5_000;

// ─── Visual + a11y copy keyed by state ────────────────────────────────────────

const COPY: Record<WarmState, string> = {
  cold: "Build engine cold — first chat will be slower",
  warming: "Warming up build engine...",
  warm: "Build engine ready",
};

const DOT_CLASSES: Record<WarmState, string> = {
  cold: "bg-red-500 shadow-[0_0_8px_rgb(239,68,68)]",
  warming: "bg-amber-400 shadow-[0_0_8px_rgb(251,191,36)] animate-pulse",
  warm: "bg-green-500 shadow-[0_0_8px_rgb(34,197,94)]",
};

/**
 * Small status dot rendered in the global header. Polls /api/warmup/status,
 * fires a fire-and-forget POST /api/warmup when the engine is cold, and
 * pauses polling while the tab is hidden. Hidden entirely on /chat/* routes
 * where the chat UI surfaces its own engine state.
 */
export function GpuStatusDot() {
  const pathname = usePathname();
  const [state, setState] = useState<WarmState>("cold");

  // Latest timer handle so we can cancel cleanly on unmount or state change.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against setState after unmount and against late responses racing
  // a newer poll cycle.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = (ms: number) => {
      clearTimer();
      if (!mountedRef.current) return;
      timerRef.current = setTimeout(() => {
        void poll();
      }, ms);
    };

    const triggerWarmup = () => {
      // Fire-and-forget. The endpoint can take ~90s; we never await it and
      // we always swallow rejections so the UI loop stays clean.
      fetch("/api/warmup", { method: "POST" }).catch(() => {
        /* swallow — next poll will reflect reality */
      });
    };

    const poll = async () => {
      if (!mountedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Paused; visibilitychange handler will restart us.
        return;
      }

      let next: WarmState = "cold";
      try {
        const res = await fetch("/api/warmup/status", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as StatusResponse;
          if (
            body.state === "cold" ||
            body.state === "warming" ||
            body.state === "warm"
          ) {
            next = body.state;
          }
        }
      } catch {
        // Network/JSON failure — render cold and try again on next tick.
        next = "cold";
      }

      if (!mountedRef.current) return;
      // Demote the state update to transition priority so it never preempts
      // an in-flight navigation View Transition snapshot — a sync setState
      // landing during the morph window will break shared-element animations
      // (e.g. the card→profile portrait morph).
      startTransition(() => {
        setState(next);
      });

      if (next === "warm") {
        scheduleNext(POLL_WARM_MS);
      } else if (next === "warming") {
        scheduleNext(POLL_FAST_MS);
      } else {
        // cold — kick off a warmup, then keep polling fast so we observe the
        // transition to "warming" / "warm".
        triggerWarmup();
        scheduleNext(POLL_FAST_MS);
      }
    };

    const onVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        // Tab hidden — cancel any pending tick and idle.
        clearTimer();
      } else {
        // Tab visible again — refetch immediately.
        clearTimer();
        void poll();
      }
    };

    // Initial fetch on mount.
    void poll();

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Hide entirely inside the chat surface — that page communicates engine
  // state through its own affordances.
  if (pathname?.startsWith("/chat/")) return null;

  const label = COPY[state];

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={`inline-block h-2 w-2 rounded-full transition-colors ${DOT_CLASSES[state]}`}
    />
  );
}

export default GpuStatusDot;
