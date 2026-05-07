import { Skeleton } from "@/components/ui/skeleton";

// ─── Loading skeleton ─────────────────────────────────────────────────────────
//
// Mirrors the brutalist layout of the live BuildProgress component: a yellow
// pill, an oversized headline, a small uppercase status accent line, and a
// bordered step panel with sharp corners. No card chrome.

export default function BuildLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <div className="flex flex-col items-start">
        <header className="flex w-full flex-col items-start">
          <span className="mb-8 inline-block bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-foreground">
            Building persona
          </span>
          <Skeleton className="h-12 w-3/4 rounded-md sm:h-14" />
          <div className="mt-4 flex w-full flex-col gap-2">
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <div className="mt-6 flex w-full flex-col gap-2">
            <Skeleton className="h-5 w-full rounded-md" />
            <Skeleton className="h-5 w-11/12 rounded-md" />
            <Skeleton className="h-5 w-3/4 rounded-md" />
          </div>
        </header>

        <ol className="mt-10 flex w-full flex-col divide-y-2 divide-border rounded-md border-2 border-foreground bg-background">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-4">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </li>
          ))}
        </ol>

        <div className="mt-8 flex w-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
          <div className="h-3 w-full rounded-md border-2 border-foreground bg-background" />
        </div>
      </div>
    </div>
  );
}
