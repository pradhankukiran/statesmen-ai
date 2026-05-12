import {
  getWarmupState,
  WARMUP_TTL_SECONDS,
  type WarmupState,
} from "@/lib/warmup-state";

export const dynamic = "force-dynamic";

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    const state: WarmupState = await getWarmupState();
    return Response.json(state, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Fail closed as "cold": a 500 here would prevent the UI from polling
    // and the user from triggering a manual warmup, which is worse than
    // briefly mis-reporting an active container.
    console.error(
      "[warmup/status] getWarmupState failed:",
      err instanceof Error ? err.message : err,
    );
    const fallback: WarmupState = {
      state: "cold",
      lastWarmAt: null,
      ageSeconds: null,
      ttlSeconds: WARMUP_TTL_SECONDS,
    };
    return Response.json(fallback, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
