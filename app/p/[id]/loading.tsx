import { Skeleton } from "@/components/ui/skeleton";

// ─── ProfileLoading ───────────────────────────────────────────────────────────
//
// Mirrors the profile page layout exactly so there's no surprise reflow when
// the data lands: hero band (yellow pill placeholder, oversized name line,
// small accent line), then the two-column photo/info split. Same paddings,
// same grid template, same border weights.

export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      {/* ─ Hero band placeholder ────────────────────────────────────────── */}
      <header className="flex flex-col items-start">
        {/* Yellow pill placeholder — same flat box as the resting pill so the
           accent doesn't pop in. */}
        <span
          aria-hidden
          className="mb-8 inline-block h-[1.625rem] w-44 bg-brand"
        />
        {/* Hero-sized name line: matches text-5xl/6xl height. */}
        <Skeleton className="h-12 w-3/4 rounded-md sm:h-16 sm:w-2/3" />
        {/* Small uppercase accent line. */}
        <Skeleton className="mt-4 h-3 w-56 rounded-md" />
      </header>

      {/* ─ Photo + info split ───────────────────────────────────────────── */}
      <section className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:gap-12">
        {/* Photo frame — 3:4, same border treatment as the real one so the
           edge weight matches before/after load. */}
        <div className="max-w-sm">
          <Skeleton className="aspect-[3/4] w-full rounded-md border-2 border-foreground" />
        </div>

        {/* Info column. */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full max-w-xl rounded-md sm:h-6" />
            <Skeleton className="h-5 w-11/12 max-w-xl rounded-md sm:h-6" />
            <Skeleton className="h-5 w-3/4 max-w-xl rounded-md sm:h-6" />
          </div>

          {/* CTA placeholder — same flat brand-yellow as the real button so
             the focus moment isn't disrupted by a grey bar morphing into a
             yellow one. */}
          <span
            aria-hidden
            className="inline-block h-[3.125rem] w-64 rounded-md border-2 border-foreground bg-brand sm:h-[3.625rem]"
          />

          <Skeleton className="h-3 w-72 rounded-md" />
        </div>
      </section>
    </div>
  );
}
