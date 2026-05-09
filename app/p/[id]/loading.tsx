"use client";

import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the profile page layout — same paddings, same grid, same chrome —
// so there's no surprise reflow when the data lands. The portrait skeleton
// carries the same `portrait-<id>` view-transition name as the card and the
// real profile portrait, so the morph survives the Suspense boundary on slow
// async loaders (modern PMs via the Members API).
export default function ProfileLoading() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col items-start">
        {/* Eyebrow placeholder mirrors the resting brand pill. */}
        <span
          aria-hidden
          className="mb-6 inline-block h-6 w-44 rounded-md bg-brand"
        />
        <Skeleton className="h-10 w-3/4 rounded-md sm:h-14 sm:w-2/3" />
        <Skeleton className="mt-4 h-3 w-56 rounded-md" />
      </header>

      <section className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:gap-12">
        <div className="max-w-sm">
          <Skeleton
            className="aspect-[3/4] w-full rounded-2xl"
            style={id ? { viewTransitionName: `portrait-${id}` } : undefined}
          />
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full max-w-xl rounded-md" />
            <Skeleton className="h-5 w-11/12 max-w-xl rounded-md" />
            <Skeleton className="h-5 w-3/4 max-w-xl rounded-md" />
          </div>

          {/* CTA placeholder — matches the new primary button height (lg = 48px). */}
          <span
            aria-hidden
            className="inline-block h-12 w-56 rounded-md bg-brand"
          />

          <Skeleton className="h-3 w-72 rounded-md" />
        </div>
      </section>
    </div>
  );
}
