import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the profile layout: portrait beside name, details and button. */
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16">
      <section className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <Skeleton className="aspect-[4/5] w-32 shrink-0 rounded-lg sm:w-56" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-5 w-full max-w-md" />
          <Skeleton className="h-12 w-52" />
        </div>
      </section>
    </div>
  );
}
