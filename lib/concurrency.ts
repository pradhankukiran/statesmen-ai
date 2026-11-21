/**
 * Run `fn(item, i, signal)` over `items` with at most `limit` workers
 * active at a time. A shared `AbortController` is created internally and
 * combined with `outerSignal` (if any) via `AbortSignal.any`. If any
 * worker rejects, the shared controller is aborted so sibling workers
 * cancel their in-flight work (LLM calls, embedding batches) instead of
 * burning the global budget. The first rejection propagates out
 * of `Promise.all`; subsequent abort errors from siblings surface as
 * unobserved rejections within their worker but `Promise.all` only
 * raises the first.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number, signal: AbortSignal) => Promise<R>,
  outerSignal?: AbortSignal,
): Promise<R[]> {
  if (items.length === 0) return [];
  const ctrl = new AbortController();
  const innerSignal: AbortSignal = outerSignal
    ? AbortSignal.any([outerSignal, ctrl.signal])
    : ctrl.signal;
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  async function worker(): Promise<void> {
    while (true) {
      if (innerSignal.aborted) return;
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i, innerSignal);
      } catch (err) {
        // First worker to throw cancels its peers' in-flight LLM calls
        // so the global build budget isn't burned walking multiple
        // fallback lists in parallel after one has already failed
        // terminally.
        if (!ctrl.signal.aborted) ctrl.abort();
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
