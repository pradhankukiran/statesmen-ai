import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the chat layout: header, centred empty state, message box. */
export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Skeleton className="size-8" />
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 sm:px-6">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80" />
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
