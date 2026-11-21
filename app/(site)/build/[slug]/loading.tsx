import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the build progress layout. */
export default function BuildLoading() {
  return (
    <>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-10 w-72" />
      <Skeleton className="mt-5 h-5 w-full max-w-[40rem]" />
      <Skeleton className="mt-2 h-5 w-2/3 max-w-[30rem]" />
      <div className="mt-8 flex max-w-[40rem] flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </>
  );
}
