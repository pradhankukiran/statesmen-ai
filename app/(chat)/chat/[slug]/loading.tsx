import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the chat layout. */
export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-10 shrink-0 bg-brand" />
      <div className="shrink-0 border-b border-border">
        <div className="page-width py-4">
          <Skeleton className="h-5 w-28" />
          <div className="mt-3 flex items-center gap-3">
            <Skeleton className="size-14" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-56" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1"><div className="page-width py-6">
        <Skeleton className="h-5 w-full max-w-[40rem]" />
        <Skeleton className="mt-6 h-5 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="mt-3 h-5 w-80" />
        ))}
      </div></div>
      <div className="shrink-0 border-t border-border">
        <div className="page-width py-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-2 h-12 w-full max-w-[40rem]" />
        </div>
      </div>
    </div>
  );
}
