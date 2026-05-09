"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  checkPersonaStatusAction,
  type PersonaStatusResult,
} from "@/lib/actions";

type Props = {
  /** Persona cache key (also the URL segment for /chat and /build). */
  slug: string;
  name: string;
  /**
   * Members API id, when this profile maps to one. Forwarded as `?id=` to
   * `/build/<slug>` so the build page can render the modern (memberId) flow.
   * Null for historical figures whose builds run in attribution mode — the
   * build page then resolves attribution server-side from popular-pms.json.
   */
  memberId: number | null;
  /**
   * True when the figure's persona is built via attribution mode. Used purely
   * as a defensive guard — without either a memberId or a registered
   * attribution entry, we'd have nothing to feed the build pipeline.
   */
  hasAttribution: boolean;
};

/** The state machine that backs the action. */
type CtaState =
  | { kind: "idle" }
  | { kind: "result"; result: PersonaStatusResult }
  | { kind: "error"; message: string };

const INITIAL_STATE: CtaState = { kind: "idle" };

export function ChatCta({ slug, name, memberId, hasAttribution }: Props) {
  const router = useRouter();
  // Separate transition for the post-success router.push. `useActionState`'s
  // `isPending` covers the action itself; this covers the navigation that
  // follows so the button stays in its loading skin until the new route
  // commits.
  const [isNavigating, startNavigation] = useTransition();

  const canBuild = memberId !== null || hasAttribution;

  // The action: a thin client adapter over the server action. The reducer
  // signature is `(prevState, payload | undefined) => nextState`. We don't
  // need a payload — the slug is captured from props — so it's typed `void`.
  const [state, runCheck, isPending] = useActionState<CtaState, void>(
    async () => {
      if (!canBuild) {
        return {
          kind: "error",
          message: "This figure has no Members API id or attribution config.",
        };
      }
      try {
        const result = await checkPersonaStatusAction(slug);
        return { kind: "result", result };
      } catch (err) {
        // Server actions usually surface errors via the returned value, but
        // network-level failures (route shutdown, etc.) can still throw.
        const message =
          err instanceof Error ? err.message : "Could not check persona status.";
        return { kind: "error", message };
      }
    },
    INITIAL_STATE,
  );

  // Routing is a side-effect, so it lives in a useEffect watching the action
  // state — not inside the action reducer (which must be a pure function of
  // its prev state + payload). The transition keeps `isBusy` true across the
  // navigation handoff.
  useEffect(() => {
    if (state.kind !== "result") return;
    const result = state.result;
    if (result.status === "ready") {
      startNavigation(() => {
        router.push(`/chat/${slug}`);
      });
      return;
    }
    if (result.status === "missing") {
      // Modern PMs append `?id=<memberId>` so the build page renders
      // memberId-mode immediately. Historical PMs route plain — the build
      // page resolves attribution from popular-pms.json on the server.
      const target =
        memberId !== null ? `/build/${slug}?id=${memberId}` : `/build/${slug}`;
      startNavigation(() => {
        router.push(target);
      });
    }
  }, [state, slug, memberId, router]);

  const isBusy = isPending || isNavigating;
  const errorMessage =
    state.kind === "error"
      ? state.message
      : state.kind === "result" && state.result.status === "error"
        ? state.result.message
        : null;
  // After an error the user should be able to retry — the button text shifts
  // from "Chat with X" to "Try again" so the affordance is clear.
  const hasRetry = !isBusy && errorMessage !== null;

  return (
    <div className="flex flex-col items-start gap-3">
      {/* The action runs on click via formAction-style submit. Wrapping the
          button in a tiny form is the canonical way to trigger a React
          action without a payload — keeps the JSX shape close to a normal
          submit button. */}
      <form
        action={() => {
          runCheck();
        }}
      >
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isBusy || !canBuild}
          aria-busy={isBusy || undefined}
        >
          {isBusy ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Checking…
            </>
          ) : hasRetry ? (
            <>
              <MessageSquare aria-hidden />
              Try again
            </>
          ) : (
            <>
              <MessageSquare aria-hidden />
              Chat with {name}
            </>
          )}
        </Button>
      </form>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive ring-1 ring-inset ring-destructive/20"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
