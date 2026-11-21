import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the profile layout. */
export default function ProfileLoading() {
  return (
    <>
      <Skeleton className="mb-6 h-5 w-28" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-10 w-72" />
      <div className="mt-8 flex flex-col gap-8 tablet:flex-row tablet:gap-10">
        <Skeleton className="aspect-[4/5] w-40 shrink-0 tablet:w-56" />
        <div className="flex flex-1 flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
          <Skeleton className="mt-6 h-12 w-44" />
        </div>
      </div>
    </>
  );
}
