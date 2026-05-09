import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the BuildProgress layout exactly so there's no reflow when state
// lands: eyebrow pill, oversized headline, status accent line, soft step panel,
// and a soft progress bar track.
export default function BuildLoading() {
  return (
    <div className="lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex flex-col items-start">
          <header className="flex w-full flex-col items-start">
            <span
              aria-hidden
              className="mb-6 inline-block h-6 w-44 rounded-md bg-brand"
            />
            <Skeleton className="h-10 w-3/4 rounded-md sm:h-12" />
            <Skeleton className="mt-4 h-3 w-48 rounded-md" />
            <div className="mt-5 flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-5 w-11/12 rounded-md" />
              <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          </header>

          <ol className="mt-10 flex w-full flex-col divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
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
            <div className="h-2 w-full rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
